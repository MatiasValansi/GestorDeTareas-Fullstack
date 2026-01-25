<script setup>
import { ref, onMounted, computed, watch, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getCalendarTasks, updateTask } from '@/services/tasks'
import { getAllUsers, getUsersBySector } from '@/services/users'
import { calendarBus, CALENDAR_EVENTS } from '@/utils/calendar.bus.js'

const router = useRouter()
const store = useUserStore()

// Props para reutilización del componente
const props = defineProps({
  // Ocultar filtros de estado (TODAS, COMPLETADA, PENDIENTE, VENCIDA)
  hideStatusFilters: {
    type: Boolean,
    default: false
  },
  // Modo del componente: 'tasks' para tareas normales, 'recurring' para tareas recurrentes
  mode: {
    type: String,
    default: 'tasks',
    validator: (value) => ['tasks', 'recurring'].includes(value)
  },
  // Items personalizados (para pasar RecurringTasks externamente)
  customItems: {
    type: Array,
    default: null
  },
  // Ruta base para navegación al detalle
  detailRoute: {
    type: String,
    default: '/taskDetail'
  },
  // Título personalizado para estado vacío
  emptyStateTitle: {
    type: String,
    default: ''
  }
})

// Inyectar el mes del calendario desde App.vue
const globalMonth = inject('currentMonth', ref(new Date()))

// Inyectar el filtro de supervisor
const supervisorFilter = inject('supervisorFilter', ref('todas'))

// Inyectar filtro por usuario específico (para UserDetailView)
const filterUserId = inject('filterUserId', ref(null))

// Estado local
const tareas = ref([])
const usuarios = ref([])
const cargando = ref(false)
const error = ref("")

// Mes seleccionado (sincronizado con el calendario global)
const selectedMonth = ref(new Date(globalMonth.value))

// Filtros
const filtroEstado = ref('todos') // 'todos', 'completadas', 'pendientes', 'vencidas'
const searchQuery = ref('') // Buscador de tareas

// ============ COMPUTED ============

// Helper para verificar si el usuario está asignado a una tarea
const usuarioEstaEnTarea = (tarea) => {
  const userId = store.user?.id || store.user?._id
  if (!userId || !tarea.assignedTo) return false
  return tarea.assignedTo.some(assigned => {
    if (typeof assigned === 'object') {
      return (assigned._id || assigned.id) === userId
    }
    return assigned === userId
  })
}

// Helper para verificar si un usuario específico está asignado a una tarea
const usuarioEspecificoEstaEnTarea = (tarea, targetUserId) => {
  if (!targetUserId || !tarea.assignedTo) return false
  return tarea.assignedTo.some(assigned => {
    if (typeof assigned === 'object') {
      return (assigned._id || assigned.id) === targetUserId
    }
    return assigned === targetUserId
  })
}

// Remover caracteres de tachado combinante en títulos sin perder el texto
const sanitizeTitle = (title) => {
  if (title === null || title === undefined) return ''
  const original = typeof title === 'string' ? title : String(title)
  const cleaned = original.replace(/[\u0335\u0336\u0337\u0338]/g, '').trim()
  return cleaned.length > 0 ? cleaned : original
}

// Label del mes actual
const currentMonthLabel = computed(() => {
  return selectedMonth.value.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
})

// Items base: usa customItems si están proporcionados, sino usa tareas cargadas
const itemsBase = computed(() => {
  if (props.customItems !== null) {
    return props.customItems
  }
  return tareas.value
})

