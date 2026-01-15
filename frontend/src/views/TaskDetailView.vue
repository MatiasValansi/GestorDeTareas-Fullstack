<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { getTaskById, getTaskOwnerId } from "@/services/tasks";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const task = ref(null);
const loading = ref(true);
const error = ref("");
const showTechnicalInfo = ref(false);

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

const canEdit = computed(() => {
    return isOwner.value && !isExpired.value && !isRecurring.value;
});

const editBlockReason = computed(() => {
    if (!isOwner.value) return "Solo el titular de la tarea puede editarla";
    if (isExpired.value) return "No se pueden editar tareas vencidas";
    if (isRecurring.value) return "Las tareas recurrentes no se pueden editar directamente";
    return "";
});

// ===== DATOS DE LA TAREA =====
onMounted(async () => {
    try {
        loading.value = true;
        const data = await getTaskById(route.params.id);
        task.value = data;
    } catch (e) {
        error.value = e?.response?.data?.message || "Error al cargar la tarea";
        console.error("Error al cargar tarea:", e);
    } finally {
        loading.value = false;
    }
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
const goBack = () => router.push("/task");
const goToEdit = () => router.push(`/editTask/${route.params.id}`);
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
                    ✏️ Editar
                </button>
                
                <!-- Tooltip si no puede editar pero es tarea suya parcialmente -->
                <div v-else-if="editBlockReason && (isOwner || task.assignedTo?.some(u => (u._id || u.id || u) === getCurrentUserId()))" class="edit-blocked-notice">
                    <span class="notice-icon">🔒</span>
                    <span class="notice-text">{{ editBlockReason }}</span>
                </div>
            </div>

            <!-- Título -->
            <h1 class="task-title">{{ task.title }}</h1>

            <!-- Descripción -->
            <div class="task-section" v-if="task.description">
                <span class="section-icon">📄</span>
                <span class="section-label">Descripción</span>
                <p class="task-description">{{ task.description }}</p>
            </div>

            <!-- Fechas -->
            <div class="dates-grid">
                <div class="date-card">
                    <span class="date-icon">📅</span>
                    <div class="date-content">
                        <span class="date-label">FECHA DE LA TAREA</span>
                        <span class="date-value">{{ formatDate(task.date) }}</span>
                    </div>
                </div>
                <div class="date-card deadline" :class="{ expired: isExpired }">
                    <span class="date-icon">⏰</span>
                    <div class="date-content">
                        <span class="date-label">FECHA DE VENCIMIENTO</span>
                        <span class="date-value">{{ formatDate(task.deadline) }}</span>
                    </div>
                </div>
            </div>

            <!-- Fecha de creación -->
            <div class="created-info">
                <span class="created-icon">🕐</span>
                <div class="created-content">
                    <span class="created-label">CREADA EL</span>
                    <span class="created-value">{{ formatShortDate(task.createdAt) }}</span>
                </div>
            </div>

            <!-- Usuarios asignados -->
            <div class="task-section">
                <span class="section-icon">👥</span>
                <span class="section-label">Usuarios asignados</span>
                
                <div class="users-list">
                    <div 
                        v-for="(user, index) in task.assignedTo" 
                        :key="user._id || user.id || index"
                        class="user-item"
                        :class="{ 'is-owner': isUserOwner(user, index) }"
                    >
                        <span class="user-icon">👤</span>
                        <span class="user-name">
                            {{ typeof user === 'object' ? (user.name || user.nombre || user.fullname || 'Usuario') : 'Usuario' }}
                        </span>
                        <span v-if="isUserOwner(user, index)" class="owner-badge">👑 Titular</span>
                        <span class="user-arrow">›</span>
                    </div>
                </div>
            </div>

            <!-- Info de recurrencia si aplica -->
            <div v-if="task.recurringTaskId" class="recurring-notice">
                <span class="recurring-icon">🔄</span>
                <span class="recurring-text">Esta tarea fue generada automáticamente por una tarea recurrente</span>
            </div>

            <!-- Información técnica (colapsable) -->
            <div class="technical-section">
                <div class="technical-header" @click="showTechnicalInfo = !showTechnicalInfo">
                    <span class="technical-icon">🔧</span>
                    <span class="technical-label">Información técnica</span>
                    <span class="expand-icon">{{ showTechnicalInfo ? '▼' : '▶' }}</span>
                </div>
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
}

.status-progress {
    background: #dbeafe;
    color: #1e40af;
}

.status-completed {
    background: #d1fae5;
    color: #065f46;
}

.status-expired {
    background: #fee2e2;
    color: #991b1b;
}

/* Botón Editar */
.btn-edit {
    display: flex;
    align-items: center;
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
    box-shadow: 0 4px 12px rgba(79, 131, 204, 0.4);
}

/* Notice de edición bloqueada */
.edit-blocked-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #374151;
    border-radius: 8px;
    font-size: 0.8rem;
    color: #9ca3af;
}

.notice-icon {
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
    margin-bottom: 1.5rem;
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
    margin-top: 0.5rem;
    padding: 1rem;
    background: #334155;
    border-radius: 10px;
    color: #e2e8f0;
    line-height: 1.6;
}

/* Grid de fechas */
.dates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
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

.created-label {
    font-size: 0.65rem;
    color: #9ca3af;
    text-transform: uppercase;
}

.created-value {
    color: #e2e8f0;
    font-weight: 500;
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

