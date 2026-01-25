<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { getTaskById, getTaskOwnerId, updateTask } from "@/services/tasks";
import { getRecurringTaskById } from "@/services/recurringTasks";
import { ArcElement, Title } from "chart.js";
import { deleteTask } from "@/services/tasks";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const task = ref(null);
const recurringTaskInfo = ref(null); // Info de la tarea recurrente padre (si aplica)
const loading = ref(true);
const error = ref("");
const showTechnicalInfo = ref(false);
const updatingTask = ref(false);

// Helper para obtener el ID del usuario actual
const getCurrentUserId = () => {
    const user = userStore.user;
    return user?._id ? String(user._id) : user?.id ? String(user.id) : null;
};

// ===== PERMISOS DE EDICIÓN =====
// Un usuario puede editar si:
// 1. Es el titular (posición 0 de assignedTo)
// 2. La tarea NO está vencida
// 3. La tarea NO es recurrente (generada automáticamente)
const isOwner = computed(() => {
    if (!task.value) return false;
    const currentUserId = getCurrentUserId();
    const ownerId = getTaskOwnerId(task.value);
    return currentUserId && ownerId && currentUserId === ownerId;
});

const isExpired = computed(() => {
    if (!task.value?.deadline) return false;
    return new Date(task.value.deadline) < new Date();
});

const isRecurring = computed(() => !!task.value?.recurringTaskId);

const isCompleted = computed(() => task.value?.status === 'COMPLETADA');

const canEdit = computed(() => {
    return isOwner.value && !isExpired.value && !isRecurring.value && !isCompleted.value;
});

const editBlockReason = computed(() => {
    if (!isOwner.value) return "Solo el titular de la tarea puede editarla";
    if (isCompleted.value) return "No se pueden editar tareas completadas";
    if (isExpired.value) return "No se pueden editar tareas vencidas";
    if (isRecurring.value) return "Las tareas recurrentes no se pueden editar directamente";
    return "";
});

// ===== LÓGICA PARA COMPLETAR TAREA =====
const isAssigned = computed(() => {
    if (!task.value?.assignedTo) return false;
    const currentUserId = getCurrentUserId();
    return task.value.assignedTo.some(assigned => {
        if (typeof assigned === 'object') {
            return (assigned._id || assigned.id) === currentUserId;
        }
        return assigned === currentUserId;
    });
});

const isPending = computed(() => {
    return task.value && !isCompleted.value && task.value.status !== 'VENCIDA';
});

const canComplete = computed(() => {
    return isPending.value && isAssigned.value;
});

const marcarComoCompletada = async () => {
    if (!task.value || updatingTask.value) return;
    
    const taskId = task.value._id || task.value.id;
    
    try {
        updatingTask.value = true;
        
        await updateTask(taskId, {
            status: 'COMPLETADA',
            completed: true
        });
        
        // Actualizar estado local
        task.value = {
            ...task.value,
            status: 'COMPLETADA',
            completada: true
        };
    } catch (err) {
        console.error('Error al marcar tarea como completada:', err);
        error.value = err?.response?.data?.message || 'Error al actualizar la tarea';
        setTimeout(() => { error.value = ''; }, 3000);
    } finally {
        updatingTask.value = false;
    }
};

// ===== DATOS DE LA TAREA =====
onMounted(async () => {
    try {
        loading.value = true;
        const data = await getTaskById(route.params.id);
        task.value = data;

        // Si es una tarea generada por una recurrente, obtener info de la recurrente
        if (data.recurringTaskId) {
            try {
                const recurringId = typeof data.recurringTaskId === 'object' 
                    ? data.recurringTaskId._id || data.recurringTaskId.id 
                    : data.recurringTaskId;
                const recurringData = await getRecurringTaskById(recurringId);
                recurringTaskInfo.value = recurringData;
            } catch (recurringErr) {
                // Si no se puede cargar la info de la recurrente, no es crítico
                console.warn("No se pudo cargar info de tarea recurrente:", recurringErr);
            }
        }
    } catch (e) {
        error.value = e?.response?.data?.message || "Error al cargar la tarea";
        console.error("Error al cargar tarea:", e);
    } finally {
        loading.value = false;
    }
});

// Computed para verificar si la tarea recurrente padre está desactivada
const isFromDeactivatedRecurring = computed(() => {
    return recurringTaskInfo.value?.active === false || recurringTaskInfo.value?.deactivatedAt != null;
});