// Filtrar tareas por el mes seleccionado y filtro de supervisor
const tareasDelMes = computed(() => {
  // Si estamos en modo recurring con customItems, no filtramos por mes
  if (props.mode === 'recurring' && props.customItems !== null) {
    let filtered = [...itemsBase.value]
    
    // Si hay un filterUserId (vista de detalle de usuario), filtrar por ese usuario
    if (filterUserId.value) {
      filtered = filtered.filter(t => usuarioEspecificoEstaEnTarea(t, filterUserId.value))
    } else if (store.isSupervisor && supervisorFilter.value !== 'todas') {
      if (supervisorFilter.value === 'mias') {
        filtered = filtered.filter(t => usuarioEstaEnTarea(t))
      } else if (supervisorFilter.value === 'otros') {
        filtered = filtered.filter(t => !usuarioEstaEnTarea(t))
      }
    }
    
    return filtered
  }
  
  // Modo normal: filtrar por mes
  const month = selectedMonth.value.getMonth()
  const year = selectedMonth.value.getFullYear()
  
  let filtered = itemsBase.value.filter(t => {
    if (!t.date) return false
    const taskDate = new Date(t.date)
    return taskDate.getMonth() === month && taskDate.getFullYear() === year
  })
  
  // Si hay un filterUserId (vista de detalle de usuario), filtrar por ese usuario
  if (filterUserId.value) {
    filtered = filtered.filter(t => usuarioEspecificoEstaEnTarea(t, filterUserId.value))
  } else if (store.isSupervisor && supervisorFilter.value !== 'todas') {
    if (supervisorFilter.value === 'mias') {
      // Solo tareas donde el supervisor está asignado
      filtered = filtered.filter(t => usuarioEstaEnTarea(t))
    } else if (supervisorFilter.value === 'otros') {
      // Solo tareas donde el supervisor NO está asignado
      filtered = filtered.filter(t => !usuarioEstaEnTarea(t))
    }
  }
  
  return filtered
})

// Tareas filtradas por búsqueda y estado
const tareasFiltradas = computed(() => {
  let filtered = tareasDelMes.value
  
  // Filtrar por búsqueda
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(t => {
      const title = (t.title || t.titulo || '').toLowerCase()
      const description = (t.description || t.descripcion || '').toLowerCase()
      return title.includes(query) || description.includes(query)
    })
  }
  
  // Filtrar por estado (solo en modo tasks normal)
  if (props.mode === 'tasks') {
    if (filtroEstado.value === 'completadas') {
      filtered = filtered.filter(t => t.completada || t.status === 'COMPLETADA')
    } else if (filtroEstado.value === 'pendientes') {
      filtered = filtered.filter(t => !t.completada && t.status !== 'VENCIDA' && t.status !== 'COMPLETADA')
    } else if (filtroEstado.value === 'vencidas') {
      filtered = filtered.filter(t => t.status === 'VENCIDA')
    }
  }
  
  // Ordenar por fecha
  return filtered.sort((a, b) => new Date(a.date) - new Date(b.date))
})

// Contadores para los filtros (basados en tareas del mes)
const contadores = computed(() => ({
  total: tareasDelMes.value.length,
  completadas: tareasDelMes.value.filter(t => t.completada || t.status === 'COMPLETADA').length,
  pendientes: tareasDelMes.value.filter(t => !t.completada && t.status !== 'VENCIDA' && t.status !== 'COMPLETADA').length,
  vencidas: tareasDelMes.value.filter(t => t.status === 'VENCIDA').length
}))

// Limpiar búsqueda
const clearSearch = () => {
  searchQuery.value = ''
}

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

