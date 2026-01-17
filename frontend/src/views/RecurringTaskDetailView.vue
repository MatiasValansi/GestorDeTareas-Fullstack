<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { getRecurringTaskById, deactivateRecurringTask } from "@/services/recurringTasks";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const task = ref(null);
const loading = ref(true);
const error = ref("");
const showTechnicalInfo = ref(false);
const updatingTask = ref(false);

// Helper para obtener el ID del usuario actual
const getCurrentUserId = () => {
    const user = userStore.user;
    return user?._id ? String(user._id) : user?.id ? String(user.id) : null;
};

// ===== PERMISOS =====
// Solo supervisores pueden desactivar tareas recurrentes
const canEdit = computed(() => {
    return userStore.isSupervisor;
});

// Verificar si la tarea ya fue desactivada (no se puede reactivar)
const isDeactivated = computed(() => {
    return task.value?.active === false || task.value?.deactivatedAt != null;
});

// Verificar si el usuario está asignado a la tarea
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

// Verificar si un usuario es el titular (posición 0)
const isUserOwner = (user, index) => index === 0;

// ===== DESACTIVAR TAREA =====
// IMPORTANTE: Una vez desactivada, NO se puede volver a activar
const deactivateTask = async () => {
    if (!task.value || updatingTask.value || !canEdit.value || isDeactivated.value) return;
    
    // Mostrar confirmación
    const confirmed = confirm(
        "¿Está seguro de que desea desactivar la tarea recurrente?\n\n" +
        "Una vez que se desactive, NO se podrá volver a activar.\n\n" +
        "Las tareas individuales futuras no completadas serán eliminadas."
    );
    
    if (!confirmed) return;
    
    const taskId = task.value._id || task.value.id;
    
    try {
        updatingTask.value = true;
        
        const response = await deactivateRecurringTask(taskId);
        
        // Actualizar estado local con la fecha de desactivación
        task.value = {
            ...task.value,
            active: false,
            deactivatedAt: response.payload?.deactivatedAt || new Date().toISOString()
        };

        alert("Tarea recurrente desactivada correctamente");
    } catch (err) {
        console.error('Error al desactivar tarea recurrente:', err);
        error.value = err?.response?.data?.message || 'Error al desactivar la tarea';
        setTimeout(() => { error.value = ''; }, 5000);
    } finally {
        updatingTask.value = false;
    }
};