// Fecha de desactivación de la tarea recurrente padre
const recurringDeactivatedAt = computed(() => {
    return recurringTaskInfo.value?.deactivatedAt || null;
});

// Detectar si la descripción tiene leyenda de modificación de tarea recurrente
const hasRecurringModificationLegend = computed(() => {
    if (!task.value?.description) return false;
    return task.value.description.includes('La tarea recurrente fue modificada el');
});

// Extraer la fecha de modificación de la descripción
const recurringModificationDate = computed(() => {
    if (!hasRecurringModificationLegend.value) return null;
    // Buscar patrón "La tarea recurrente fue modificada el DD/MM/YYYY"
    const match = task.value.description.match(/La tarea recurrente fue modificada el (\d{2}\/\d{2}\/\d{4})/); 
    return match ? match[1] : null;
});

// Descripción limpia (sin la leyenda de modificación)
const cleanDescription = computed(() => {
    if (!task.value?.description) return '';
    // Remover la leyenda de modificación si existe
    return task.value.description
        .replace(/\s*\|\s*La tarea recurrente fue modificada el \d{2}\/\d{2}\/\d{4}\.?/g, '')
        .replace(/\s*Nueva modificación el \d{2}\/\d{2}\/\d{4}\.?/g, '')
        .trim();
});

// Formatear fechas
const formatDate = (dateString) => {
    if (!dateString) return "No especificada";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatShortDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR");
};

// Obtener clase del estado
const getStatusClass = (status) => {
    const classes = {
        PENDIENTE: "status-pending",
        EN_PROGRESO: "status-progress",
        COMPLETADA: "status-completed",
        VENCIDA: "status-expired",
    };
    return classes[status] || "status-pending";
};

const getStatusLabel = (status) => {
    const labels = {
        PENDIENTE: "Pendiente",
        EN_PROGRESO: "En progreso",
        COMPLETADA: "Completada",
        VENCIDA: "Vencida",
    };
    return labels[status] || status;
};

// Obtener nombre del titular
const ownerName = computed(() => {
    if (!task.value?.assignedTo?.length) return "Sin asignar";
    const first = task.value.assignedTo[0];
    if (typeof first === "object") {
        return first.name || first.nombre || first.fullname || "Usuario";
    }
    return "Usuario";
});

// Verificar si un usuario es el titular
const isUserOwner = (user, index) => index === 0;

// Navegación
const goBack = () => router.push("/main");
const goToEdit = () => router.push(`/editTask/${route.params.id}`);

const confirmDelete = (id) => {
  const ok = confirm("¿Estás seguro de que querés eliminar esta tarea?");
  if (!ok) return;
   deleteTask(id)
    .then(() => {
        alert("Tarea eliminada correctamente");
        router.push("/main");
    })
    .catch((e) => {
        alert("Error al eliminar la tarea: " + (e?.response?.data?.message || e.message));
    });
};
</script>