// Cargar usuarios - supervisor usa getAllUsers, usuario normal usa getUsersBySector
const cargarUsuarios = async () => {
  try {
    if (store.isSupervisor) {
      usuarios.value = await getAllUsers()
    } else {
      usuarios.value = await getUsersBySector()
    }
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

// ============ ACCIONES DE TAREA ============

// Set para rastrear tareas en proceso de actualización
const updatingTasks = ref(new Set())

// Marcar tarea como completada
const marcarComoCompletada = async (tarea, event) => {
  // Prevenir navegación al detalle
  event.stopPropagation()
  
  const taskId = tarea._id || tarea.id
  
  // Evitar múltiples clicks
  if (updatingTasks.value.has(taskId)) return
  
  try {
    updatingTasks.value.add(taskId)
    
    // Actualizar en el backend
    await updateTask(taskId, { 
      status: 'COMPLETADA',
      completed: true 
    })
    
    // Actualizar estado local inmediatamente
    const index = tareas.value.findIndex(t => (t._id || t.id) === taskId)
    if (index !== -1) {
      tareas.value[index] = {
        ...tareas.value[index],
        status: 'COMPLETADA',
        completada: true
      }
    }    
    await cargarTareas()
    console.log('EMIT refresh')
    calendarBus.emit(CALENDAR_EVENTS.REFRESH)
  } catch (err) {
    console.error('Error al marcar tarea como completada:', err)
    error.value = 'Error al actualizar la tarea'
    setTimeout(() => { error.value = '' }, 3000)
  } finally {
    updatingTasks.value.delete(taskId)
  }
}

// Verificar si una tarea está pendiente (no completada ni vencida)
const esTareaPendiente = (tarea) => {
  return !tarea.completada && tarea.status !== 'COMPLETADA' && tarea.status !== 'VENCIDA'
}

// Verificar si el usuario logueado está asignado a la tarea
const usuarioEstaAsignado = (tarea) => {
  const userId = store.user?.id || store.user?._id
  if (!userId || !tarea.assignedTo) return false
  
  return tarea.assignedTo.some(assigned => {
    // Si es un objeto populado
    if (typeof assigned === 'object') {
      return (assigned._id || assigned.id) === userId
    }
    // Si es un string (ID directo)
    return assigned === userId
  })
}

// Verificar si el usuario puede completar la tarea (pendiente + asignado)
const puedeCompletarTarea = (tarea) => {
  return esTareaPendiente(tarea) && usuarioEstaAsignado(tarea)
}

// ============ NAVEGACIÓN ============

const verDetalleTarea = (id) => {
  router.push(`${props.detailRoute}/${id}`)
}



// ============ LIFECYCLE ============

onMounted(async () => {
  // Solo cargar tareas si no se proporcionan customItems
  if (props.customItems === null) {
    await Promise.all([cargarTareas(), cargarUsuarios()])
  } else {
    // Solo cargar usuarios para mostrar nombres
    await cargarUsuarios()
  }
})

// Recargar tareas cuando cambia el mes (solo si no hay customItems)
watch(selectedMonth, () => {
  if (props.customItems === null) {
    cargarTareas()
  }
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
     
      <!-- Buscador de tareas -->
      <div class="search-container">
        <div class="search-input-wrapper">
          <input 
            type="text" 
            v-model="searchQuery"
            :placeholder="mode === 'recurring' ? 'Buscar tarea recurrente...' : 'Buscar tarea por nombre...'"
            class="search-input"
          />
          <button 
            v-if="searchQuery" 
            class="clear-search-btn"
            @click="clearSearch"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Slot para filtros personalizados (usado por RecurrentTasks) -->
      <slot name="custom-filters"></slot>
      
      <!-- Filtros de estado (ocultos si hideStatusFilters=true) -->
      <div v-if="!hideStatusFilters" class="filters-row">
        <button 
           class="filter-chip"
  :class="{
    active: filtroEstado === 'todos'
  }"
  @click="filtroEstado = 'todos'"
>
  Todas ({{ contadores.total }})
</button>

        <button
        class="filter-chip status-completada"
        :class="{ active: filtroEstado === 'completadas' }"
        @click="filtroEstado = filtroEstado === 'completadas' ? 'todos' : 'completadas'"
        >
        Completadas ({{ contadores.completadas }})
        </button>

        <button
        class="filter-chip status-pendiente"
        :class="{ active: filtroEstado === 'pendientes' }"
        @click="filtroEstado = filtroEstado === 'pendientes' ? 'todos' : 'pendientes'"
        >
        Pendientes ({{ contadores.pendientes }})
        </button>

        <button
        class="filter-chip status-vencida"
        :class="{ active: filtroEstado === 'vencidas' }"
        @click="filtroEstado = filtroEstado === 'vencidas' ? 'todos' : 'vencidas'"
        >
        Vencidas ({{ contadores.vencidas }})
        </button>
      </div>
    </div>
    
    <!-- Loading state -->
    <div v-if="cargando" class="loading-state">
      <div class="spinner"></div>
      <span>{{ mode === 'recurring' ? 'Cargando tareas recurrentes...' : 'Cargando tareas...' }}</span>
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
        <div 
          class="task-status-indicator" 
          :class="mode === 'recurring' ? (tarea.active !== false ? 'status-recurring-active' : 'status-recurring-inactive') : getStatusClass(tarea)"
        ></div>
        
        <!-- Contenido principal -->
        <div class="task-content">
          <!-- Fila superior: Estado/Periodicidad + Fecha -->
          <div class="task-top-row">
            <!-- Modo recurring: mostrar periodicidad -->
            <template v-if="mode === 'recurring'">
              <span class="task-periodicity-badge" :class="tarea.active !== false ? 'active' : 'inactive'">
                {{ tarea.periodicity }}
              </span>
              <span v-if="tarea.datePattern" class="task-date-pattern">
                {{ tarea.datePattern }}
              </span>
              <span v-else-if="tarea.numberPattern" class="task-date-pattern">
                Día {{ tarea.numberPattern }}
              </span>
            </template>
            <!-- Modo tasks: mostrar estado -->
            <template v-else>
              <span class="task-status-badge" :class="getStatusClass(tarea)">
                {{ getStatusLabel(tarea) }}
              </span>
              <span class="task-date">{{ formatFecha(tarea.date) }}</span>
            </template>
          </div>
          
          <!-- Título de la tarea -->
          <h3 class="task-title">{{ tarea.title }}</h3>
          
          <!-- Usuario asignado -->
          <p class="task-assignee">
            {{ getAssigneesNames(tarea.assignedTo) }}
          </p>

          <!-- Modo recurring: mostrar estado activo/inactivo -->
          <p v-if="mode === 'recurring'" class="task-recurring-status">
            <span :class="tarea.active !== false ? 'status-active-text' : 'status-inactive-text'">
              {{ tarea.active !== false ? '● Activa' : '○ Inactiva' }}
            </span>
          </p>
        </div>

        <!-- Switch para completar (solo en modo tasks, si está asignado y pendiente) -->
        <div 
          v-if="mode === 'tasks' && puedeCompletarTarea(tarea)" 
          class="task-complete-action"
          @click.stop
        >
          <label class="complete-switch" :class="{ 'is-loading': updatingTasks.has(tarea._id || tarea.id) }">
            <input 
              type="checkbox"
              :disabled="updatingTasks.has(tarea._id || tarea.id)"
              @change="marcarComoCompletada(tarea, $event)"
            />
            <span class="switch-slider"></span>
            <span class="switch-label">Completar</span>
          </label>
        </div>

        <!-- Leyenda si está pendiente pero no asignado (solo modo tasks) -->
        <div 
          v-else-if="mode === 'tasks' && esTareaPendiente(tarea) && !usuarioEstaAsignado(tarea)" 
          class="task-no-permission"
          @click.stop
        >
          <span class="no-permission-icon">🔒</span>
          <span class="no-permission-text">No asignado</span>
        </div>

        <!-- Flecha de navegación -->
        <div class="task-arrow">
          <span>›</span>
        </div>
      </div>
    </div>

    <!-- Estado vacío -->
    <div v-else class="empty-state">
      <div class="empty-icon">{{ searchQuery ? '🔍' : (mode === 'recurring' ? '' : '') }}</div>
      <p v-if="searchQuery">No se encontraron {{ mode === 'recurring' ? 'tareas recurrentes' : 'tareas' }} que coincidan con "{{ searchQuery }}"</p>
      <p v-else-if="emptyStateTitle">{{ emptyStateTitle }}</p>
      <p v-else-if="mode === 'recurring'">No hay tareas recurrentes disponibles</p>
      <p v-else>No hay tareas {{ filtroEstado !== 'todos' ? filtroEstado : '' }} en {{ currentMonthLabel }}</p>
      <button v-if="searchQuery" class="btn-clear-filters" @click="clearSearch">Limpiar búsqueda</button>
    </div>
  </main>
</template>

<style scoped>
/* === CONTENEDOR PRINCIPAL === */
.task-container {
  padding: 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 100%;
  /* height: 100%; */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 670px;
  border-radius: 12px;
}

/* === HEADER CON SELECTOR DE MES Y FILTROS === */
.task-header {
  background: transparent;
  padding: 1rem 1.5rem;
  flex-shrink: 0;
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
  font-size: 1.6rem;
  font-weight: 700;
  color: #1f2937;
  text-transform: capitalize;
  margin: 0;
  min-width: 240px;
  text-align: center;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.month-title:hover {
  background: #f3f4f6;
}

/* === BUSCADOR === */
.search-container {
  margin: 1rem 0;
  width: 100%;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.search-input-wrapper {
  display: flex;
  align-items: center; /* 🔥 esto sí centra vertical */
  position: relative;
}

.search-input {
  width: 100%;
  font-size: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 25px;
  background: #f9fafb;
  color: #1f2937;
  transition: all 0.2s ease;
  outline: none;
  text-align: left;
  height: 48px;
  padding: 0 2.5rem 0 0.75rem 1rem;
  line-height: 48px;
}

.search-input:focus {
  border-color: #4f83cc;
  background: white;
  box-shadow: 0 0 0 3px rgba(79, 131, 204, 0.15);
}

.search-input::placeholder {
  color: #9ca3af;
}

.clear-search-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-75%);

  width: 24px;
  height: 24px;

  background: #e5e7eb;
  border: none;
  border-radius: 50%;
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 0.75rem;
}

.clear-search-btn:hover {
  background: #d1d5db;
  color: #374151;
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
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
  background: #ffffff;
  border: 2px solid #d1d5db;
  border-radius: 999px;
  padding: 0.5rem 1.05rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;


}

.filter-chip:hover {
  background: #f3f4f6;
}



.filter-chip:hover {
  transform: translateY(-1px);
}

.filter-chip.active {

  transform: translateY(-1px) scale(1.05);
}

.filter-chip.active:not(.status-completada):not(.status-pendiente):not(.status-vencida) {
  background: #1f2937;
  color: white;
  border-color: #1f2937;
}

/* COMPLETADAS */
.filter-chip.status-completada.active {
  background: #d1fae5;
  color: #065f46;
  border-color: #10b981;
}

/* PENDIENTES */
.filter-chip.status-pendiente.active {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}

/* VENCIDAS */
.filter-chip.status-vencida.active {
  background: #fee2e2;
  color: #991b1b;
  border-color: #ef4444;
}

/* Hover */
.filter-chip.active:hover {
  filter: brightness(0.95);
}

body.dark .filter-chip {
  background: #1f2937;          /* fondo oscuro sólido */
  color: #f1f5f9;               /* texto claro */
  border-color: #374151;
}

body.dark .filter-chip:hover {
  box-shadow: 0 6px 14px rgba(0,0,0,0.6);
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
  gap: 0.5rem;
  padding: 0.75rem;
  flex: 1;             /* 🔑 ocupa TODO lo disponible */
  min-height: 0;
  overflow-y: auto;    /* 🔑 scroll real */
}

/* === ITEM DE TAREA === */
.task-item {
  display: flex;
  align-items: stretch;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 100px;
  overflow: visible;
}

.task-item:hover {
  background: #fafbfc;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
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
  padding: 0.6rem 1rem 0.6rem 1.2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  min-width: 0;
  overflow: hidden;
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
  font-size: 0.8rem;
  color: #6b7280;
}

/* === TÍTULO === */
.task-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
 
}

/* === USUARIO ASIGNADO === */
.task-assignee {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0;
}

.assignee-icon {
  font-size: 0.85rem;
}

/* === SWITCH COMPLETAR TAREA === */
.task-complete-action {
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  flex-shrink: 0;
}

.complete-switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  width: 44px;
  height: 24px;
  background: #d1d5db;
  border-radius: 24px;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.switch-slider::before {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.complete-switch input:checked + .switch-slider {
  background: #10b981;
}

.complete-switch input:checked + .switch-slider::before {
  transform: translateX(20px);
}

.complete-switch:hover .switch-slider {
  background: #9ca3af;
}

.complete-switch input:checked:hover + .switch-slider {
  background: #059669;
}

.switch-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
}

.complete-switch.is-loading .switch-slider::before {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* === INDICADOR NO ASIGNADO === */
.task-no-permission {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 0.75rem;
  gap: 0.15rem;
  flex-shrink: 0;
}

.no-permission-icon {
  font-size: 0.9rem;
  opacity: 0.7;
}

.no-permission-text {
  font-size: 0.65rem;
  font-weight: 500;
  color: #9ca3af;
  white-space: nowrap;
  text-align: center;
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

body.dark .empty-state {
  background-color: #1F2937;;
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

.btn-clear-filters {
  margin-top: 1rem;
  padding: 0.6rem 1.2rem;
  background: #4f83cc;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.btn-clear-filters:hover {
  background: #3d6db5;
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

/* Dark mode buscador */
body.dark .search-input {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

body.dark .search-input:focus {
  border-color: #3b82f6;
  background: #1f2937;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

body.dark .search-input::placeholder {
  color: #9ca3af;
}

body.dark .clear-search-btn {
  background: #4b5563;
  color: #d1d5db;
}

body.dark .clear-search-btn:hover {
  background: #6b7280;
  color: #f9fafb;
}

body.dark .btn-clear-filters {
  background: #3b82f6;
}

body.dark .btn-clear-filters:hover {
  background: #2563eb;
}

body.dark .filter-chip {
  border-color: #4b5563;
  color: #d1d5db;
}

body.dark .filter-chip:hover {
  background: #374151;
}

body.dark .filter-chip {
  border-color: #4b5563;
  color: #d1d5db;
}

/* SOLO el filtro "Todas" activo */
body.dark
.filter-chip.active:not(.status-completada):not(.status-pendiente):not(.status-vencida) {
  background: #e5e7eb;
  color: #1f2937;
  border-color: #e5e7eb;
}

body.dark .filter-chip.active {
  box-shadow:
    0 0 0 2px rgba(255,255,255,0.15),
    0 6px 18px rgba(0,0,0,0.6);
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
  text-decoration: none !important;
}

body.dark .task-date,
body.dark .task-assignee {
  color: #9ca3af;
}

body.dark .task-arrow {
  color: #6b7280;
}

/* Dark mode switch */
body.dark .switch-slider {
  background: #4b5563;
}

body.dark .complete-switch:hover .switch-slider {
  background: #6b7280;
}

body.dark .switch-label {
  color: #9ca3af;
}

/* Dark mode indicador no asignado */
body.dark .no-permission-text {
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

/* === ESTILOS MODO RECURRING === */

/* Indicador de estado para tareas recurrentes */
.task-status-indicator.status-recurring-active {
  background: #8b5cf6; /* violeta para activa */
}

.task-status-indicator.status-recurring-inactive {
  background: #6b7280; /* gris para inactiva */
}

/* Badge de periodicidad */
.task-periodicity-badge {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  background: #ede9fe;
  color: #7c3aed;
}

.task-periodicity-badge.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

body.dark .task-periodicity-badge {
  background: #4c1d95;
  color: #c4b5fd;
}

body.dark .task-periodicity-badge.inactive {
  background: #374151;
  color: #9ca3af;
}

/* Patrón de fecha (día de la semana o número) */
.task-date-pattern {
  font-size: 0.75rem;
  color: #6b7280;
  margin-left: 0.5rem;
  padding: 0.15rem 0.4rem;
  background: #f3f4f6;
  border-radius: 8px;
}

body.dark .task-date-pattern {
  background: #374151;
  color: #9ca3af;
}

/* Estado activo/inactivo de la tarea recurrente */
.task-recurring-status {
  margin: 0;
  font-size: 0.75rem;
}

.status-active-text {
  color: #10b981;
  font-weight: 600;
}

.status-inactive-text {
  color: #9ca3af;
  font-weight: 500;
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
    text-decoration: none !important;
  }


}
</style>
