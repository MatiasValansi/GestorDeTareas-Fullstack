<script setup>
import { ref, onMounted, computed, watch, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getCalendarTasks } from '@/services/tasks'
import { getAllUsers } from '@/services/users'

const router = useRouter()
const store = useUserStore()

// Inyectar el mes del calendario desde App.vue
const globalMonth = inject('currentMonth', ref(new Date()))

// Estado local
const tareas = ref([])
const usuarios = ref([])
const cargando = ref(false)
const error = ref("")

// Mes seleccionado (sincronizado con el calendario global)
const selectedMonth = ref(new Date(globalMonth.value))

// Filtros
const filtroEstado = ref('todos') // 'todos', 'completadas', 'pendientes', 'vencidas'

// ============ COMPUTED ============

// Label del mes actual
const currentMonthLabel = computed(() => {
  return selectedMonth.value.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
})

// Tareas filtradas por estado
const tareasFiltradas = computed(() => {
  let filtered = tareas.value
  
  if (filtroEstado.value === 'completadas') {
    filtered = filtered.filter(t => t.completada || t.status === 'COMPLETADA')
  } else if (filtroEstado.value === 'pendientes') {
    filtered = filtered.filter(t => !t.completada && t.status !== 'VENCIDA' && t.status !== 'COMPLETADA')
  } else if (filtroEstado.value === 'vencidas') {
    filtered = filtered.filter(t => t.status === 'VENCIDA')
  }
  
  // Ordenar por fecha
  return filtered.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
})

// Contadores para los filtros
const contadores = computed(() => ({
  total: tareas.value.length,
  completadas: tareas.value.filter(t => t.completada || t.status === 'COMPLETADA').length,
  pendientes: tareas.value.filter(t => !t.completada && t.status !== 'VENCIDA' && t.status !== 'COMPLETADA').length,
  vencidas: tareas.value.filter(t => t.status === 'VENCIDA').length
}))

// ============ MÉTODOS ============

// Cargar tareas del mes seleccionado
const cargarTareas = async () => {
  cargando.value = true
  error.value = ""
  try {
    const month = selectedMonth.value.getMonth() + 1
    const year = selectedMonth.value.getFullYear()
    
    const todasLasTareas = await getCalendarTasks(month, year)
    
    // Si el usuario es supervisor, ve todas. Si no, solo las asignadas.
    if (store.isSupervisor) {
      tareas.value = todasLasTareas
    } else {
      const myId = store.user?.id
      tareas.value = todasLasTareas.filter((t) => {
        const assigned = Array.isArray(t.assignedTo) ? t.assignedTo : []
        // Verificar si assignedTo contiene objetos o IDs
        return assigned.some(a => 
          (typeof a === 'object' ? a._id || a.id : a) === myId
        )
      })
    }
  } catch (err) {
    error.value = 'Error al cargar tareas.'
    console.error(err)
  } finally {
    cargando.value = false
  }
}

// Cargar usuarios
const cargarUsuarios = async () => {
  try {
    usuarios.value = await getAllUsers()
  } catch (err) {
    console.error('Error al cargar usuarios', err)
  }
}

// Navegación de mes
const prevMonth = () => {
  const newDate = new Date(selectedMonth.value)
  newDate.setMonth(newDate.getMonth() - 1)
  selectedMonth.value = newDate
}

const nextMonth = () => {
  const newDate = new Date(selectedMonth.value)
  newDate.setMonth(newDate.getMonth() + 1)
  selectedMonth.value = newDate
}

// Ir al mes actual
const goToCurrentMonth = () => {
  selectedMonth.value = new Date()
}

// ============ HELPERS DE FORMATO ============

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

const getAssigneesNames = (assignedTo) => {
  if (!assignedTo || assignedTo.length === 0) return 'Sin asignar'
  if (typeof assignedTo[0] === 'object') {
    return assignedTo.map(u => u.nombre || u.name || 'Usuario').join(', ')
  }
  return assignedTo.map(id => getUserNameById(id)).join(', ')
}

// ============ NAVEGACIÓN ============

const verDetalleTarea = (id) => {
  router.push(`/taskDetail/${id}`)
}

const irANuevaVistaTarea = () => {
  router.push('/newTask')
}

// ============ LIFECYCLE ============

onMounted(async () => {
  await Promise.all([cargarTareas(), cargarUsuarios()])
})

// Recargar tareas cuando cambia el mes
watch(selectedMonth, () => {
  cargarTareas()
})

// Sincronizar con el mes global cuando cambia
watch(globalMonth, (newMonth) => {
  selectedMonth.value = new Date(newMonth)
}, { deep: true })
</script>

<template>
  <main class="task-container">
    <!-- Header con navegación de mes y filtros -->
    <div class="task-header">
      <!-- Selector de mes -->
      <div class="month-selector">
        <button class="month-nav-btn" @click="prevMonth">◀</button>
        <h2 class="month-title" @click="goToCurrentMonth">{{ currentMonthLabel }}</h2>
        <button class="month-nav-btn" @click="nextMonth">▶</button>
      </div>
      
      <!-- Filtros de estado -->
      <div class="filters-row">
        <button 
          class="filter-chip" 
          :class="{ active: filtroEstado === 'todos' }"
          @click="filtroEstado = 'todos'"
        >
          Todas ({{ contadores.total }})
        </button>
        <button 
          class="filter-chip" 
          :class="{ active: filtroEstado === 'completadas' }"
          @click="filtroEstado = filtroEstado === 'completadas' ? 'todos' : 'completadas'"
        >
          ✅ Completadas ({{ contadores.completadas }})
        </button>
        <button 
          class="filter-chip" 
          :class="{ active: filtroEstado === 'pendientes' }"
          @click="filtroEstado = filtroEstado === 'pendientes' ? 'todos' : 'pendientes'"
        >
          ⏳ Pendientes ({{ contadores.pendientes }})
        </button>
        <button 
          class="filter-chip" 
          :class="{ active: filtroEstado === 'vencidas' }"
          @click="filtroEstado = filtroEstado === 'vencidas' ? 'todos' : 'vencidas'"
        >
          ❌ Vencidas ({{ contadores.vencidas }})
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
      <p>No hay tareas {{ filtroEstado !== 'todos' ? filtroEstado : '' }} en {{ currentMonthLabel }}</p>
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

/* === HEADER CON SELECTOR DE MES Y FILTROS === */
.task-header {
  background: white;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

/* === SELECTOR DE MES === */
.month-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.month-nav-btn {
  background: #4f83cc;
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.month-nav-btn:hover {
  background: #3d6db5;
  transform: scale(1.05);
}

.month-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #1f2937;
  text-transform: capitalize;
  margin: 0;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.month-title:hover {
  background: #f3f4f6;
}

/* === FILTROS === */
.filters-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  justify-content: center;
  flex-wrap: wrap;
}

.filter-chip {
  background: transparent;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  padding: 0.45rem 0.9rem;
  font-size: 0.85rem;
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

body.dark .month-nav-btn {
  background: #3b82f6;
}

body.dark .month-nav-btn:hover {
  background: #2563eb;
}

body.dark .month-title {
  color: #f1f5f9;
}

body.dark .month-title:hover {
  background: #374151;
}

body.dark .filter-chip {
  border-color: #4b5563;
  color: #d1d5db;
}

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