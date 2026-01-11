<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

import { getAllTasks, deleteTask, updateTask } from '@/services/tasks'
import { getAllUsers } from '@/services/users'

const router = useRouter()

const tareas = ref([])
const nuevaTarea = ref("")
const cargando = ref(false)
const error = ref("")
const usuarios = ref([])
const store = useUserStore()

// Filtros
const filtroEstado = ref('todos') // 'todos', 'completadas', 'pendientes', 'vencidas'

// Tareas filtradas
const tareasFiltradas = computed(() => {
  if (filtroEstado.value === 'todos') return tareas.value
  if (filtroEstado.value === 'completadas') return tareas.value.filter(t => t.completada || t.status === 'COMPLETADA')
  if (filtroEstado.value === 'pendientes') return tareas.value.filter(t => !t.completada && t.status !== 'VENCIDA')
  if (filtroEstado.value === 'vencidas') return tareas.value.filter(t => t.status === 'VENCIDA')
  return tareas.value
})


// const mostrarTareas = async () => {
//   cargando.value = true
//   try {
//     const res = await axios.get(MOCKAPI)
//     tareas.value = res.data
//   } catch (err) {
//     error.value = 'Error al cargar tareas.'
//     console.error(err)
//   } finally {
//     cargando.value = false
//   }
// }

const mostrarTareas = async () => {
  cargando.value = true
  try {
    const res = await getAllTasks()    
    
    const todasLasTareas = res

    // Si el usuario es supervisor, ve todas.
    // Si no, solo las tareas en las que está asignado.
    if (store.isSupervisor) {
      tareas.value = todasLasTareas
    } else {
      const myId = store.user?.id
      tareas.value = todasLasTareas.filter((t) => {
        const assigned = Array.isArray(t.assignedTo) ? t.assignedTo : []
        return assigned.includes(myId)
      })
    }
  } catch (err) {
    error.value = 'Error al cargar tareas.'
    console.error(err)
  } finally {
    cargando.value = false
  }
}


const obtenerUsuarios = async () => {
  try {
    const res = await getAllUsers()
    
    usuarios.value = res
    
  } catch (err) {
    console.error('Error al cargar usuarios', err)
  }
}

onMounted(async () => {
  await mostrarTareas()
  await obtenerUsuarios()
})



const eliminarTarea = async (id, titulo) => {
  if (!confirm(`❌¿Eliminar "${titulo}"?`)) return
  try {
    await deleteTask(id)
    alert(`Tarea "${titulo}" eliminada.`)
    await mostrarTareas()
  } catch (err) {
    console.error('Error al eliminar tarea', err)
  }
}

const editarTarea = (id) => {
  router.push(`/editTask/${id}`)
}

const toggleCompletada = async (tarea) => {
  const id = tarea._id || tarea.id
  if (!id) return

  // Optimistic UI: cambiamos primero en el frontend
  const estadoAnterior = tarea.completada
  tarea.completada = !estadoAnterior

  try {
    await updateTask(id, { completada: tarea.completada })
  } catch (err) {
    console.error('Error al actualizar tarea', err)
    // Revertimos si falló
    tarea.completada = estadoAnterior
    alert('No se pudo actualizar el estado de la tarea.')
  }
}

const irANuevaVistaTarea = () => {
  router.push('/newTask')
}

const formatFecha = (fechaStr) => {
  if (!fechaStr) return 'No disponible'
  const fecha = new Date(fechaStr)
  const opciones = { weekday: 'short', day: 'numeric', month: 'short' }
  const fechaFormateada = fecha.toLocaleDateString('es-ES', opciones)
  const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `${fechaFormateada} · ${hora} hs`
}

const getUserNameById = (id) => {
  const user = usuarios.value.find(u => u.id == id || u._id == id)
  return user ? user.nombre ?? user.name ?? 'Usuario sin nombre' : 'Usuario desconocido'
}

// Obtener color del estado basado en status de BD
const getStatusClass = (tarea) => {
  if (tarea.status === 'COMPLETADA' || tarea.completada) return 'status-completada'
  if (tarea.status === 'VENCIDA') return 'status-vencida'
  return 'status-pendiente'
}