<template>
    <div class="task-detail-container">
        <div class="back-link" @click="goBack">← Volver a la lista</div>

        <!-- Loading -->
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <span>Cargando tarea...</span>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="error-state">
            <span>{{ error }}</span>
            <button @click="goBack" class="btn-back">Volver</button>
        </div>

        <!-- Contenido -->
        <div v-else-if="task" class="task-card">
            <!-- Header con estado y acciones -->
            <div class="task-header">
                <span class="status-badge" :class="getStatusClass(task.status)">
                    <span class="status-icon">{{ task.status === 'COMPLETADA' ? '✓' : task.status === 'VENCIDA' ? '⚠' : '◷' }}</span>
                    {{ getStatusLabel(task.status) }}
                </span>

                <!-- Botón Editar (solo si puede) -->
                <button 
                    v-if="canEdit" 
                    @click="goToEdit" 
                    class="btn-edit"
                >
                    Editar
                </button>
                                <!-- Botón Eliminar (solo si puede) -->
                <button 
                    v-if="canEdit" 
                    @click="confirmDelete(task._id)"
                    class="btn-delete"
                >
                    Eliminar
                </button>
                
                <!-- Tooltip si no puede editar pero es tarea suya parcialmente -->
                <div v-else-if="editBlockReason && (isOwner || task.assignedTo?.some(u => (u._id || u.id || u) === getCurrentUserId()))" class="edit-blocked-notice">
                    <p class="notice-text">{{ editBlockReason }}</p>
                </div>
            </div>

            <!-- Aviso de tarea recurrente modificada (debajo del header) -->
            <div v-if="hasRecurringModificationLegend && recurringModificationDate" class="recurring-modified-notice">                
                <span class="notice-text">La tarea recurrente sufrió modificaciones el {{ recurringModificationDate }}</span>
            </div>

            <!-- Switch para completar tarea (solo si puede) -->
            <div v-if="canComplete" class="complete-task-section">
                <label class="complete-switch" :class="{ 'is-loading': updatingTask }">
                    <input 
                        type="checkbox"
                        :disabled="updatingTask"
                        @change="marcarComoCompletada"
                    />
                    <span class="switch-slider"></span>
                    <span class="switch-label">Marcar como completada</span>
                </label>
            </div>
            
            <!-- Leyenda si está pendiente pero no asignado -->
            <div v-else-if="isPending && !isAssigned" class="not-assigned-notice">
                <span class="notice-icon">🔒</span>
                <span class="notice-text">No estás asignado a esta tarea</span>
            </div>

            <!-- Título -->
            <h1 class="task-title">{{ task.title }}</h1>

            <!-- Descripción -->
            <div class="task-section">
                <span class="section-label">DESCRIPCIÓN</span>
                <p class="task-description">{{ cleanDescription || 'Sin descripción' }}</p>
            </div>



            <!-- Descripción -->
            <div class="task-section">
                <span class="section-label">FECHA Y HORA</span>
            </div>
                        <!-- Fechas -->
            <div class="dates-grid">
                <div class="date-card">
                    <div class="date-content">
                        <span class="date-label">FECHA DE LA TAREA</span>
                        <span class="date-value">{{ formatDate(task.date) }}</span>
                        <span class="date-label">FECHA DE VENCIMIENTO</span>
                        <span class="date-value">{{ formatDate(task.deadline) }}</span>
                        <span class="date-label">CREADA EL</span>
                        <span class="date-value">{{ formatDate(task.createdAt) }}</span>

                    </div>
                </div>
            </div>


            <!-- Usuarios asignados -->
            <div class="task-section">
                <span class="section-label">Usuarios asignados</span>
                
                <div class="users-list">
                    <div 
                        v-for="(user, index) in task.assignedTo" 
                        :key="user._id || user.id || index"
                        class="user-item"
                        :class="{ 'is-owner': isUserOwner(user, index) }"
                    >
                        <span class="user-name">
                            {{ typeof user === 'object' ? (user.name || user.nombre || user.fullname || 'Usuario') : 'Usuario' }}
                        </span>
                        <span v-if="isUserOwner(user, index)" class="owner-badge">👑 Titular</span>

                    </div>
                </div>
            </div>

            <!-- Info de recurrencia si aplica -->
            <div v-if="task.recurringTaskId" class="recurring-notice">
                <span class="recurring-text">Esta tarea fue generada automáticamente por una tarea recurrente</span>
            </div>

            <!-- Aviso de tarea recurrente desactivada -->
            <div v-if="isFromDeactivatedRecurring" class="deactivated-recurring-notice">
                <span class="deactivated-icon">⚠️</span>
                <span class="deactivated-text">
                    La tarea recurrente de la cual se generó esta tarea fue desactivada el {{ formatDate(recurringDeactivatedAt) }}
                </span>
            </div>

            <!-- SOLO PARA SUPER USUARIOS -->
            <div class="technical-section">
                <!-- <div class="technical-header" @click="showTechnicalInfo = !showTechnicalInfo">
                    <span class="technical-icon">🔧</span>
                    <span class="technical-label">Información técnica</span>
                    <span class="expand-icon">{{ showTechnicalInfo ? '▼' : '▶' }}</span>
                </div> -->
                <Transition name="slide">
                    <div v-if="showTechnicalInfo" class="technical-content">
                        <div class="tech-row">
                            <span class="tech-label">ID:</span>
                            <code class="tech-value">{{ task._id }}</code>
                        </div>
                        <div class="tech-row" v-if="task.recurringTaskId">
                            <span class="tech-label">Tarea recurrente:</span>
                            <code class="tech-value">{{ task.recurringTaskId }}</code>
                        </div>
                        <div class="tech-row">
                            <span class="tech-label">Titular ID:</span>
                            <code class="tech-value">{{ getTaskOwnerId(task) || 'N/A' }}</code>
                        </div>
                        <div class="tech-row">
                            <span class="tech-label">¿Puedo editar?:</span>
                            <span :class="canEdit ? 'tech-yes' : 'tech-no'">{{ canEdit ? 'Sí' : 'No' }}</span>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    </div>