// ===== DATOS DE LA TAREA =====
onMounted(async () => {
    try {
        loading.value = true;
        const data = await getRecurringTaskById(route.params.id);
        task.value = data;
    } catch (e) {
        error.value = e?.response?.data?.message || "Error al cargar la tarea recurrente";
        console.error("Error al cargar tarea recurrente:", e);
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

// Mapear periodicidad a texto legible
const getPeriodicityLabel = (periodicity) => {
    const labels = {
        DIARIA: "Diaria",
        SEMANAL: "Semanal",
        QUINCENAL: "Quincenal",
        MENSUAL: "Mensual",
    };
    return labels[periodicity] || periodicity;
};

// Mapear día de la semana
const getDayLabel = (day) => {
    const labels = {
        LUNES: "Lunes",
        MARTES: "Martes",
        MIERCOLES: "Miércoles",
        JUEVES: "Jueves",
        VIERNES: "Viernes",
        SABADO: "Sábado",
        DOMINGO: "Domingo",
    };
    return labels[day] || day;
};

// Obtener descripción del patrón de repetición
const getPatternDescription = computed(() => {
    if (!task.value) return "";
    
    const periodicity = task.value.periodicity;
    const datePattern = task.value.datePattern;
    const numberPattern = task.value.numberPattern;
    
    if (periodicity === "DIARIA") {
        return "Se repite todos los días";
    }
    
    if (periodicity === "SEMANAL" && datePattern) {
        return `Se repite cada semana los ${getDayLabel(datePattern)}`;
    }
    
    if (periodicity === "QUINCENAL" && datePattern) {
        return `Se repite cada dos semanas los ${getDayLabel(datePattern)}`;
    }
    
    if (periodicity === "MENSUAL" && numberPattern) {
        return `Se repite el día ${numberPattern} de cada mes`;
    }
    
    return `Periodicidad: ${getPeriodicityLabel(periodicity)}`;
});

// Navegación
const goBack = () => router.push("/recurrent");
</script>

<template>
    <div class="task-detail-container">
        <div class="back-link" @click="goBack">← Volver a tareas recurrentes</div>

        <!-- Loading -->
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <span>Cargando tarea recurrente...</span>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="error-state">
            <span>{{ error }}</span>
            <button @click="goBack" class="btn-back">Volver</button>
        </div>

        <!-- Contenido -->
        <div v-else-if="task" class="task-card">
            <!-- Header con estado -->
            <div class="task-header">
                <span class="status-badge" :class="task.active !== false ? 'status-active' : 'status-inactive'">
                    <span class="status-icon">{{ task.active !== false ? '🔄' : '⏸' }}</span>
                    {{ task.active !== false ? 'Activa' : 'Desactivada' }}
                </span>
            </div>

            <!-- Mostrar fecha de desactivación si está desactivada -->
            <div v-if="isDeactivated && task.deactivatedAt" class="deactivated-notice">
                <span class="notice-icon">⚠️</span>
                <span class="notice-text">
                    Esta tarea fue desactivada el {{ formatDate(task.deactivatedAt) }}
                </span>
            </div>

            <!-- Botón para desactivar (solo supervisores y si está activa) -->
            <div v-if="canEdit && !isDeactivated" class="deactivate-task-section">
                <button 
                    class="btn-deactivate"
                    :class="{ 'is-loading': updatingTask }"
                    :disabled="updatingTask"
                    @click="deactivateTask"
                >
                    <span v-if="updatingTask">Desactivando...</span>
                    <span v-else>⏸ Desactivar tarea recurrente</span>
                </button>
                <p class="deactivate-warning">
                    ⚠️ Una vez desactivada, no se podrá volver a activar
                </p>
            </div>

            <!-- Aviso si ya está desactivada (para supervisores) -->
            <div v-else-if="canEdit && isDeactivated" class="already-deactivated-notice">
                <span class="notice-icon">🔒</span>
                <span class="notice-text">Esta tarea ya fue desactivada y no puede reactivarse</span>
            </div>
            
            <!-- Leyenda si no es supervisor -->
            <div v-else-if="!userStore.isSupervisor" class="not-supervisor-notice">
                <span class="notice-icon">ℹ️</span>
                <span class="notice-text">Solo los supervisores pueden modificar tareas recurrentes</span>
            </div>

            <!-- Título -->
            <h1 class="task-title">{{ task.title }}</h1>

            <!-- Badge de periodicidad -->
            <div class="periodicity-badge-container">
                <span class="periodicity-badge">
                    🔄 {{ getPeriodicityLabel(task.periodicity) }}
                </span>
                <span v-if="task.datePattern" class="pattern-badge">
                    📅 {{ getDayLabel(task.datePattern) }}
                </span>
                <span v-else-if="task.numberPattern" class="pattern-badge">
                    📅 Día {{ task.numberPattern }}
                </span>
            </div>

            <!-- Descripción del patrón -->
            <div class="pattern-description">
                <span class="pattern-text">{{ getPatternDescription }}</span>
            </div>

            <!-- Descripción -->
            <div class="task-section">
                <span class="section-label">DESCRIPCIÓN</span>
                <p class="task-description">{{ task.description || 'Sin descripción' }}</p>
            </div>

            <!-- Fechas -->
            <div class="task-section">
                <span class="section-label">FECHA Y HORA</span>
            </div>
            <div class="dates-grid">
                <div class="date-card">
                    <div class="date-content">
                        <span class="date-label">FECHA DE INICIO</span>
                        <span class="date-value">{{ formatDate(task.date) }}</span>
                        <span class="date-label">VENCIMIENTO (por instancia)</span>
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

            <!-- Info de recurrencia -->
            <div class="recurring-info-notice">
                <span class="recurring-icon">ℹ️</span>
                <span class="recurring-text">Esta tarea genera instancias automáticamente según su periodicidad</span>
            </div>

            <!-- INFORMACIÓN TÉCNICA -->
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
                        <div class="tech-row">
                            <span class="tech-label">Periodicidad:</span>
                            <code class="tech-value">{{ task.periodicity }}</code>
                        </div>
                        <div class="tech-row" v-if="task.datePattern">
                            <span class="tech-label">Patrón día:</span>
                            <code class="tech-value">{{ task.datePattern }}</code>
                        </div>
                        <div class="tech-row" v-if="task.numberPattern">
                            <span class="tech-label">Patrón número:</span>
                            <code class="tech-value">{{ task.numberPattern }}</code>
                        </div>
                        <div class="tech-row">
                            <span class="tech-label">Estado:</span>
                            <span :class="task.active !== false ? 'tech-yes' : 'tech-no'">
                                {{ task.active !== false ? 'Activa' : 'Inactiva' }}
                            </span>
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
    color: #8b5cf6;
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
    border-top-color: #8b5cf6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.btn-back {
    padding: 0.5rem 1rem;
    background: #8b5cf6;
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

.status-active {
    background: #ede9fe;
    color: #7c3aed;
    border: 1px solid #8b5cf6;
}

.status-inactive {
    background: #f3f4f6;
    color: #6b7280;
    border: 1px solid #9ca3af;
}

/* Botón Eliminar */
.btn-delete {
    width: 80px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #dd4c4c);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-delete:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(177, 55, 55, 0.4);
}

/* Deactivate Section */
.deactivate-task-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.btn-deactivate {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-deactivate:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
}

.btn-deactivate:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-deactivate.is-loading {
    opacity: 0.7;
}

.deactivate-warning {
    margin: 0.75rem 0 0 0;
    font-size: 0.8rem;
    color: #991b1b;
    text-align: center;
}

/* Deactivated Notice */
.deactivated-notice {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.deactivated-notice .notice-icon {
    font-size: 1.2rem;
}

.deactivated-notice .notice-text {
    color: #92400e;
    font-size: 0.9rem;
    font-weight: 500;
}

/* Already Deactivated Notice */
.already-deactivated-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    margin-bottom: 1.5rem;
    color: #6b7280;
    font-size: 0.9rem;
}

/* Toggle Section (deprecated - kept for backward compatibility) */
.toggle-task-section {
    display: flex;
    align-items: center;
    padding: 1rem;
    background: #ede9fe !important;
    border: 1px solid #8b5cf6 !important;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.toggle-switch {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
}

.toggle-switch.is-loading {
    opacity: 0.6;
    pointer-events: none;
}

.toggle-switch input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
}

.switch-slider {
    position: relative;
    width: 50px;
    height: 26px;
    background: #6b7280;
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

.toggle-switch input:checked + .switch-slider {
    background: #8b5cf6;
}

.toggle-switch input:checked + .switch-slider::before {
    transform: translateX(24px);
}

.toggle-switch:hover .switch-slider {
    background: #9ca3af;
}

.toggle-switch input:checked:hover + .switch-slider {
    background: #7c3aed;
}

.switch-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: #1f2937;
}

/* Notice no supervisor */
.not-supervisor-notice {
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
    margin: 0 0 1rem 0;
}

/* Badge de periodicidad */
.periodicity-badge-container {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
}

.periodicity-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem 0.8rem;
    background: #4c1d95;
    color: #c4b5fd;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.85rem;
}

.pattern-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem 0.8rem;
    background: #374151;
    color: #9ca3af;
    border-radius: 20px;
    font-size: 0.85rem;
}