const getStatusLabel = (tarea) => {
  if (tarea.status === 'COMPLETADA' || tarea.completada) return 'Completada'
  if (tarea.status === 'VENCIDA') return 'Vencida'
  return 'Pendiente'
}

// Obtener los nombres de los usuarios asignados
const getAssigneesNames = (assignedTo) => {
  if (!assignedTo || assignedTo.length === 0) return 'Sin asignar'
  // Si assignedTo contiene objetos de usuario
  if (typeof assignedTo[0] === 'object') {
    return assignedTo.map(u => u.nombre || u.name || 'Usuario').join(', ')
  }
  // Si assignedTo contiene solo IDs
  return assignedTo.map(id => getUserNameById(id)).join(', ')
}

const verDetalleTarea = (id) => {
  router.push(`/taskDetail/${id}`)
}
</script>

<template>
  <main class="task-container">
    <!-- Header con filtros estilo app -->
    <div class="task-header">
      <div class="filters-row">
        <button class="filter-icon-btn">
          <span>⚙️</span> Filtros
        </button>
        <button 
          class="filter-chip" 
          :class="{ active: filtroEstado === 'completadas' }"
          @click="filtroEstado = filtroEstado === 'completadas' ? 'todos' : 'completadas'"
        >
          Completadas
        </button>
        <button 
          class="filter-chip" 
          :class="{ active: filtroEstado === 'pendientes' }"
          @click="filtroEstado = filtroEstado === 'pendientes' ? 'todos' : 'pendientes'"
        >
          Pendientes
        </button>
        <button 
          class="filter-chip" 
          :class="{ active: filtroEstado === 'vencidas' }"
          @click="filtroEstado = filtroEstado === 'vencidas' ? 'todos' : 'vencidas'"
        >
          Vencidas
        </button>
      </div>
    </div>

    <!-- Botón agregar tarea (solo supervisores) -->
    <button
      v-if="store.isSupervisor"
      class="add-task-btn"
      @click="irANuevaVistaTarea"
    >
      + Nueva Tarea
    </button>

    <!-- Loading state -->
    <div v-if="cargando" class="loading-state">
      <div class="spinner"></div>
      <span>Cargando tareas...</span>
    </div>

    <!-- Error state -->
    <p v-else-if="error" class="error-state">{{ error }}</p>

    <!-- Lista de tareas estilo delivery app -->
    <div v-else-if="tareasFiltradas.length" class="task-list-modern">
      <div 
        v-for="tarea in tareasFiltradas" 
        :key="tarea._id || tarea.id" 
        class="task-item"
        @click="verDetalleTarea(tarea._id || tarea.id)"
      >
        <!-- Indicador de estado (barra lateral) -->
        <div class="task-status-indicator" :class="getStatusClass(tarea)"></div>
        
        <!-- Contenido principal -->
        <div class="task-content">
          <!-- Fila superior: Estado + Fecha -->
          <div class="task-top-row">
            <span class="task-status-badge" :class="getStatusClass(tarea)">
              {{ getStatusLabel(tarea) }}
            </span>
            <span class="task-date">{{ formatFecha(tarea.deadline) }}</span>
          </div>
          
          <!-- Título de la tarea -->
          <h3 class="task-title">{{ tarea.title }}</h3>
          
          <!-- Usuario asignado -->
          <p class="task-assignee">
            <span class="assignee-icon">👤</span>
            {{ getAssigneesNames(tarea.assignedTo) }}
          </p>
        </div>

        <!-- Flecha de navegación -->
        <div class="task-arrow">
          <span>›</span>
        </div>
      </div>
    </div>

    <!-- Estado vacío -->
    <div v-else class="empty-state">
      <div class="empty-icon">📋</div>
      <p>No hay tareas {{ filtroEstado !== 'todos' ? filtroEstado : '' }}</p>
    </div>
  </main>
</template>

<style scoped>
/* === CONTENEDOR PRINCIPAL === */
.task-container {
  padding: 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 100%;
  background-color: #f5f5f5;
  min-height: 100vh;
}