</template>

<style scoped>

.task-detail-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 1rem;
}

.back-link {
    color: #6b7280;
    cursor: pointer;
    margin-bottom: 1.5rem;
    font-weight: 500;
    transition: color 0.2s;
}

.back-link:hover {
    color: #4f83cc;
}

/* Loading & Error */
.loading-state,
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem;
    color: #6b7280;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #4f83cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.btn-back {
    padding: 0.5rem 1rem;
    background: #4f83cc;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}

/* Task Card */
.task-card {
    background: #1e293b;
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

/* Header */
.task-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.85rem;
}

.status-icon {
    font-size: 0.9rem;
}

.status-pending {
    background: #fef3c7;
    color: #92400e;
    border-color: #f59e0b;
}

.status-progress {
    background: #dbeafe;
    color: #1e40af;
}

.status-completed {
    background: #d1fae5;
    color: #065f46;
    border-color: #10b981;
}

.status-expired {
    background: #fee2e2;
    color: #991b1b;
    border-color: #ef4444;
}

/* Botón Editar
.btn-edit {
    width: 80px;
    height: 30px;
    margin: 1rem 0rem 1rem auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #4f83cc, #3b6cb5);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-edit:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(60, 114, 189, 0.4);
} */
/* Botón Editar */

.btn-edit {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s ease;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, #4cad73);
  color: white;
  margin: 1rem 0rem 1rem auto;
}

.btn-edit:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(60, 189, 129, 0.4);
} 
/* Botón Editar */
.btn-delete {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s ease;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, #dd4c4c);
  color: white;
}

.btn-delete:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(185, 55, 55, 0.4);
}

/* Notice de edición bloqueada
.edit-blocked-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #374151;
    border-radius: 8px;
    font-size: 0.8rem;
    color: #9ca3af;
} */

.edit-blocked-notice {
    background: none;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    box-shadow: none;
    display: inline;
    color: #d81d1d;
    font-size: 0.9rem;
    background-color: #f7f4f4;
}

.notice-icon {
    font-size: 0.9rem;
}

/* === SWITCH COMPLETAR TAREA === */
.complete-task-section {
    display: flex;
    align-items: center;
    padding: 1rem;
    background: #d1fae5 !important;
    border: 1px solid #10b981 !important;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.complete-switch {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
}

.complete-switch.is-loading {
    opacity: 0.6;
    pointer-events: none;
}

.complete-switch input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
}

.switch-slider {
    position: relative;
    width: 50px;
    height: 26px;
    background: #4b5563;
    border-radius: 26px;
    transition: all 0.3s ease;
    flex-shrink: 0;
}

.switch-slider::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.complete-switch input:checked + .switch-slider {
    background: #10b981;
}

.complete-switch input:checked + .switch-slider::before {
    transform: translateX(24px);
}

.complete-switch:hover .switch-slider {
    background: #6ee7b7;
}

.complete-switch input:checked:hover + .switch-slider {
    background: #059669;
}

.switch-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: #f1f5f9;
}

body.dark .switch-label {
    color: #666666;
}

.complete-switch.is-loading .switch-slider::before {
    animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Notice no asignado */
.not-assigned-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #374151;
    border-radius: 10px;
    margin-bottom: 1.5rem;
    color: #9ca3af;
    font-size: 0.9rem;
}

/* Título */
.task-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #f1f5f9;
    margin: 0 0 1.5rem 0;
}

/* Secciones */
.task-section {
    margin-top: 0;
    margin-bottom: 1.5rem;
}

/* Unifica el margen inferior de los títulos de sección */
.section-title-margin {
    display: block;
    margin-bottom: 1rem;
}

.section-icon {
    font-size: 1rem;
    margin-right: 0.5rem;
}

.section-label {
    font-size: 0.8rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.task-description {
    margin-top: 0;
    padding: 1rem;
    background: #334155;
    border-radius: 10px;
    line-height: 1.6;
    margin-bottom: 2rem;
    font-weight: 500;
}

/* Grid de fechas */
.dates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
    margin-top: 0;
}

.date-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: #334155;
    border-radius: 10px;
}

