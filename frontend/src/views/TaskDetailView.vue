<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getTaskById, deleteTask } from '@/services/tasks'
import { getUserById } from '@/services/users'

const route = useRoute()
const router = useRouter()
const store = useUserStore()

// Estado
const tarea = ref(null)
const cargando = ref(true)
const error = ref("")

// ============ COMPUTED ============

// Datos del usuario asignado
const assignedUsers = computed(() => {
  if (!tarea.value?.assignedTo) return []
  return tarea.value.assignedTo
})

// Estado de la tarea
const taskStatus = computed(() => {
  if (!tarea.value) return { label: 'Desconocido', class: 'status-unknown' }
  
  if (tarea.value.status === 'COMPLETADA' || tarea.value.completada) {
    return { label: 'Completada', class: 'status-completada', icon: '✅' }
  }
  if (tarea.value.status === 'VENCIDA') {
    return { label: 'Vencida', class: 'status-vencida', icon: '❌' }
  }
  return { label: 'Pendiente', class: 'status-pendiente', icon: '⏳' }
})

// Es tarea recurrente
const isRecurring = computed(() => {
  return !!tarea.value?.recurringTaskId
})

// ============ MÉTODOS ============

// Cargar datos de la tarea
const cargarTarea = async () => {
  cargando.value = true
  error.value = ""
  try {
    const data = await getTaskById(route.params.id)
    const doc = data?.payload?.taskFoundById ?? data?.payload ?? data
    tarea.value = doc
  } catch (err) {
    console.error('Error al cargar datos de tarea:', err)
    error.value = 'No se pudo cargar la tarea'
  } finally {
    cargando.value = false
  }
}

// Formatear fecha completa
const formatFechaCompleta = (fechaStr) => {
  if (!fechaStr) return 'No asignada'
  const fecha = new Date(fechaStr)
  const opciones = { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
  return fecha.toLocaleDateString('es-ES', opciones)
}

// Formatear fecha corta
const formatFechaCorta = (fechaStr) => {
  if (!fechaStr) return 'No disponible'
  const fecha = new Date(fechaStr)
  return fecha.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Obtener nombre del usuario
const getUserName = (user) => {
  if (!user) return 'Sin asignar'
  if (typeof user === 'object') {
    return user.nombre || user.name || user.email || 'Usuario'
  }
  return user
}

// Navegación
const volverAlMenu = () => {
  router.push('/main')
}

const verDetalleUsuario = (userId) => {
  const id = typeof userId === 'object' ? userId._id || userId.id : userId
  if (id) router.push(`/userDetail/${id}`)
}

const editarTarea = () => {
  router.push(`/editTask/${tarea.value._id ?? tarea.value.id}`)
}

const eliminarTarea = async () => {
  const confirmacion = confirm(`¿Eliminar la tarea "${tarea.value.title ?? tarea.value.titulo}"?`)
  if (!confirmacion) return

  try {
    await deleteTask(tarea.value._id ?? tarea.value.id)
    volverAlMenu()
  } catch (err) {
    console.error('Error al eliminar tarea', err)
    alert('Hubo un error al eliminar la tarea.')
  }
}

// ============ LIFECYCLE ============

onMounted(() => {
  cargarTarea()
})
</script>

<template>
  <div class="detail-container">
    <!-- Botón volver -->
    <div class="back-link" @click="volverAlMenu">
      <span class="back-arrow">←</span>
      <span class="back-text">Volver a la lista</span>
    </div>

    <!-- Loading -->
    <div v-if="cargando" class="loading-state">
      <div class="spinner"></div>
      <span>Cargando tarea...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button class="btn-retry" @click="cargarTarea">Reintentar</button>
    </div>

    <!-- Contenido de la tarea -->
    <div v-else-if="tarea" class="task-detail-card">
      <!-- Header con estado -->
      <div class="detail-header">
        <div class="status-badge-large" :class="taskStatus.class">
          <span class="status-icon">{{ taskStatus.icon }}</span>
          <span>{{ taskStatus.label }}</span>
        </div>
        <div v-if="isRecurring" class="recurring-badge">
          🔄 Tarea recurrente
        </div>
      </div>

      <!-- Título -->
      <h1 class="task-title">{{ tarea.title || tarea.titulo }}</h1>

      <!-- Descripción -->
      <div class="detail-section" v-if="tarea.description || tarea.descripcion">
        <h3 class="section-title">📝 Descripción</h3>
        <p class="description-text">{{ tarea.description || tarea.descripcion }}</p>
      </div>

      <!-- Info Grid -->
      <div class="info-grid">
        <!-- Fecha límite -->
        <div class="info-card">
          <span class="info-icon">📅</span>
          <div class="info-content">
            <span class="info-label">Fecha límite</span>
            <span class="info-value">{{ formatFechaCompleta(tarea.deadline) }}</span>
          </div>
        </div>

        <!-- Fecha creación -->
        <div class="info-card">
          <span class="info-icon">🕐</span>
          <div class="info-content">
            <span class="info-label">Fecha de creación</span>
            <span class="info-value">{{ formatFechaCorta(tarea.createdAt || tarea.creada) }}</span>
          </div>
        </div>
      </div>

      <!-- Usuarios asignados -->
      <div class="detail-section">
        <h3 class="section-title">👥 Usuarios asignados</h3>
        <div class="users-list" v-if="assignedUsers.length > 0">
          <div 
            v-for="user in assignedUsers" 
            :key="user._id || user.id || user"
            class="user-chip"
            @click="verDetalleUsuario(user)"
          >
            <span class="user-avatar">👤</span>
            <span class="user-name">{{ getUserName(user) }}</span>
            <span class="user-arrow">›</span>
          </div>
        </div>
        <p v-else class="no-users">Sin usuarios asignados</p>
      </div>

      <!-- ID de la tarea (colapsable) -->
      <details class="technical-info">
        <summary>ℹ️ Información técnica</summary>
        <div class="tech-content">
          <p><strong>ID:</strong> {{ tarea._id || tarea.id }}</p>
          <p v-if="tarea.recurringTaskId"><strong>ID Tarea recurrente:</strong> {{ tarea.recurringTaskId }}</p>
        </div>
      </details>

      <!-- Acciones -->
      <div class="actions-section" v-if="store.isSupervisor">
        <button class="btn btn-edit" @click="editarTarea">
          ✏️ Editar Tarea
        </button>
        <button class="btn btn-delete" @click="eliminarTarea">
          🗑️ Eliminar Tarea
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* === CONTENEDOR PRINCIPAL === */
.detail-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* === BOTÓN VOLVER === */
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem 0;
  margin-bottom: 1rem;
  color: #6b7280;
  font-weight: 500;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: #3b82f6;
}

.back-arrow {
  font-size: 1.2rem;
}

.back-text {
  font-size: 0.95rem;
}

/* === LOADING STATE === */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #4f83cc;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* === ERROR STATE === */
.error-state {
  text-align: center;
  padding: 3rem;
  color: #dc2626;
}

.error-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.btn-retry {
  margin-top: 1rem;
  padding: 0.6rem 1.2rem;
  background: #4f83cc;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.btn-retry:hover {
  background: #3d6db5;
}

/* === CARD PRINCIPAL === */
.task-detail-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* === HEADER === */
.detail-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.status-badge-large {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.95rem;
}

.status-badge-large.status-completada {
  background: #d1fae5;
  color: #065f46;
}

.status-badge-large.status-pendiente {
  background: #fef3c7;
  color: #92400e;
}

.status-badge-large.status-vencida {
  background: #fee2e2;
  color: #991b1b;
}

.recurring-badge {
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
}

/* === TÍTULO === */
.task-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  line-height: 1.3;
}