/* === HEADER CON FILTROS === */
.task-header {
  background: white;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.filters-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.filter-icon-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.filter-icon-btn:hover {
  background: #f3f4f6;
}

.filter-chip {
  background: transparent;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.filter-chip:hover {
  background: #f3f4f6;
}

.filter-chip.active {
  background: #1f2937;
  color: white;
  border-color: #1f2937;
}

/* === BOTÓN AGREGAR TAREA === */
.add-task-btn {
  display: block;
  width: calc(100% - 2rem);
  margin: 1rem;
  padding: 0.9rem;
  background: #4f83cc;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.add-task-btn:hover {
  background: #3d6db5;
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

.loading-state .spinner {
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
  padding: 2rem;
  color: #dc2626;
  font-weight: 500;
}

/* === LISTA DE TAREAS MODERNA === */
.task-list-modern {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: white;
  margin: 0;
}

/* === ITEM DE TAREA (estilo delivery app) === */
.task-item {
  display: flex;
  align-items: stretch;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background 0.15s ease;
  min-height: 90px;
}

.task-item:hover {
  background: #f9fafb;
}

.task-item:active {
  background: #f3f4f6;
}

/* === INDICADOR DE ESTADO (barra lateral izquierda) === */
.task-status-indicator {
  width: 4px;
  flex-shrink: 0;
}

.task-status-indicator.status-completada {
  background: #10b981;
}

.task-status-indicator.status-pendiente {
  background: #f59e0b;
}

.task-status-indicator.status-vencida {
  background: #ef4444;
}

/* === CONTENIDO DE LA TAREA === */
.task-content {
  flex: 1;
  padding: 1rem 1rem 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.4rem;
  min-width: 0;
}

/* === FILA SUPERIOR (estado + fecha) === */
.task-top-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.task-status-badge {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0;
}

.task-status-badge.status-completada {
  color: #10b981;
}

.task-status-badge.status-pendiente {
  color: #f59e0b;
}

.task-status-badge.status-vencida {
  color: #ef4444;
}

.task-date {
  font-size: 0.85rem;
  color: #6b7280;
}

/* === TÍTULO === */
.task-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* === USUARIO ASIGNADO === */
.task-assignee {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: #6b7280;
  margin: 0;
}

.assignee-icon {
  font-size: 0.85rem;
}

/* === FLECHA DE NAVEGACIÓN === */
.task-arrow {
  display: flex;
  align-items: center;
  padding: 0 1rem;
  color: #9ca3af;
  font-size: 1.5rem;
  font-weight: 300;
}

/* === ESTADO VACÍO === */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #9ca3af;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  font-size: 1.1rem;
  margin: 0;
}

/* === DARK MODE === */
body.dark .task-container {
  background-color: #111827;
}

body.dark .task-header {
  background: #1f2937;
  border-bottom-color: #374151;
}

body.dark .filter-icon-btn,
body.dark .filter-chip {
  border-color: #4b5563;
  color: #d1d5db;
}

body.dark .filter-icon-btn:hover,
body.dark .filter-chip:hover {
  background: #374151;
}

body.dark .filter-chip.active {
  background: #e5e7eb;
  color: #1f2937;
  border-color: #e5e7eb;
}

body.dark .add-task-btn {
  background: #3b82f6;
}

body.dark .add-task-btn:hover {
  background: #2563eb;
}

body.dark .task-list-modern {
  background: #1f2937;
}

body.dark .task-item {
  background: #1f2937;
  border-bottom-color: #374151;
}

body.dark .task-item:hover {
  background: #293548;
}

body.dark .task-item:active {
  background: #374151;
}

body.dark .task-title {
  color: #f9fafb;
}

body.dark .task-date,
body.dark .task-assignee {
  color: #9ca3af;
}

body.dark .task-arrow {
  color: #6b7280;
}

body.dark .loading-state {
  color: #9ca3af;
}

body.dark .loading-state .spinner {
  border-color: #374151;
  border-top-color: #3b82f6;
}

body.dark .empty-state {
  color: #6b7280;
}

/* === RESPONSIVE === */
@media (max-width: 640px) {
  .task-header {
    padding: 0.75rem 1rem;
  }
  
  .filters-row {
    gap: 0.5rem;
  }
  
  .filter-chip,
  .filter-icon-btn {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
  }
  
  .task-content {
    padding: 0.75rem 0.75rem 0.75rem 1rem;
  }
  
  .task-title {
    font-size: 1rem;
  }
}
</style>