.date-card.expired {
    background: #7f1d1d;
}

.date-icon {
    font-size: 1.2rem;
}

.date-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.date-label {
    font-size: 0.7rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.date-value {
    color: #f1f5f9;
    font-weight: 500;
}

/* Fecha de creación */
.created-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #334155;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.created-icon {
    font-size: 1rem;
}

.created-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}


/* Lista de usuarios */
.users-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.user-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #334155;
    border-radius: 10px;
    transition: background 0.2s;
}

.user-item:hover {
    background: #3b4a63;
}

.user-item.is-owner {
    background: linear-gradient(135deg, #422006 0%, #78350f 100%);
    border: 1px solid #f59e0b;
}

.user-icon {
    font-size: 1rem;
}

.user-name {
    flex: 1;
    color: #f1f5f9;
    font-weight: 500;
}

.owner-badge {
    background: #f59e0b;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
}

.user-arrow {
    color: #6b7280;
    font-size: 1.2rem;
}

/* Notice de recurrencia */
.recurring-notice {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #312e81;
    border: 1px solid #4f46e5;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.recurring-icon {
    font-size: 1rem;
}

.recurring-text {
    color: #c7d2fe;
    font-size: 0.85rem;
}

/* Notice de tarea recurrente desactivada */
.deactivated-recurring-notice {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #7f1d1d;
    border: 1px solid #dc2626;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.deactivated-recurring-notice .deactivated-icon {
    font-size: 1rem;
}

.deactivated-recurring-notice .deactivated-text {
    color: #fecaca;
    font-size: 0.85rem;
}

/* Información técnica */
.technical-section {
    background: #0f172a;
    border-radius: 10px;
    overflow: hidden;
}

.technical-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s;
}

.technical-header:hover {
    background: #1e293b;
}

.technical-icon {
    font-size: 0.9rem;
}

.technical-label {
    flex: 1;
    color: #9ca3af;
    font-size: 0.85rem;
}

.expand-icon {
    color: #6b7280;
    font-size: 0.7rem;
}

.technical-content {
    padding: 0 1rem 1rem;
}

.tech-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #1e293b;
}

.tech-row:last-child {
    border-bottom: none;
}

.tech-label {
    color: #9ca3af;
    font-size: 0.8rem;
    min-width: 120px;
}

.tech-value {
    color: #4ade80;
    font-size: 0.75rem;
    background: #1e293b;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    word-break: break-all;
}

.tech-yes {
    color: #4ade80;
    font-weight: 600;
}

.tech-no {
    color: #f87171;
    font-weight: 600;
}

/* Transiciones */
.slide-enter-active,
.slide-leave-active {
    transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
    opacity: 1;
    max-height: 200px;
}

/* Light mode */
body:not(.dark) .task-card {
    background: #ffffff;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

body:not(.dark) .task-title {
    color: #1f2937;
}

body:not(.dark) .task-description,
body:not(.dark) .date-card,
body:not(.dark) .created-info,
body:not(.dark) .user-item {
    background: #f3f4f6;
}

body:not(.dark) .user-item.is-owner {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

body:not(.dark) .date-value,
body:not(.dark) .user-name {
    color: #1f2937;
}

body:not(.dark) .technical-section {
    background: #f9fafb;
}

body:not(.dark) .technical-header:hover {
    background: #f3f4f6;
}

body:not(.dark) .tech-value {
    background: #e5e7eb;
    color: #059669;
}

/* Light mode - Switch completar */
body:not(.dark) .complete-task-section {
    background: #f3f4f6;
}

body:not(.dark) .switch-slider {
    background: #d1d5db;
}

body:not(.dark) .complete-switch:hover .switch-slider {
    background: #9ca3af;
}

body:not(.dark) .switch-label {
    color: #1f2937;
}

body:not(.dark) .not-assigned-notice {
    background: #f3f4f6;
    color: #6b7280;
}

/* ===== AVISO DE TAREA RECURRENTE MODIFICADA ===== */
.recurring-modified-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    margin-bottom: 1rem;
    color: #92400e;
    font-size: 0.9rem;
    font-weight: 500;
}

.recurring-modified-notice .notice-icon {
    font-size: 1rem;
}

.recurring-modified-notice .notice-text {
    color: #92400e;
}

/* Responsive */
@media (max-width: 640px) {
    .task-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .dates-grid {
        grid-template-columns: 1fr;
    }
}
</style>