/* Descripción del patrón */
.pattern-description {
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #312e81 0%, #4c1d95 100%);
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.pattern-text {
    color: #c4b5fd;
    font-size: 0.95rem;
    font-weight: 500;
}

/* Secciones */
.task-section {
    margin-top: 0;
    margin-bottom: 1.5rem;
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
    line-height: 1.6;
    margin-bottom: 2rem;
    font-weight: 500;
    color: #f1f5f9;
}

/* Grid de fechas */
.dates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
    margin-top: 0.5rem;
}

.date-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: #334155;
    border-radius: 10px;
}

.date-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.date-label {
    font-size: 0.7rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.5rem;
}

.date-label:first-child {
    margin-top: 0;
}

.date-value {
    color: #f1f5f9;
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

/* Notice de info recurrencia */
.recurring-info-notice {
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
    color: #a78bfa;
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

body:not(.dark) .task-description {
    color: #374151;
}

body:not(.dark) .periodicity-badge {
    background: #ede9fe;
    color: #7c3aed;
}

body:not(.dark) .pattern-badge {
    background: #f3f4f6;
    color: #6b7280;
}

body:not(.dark) .pattern-description {
    background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
}

body:not(.dark) .pattern-text {
    color: #6d28d9;
}

body:not(.dark) .status-active {
    background: #ede9fe;
    color: #7c3aed;
}

body:not(.dark) .technical-section {
    background: #f9fafb;
}

body:not(.dark) .technical-header:hover {
    background: #f3f4f6;
}

body:not(.dark) .tech-value {
    background: #e5e7eb;
    color: #7c3aed;
}

body:not(.dark) .not-supervisor-notice {
    background: #f3f4f6;
    color: #6b7280;
}

body:not(.dark) .recurring-info-notice {
    background: #ede9fe;
    border-color: #8b5cf6;
}

body:not(.dark) .recurring-text {
    color: #6d28d9;
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

    .periodicity-badge-container {
        flex-direction: column;
    }
}
</style>