/* === SECCIONES === */
.detail-section {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 0.75rem 0;
}

.description-text {
  color: #374151;
  line-height: 1.6;
  margin: 0;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 10px;
  border-left: 3px solid #4f83cc;
}

/* === INFO GRID === */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.info-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.8rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.95rem;
  color: #1f2937;
  font-weight: 500;
}

/* === USUARIOS === */
.users-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-chip:hover {
  background: #f0f7ff;
  border-color: #4f83cc;
}

.user-avatar {
  font-size: 1.2rem;
}

.user-name {
  flex: 1;
  font-weight: 500;
  color: #1f2937;
}

.user-arrow {
  color: #9ca3af;
  font-size: 1.2rem;
}

.no-users {
  color: #9ca3af;
  font-style: italic;
  margin: 0;
}

/* === INFO TÉCNICA === */
.technical-info {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
}

.technical-info summary {
  cursor: pointer;
  font-weight: 500;
  color: #6b7280;
  font-size: 0.9rem;
}

.tech-content {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.tech-content p {
  margin: 0.25rem 0;
  font-size: 0.85rem;
  color: #6b7280;
  word-break: break-all;
}

/* === ACCIONES === */
.actions-section {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-edit {
  background: #4cad73;
  color: white;
}

.btn-edit:hover {
  background: #3c965f;
  transform: translateY(-1px);
}

.btn-delete {
  background: #e16060;
  color: white;
}

.btn-delete:hover {
  background: #c84c4c;
  transform: translateY(-1px);
}

/* === DARK MODE === */
body.dark .detail-container {
  color: #f9fafb;
}

body.dark .back-link {
  color: #9ca3af;
}

body.dark .back-link:hover {
  color: #60a5fa;
}

body.dark .task-detail-card {
  background: #1f2937;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

body.dark .task-title {
  color: #f9fafb;
}

body.dark .section-title {
  color: #9ca3af;
}

body.dark .description-text {
  background: #374151;
  color: #e5e7eb;
  border-color: #3b82f6;
}

body.dark .info-card {
  background: #374151;
  border-color: #4b5563;
}

body.dark .info-value {
  color: #f9fafb;
}

body.dark .user-chip {
  background: #374151;
  border-color: #4b5563;
}

body.dark .user-chip:hover {
  background: #1e3a5f;
  border-color: #3b82f6;
}

body.dark .user-name {
  color: #f9fafb;
}

body.dark .technical-info {
  background: #374151;
  border-color: #4b5563;
}

body.dark .tech-content {
  border-color: #4b5563;
}

body.dark .tech-content p {
  color: #9ca3af;
}

body.dark .actions-section {
  border-color: #4b5563;
}

body.dark .status-badge-large.status-completada {
  background: #064e3b;
  color: #a7f3d0;
}

body.dark .status-badge-large.status-pendiente {
  background: #78350f;
  color: #fde68a;
}

body.dark .status-badge-large.status-vencida {
  background: #7f1d1d;
  color: #fecaca;
}

body.dark .recurring-badge {
  background: #312e81;
  color: #c7d2fe;
}

body.dark .spinner {
  border-color: #374151;
  border-top-color: #3b82f6;
}

/* === RESPONSIVE === */
@media (max-width: 640px) {
  .detail-container {
    padding: 1rem;
  }
  
  .task-detail-card {
    padding: 1.5rem;
  }
  
  .task-title {
    font-size: 1.5rem;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .actions-section {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>

