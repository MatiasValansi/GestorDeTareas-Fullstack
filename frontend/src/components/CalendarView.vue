<script setup>
import { ref, computed, watch, inject, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getCalendarTasks } from '@/services/tasks'
import { ArgentinaTime } from '@/utils/argentinaTime'
import { calendarBus, CALENDAR_EVENTS } from '@/utils/calendar.bus.js'

const router = useRouter()
const store = useUserStore()

// Estado compartido desde App.vue
const currentMonth = inject('currentMonth')

// Inyectar el filtro de supervisor
const supervisorFilter = inject('supervisorFilter', ref('todas'))

// Inyectar filtro por usuario específico (para UserDetailView)
const filterUserId = inject('filterUserId', ref(null))

// Estado local
const calendarTasks = ref([])
const loadingTasks = ref(false)


// Escuchar evento de recarga del calendario
const onRefreshCalendar = () => {
  console.log('RECEIVED refresh')
  loadCalendarTasks()
}

onMounted(() => {
  calendarBus.on(CALENDAR_EVENTS.REFRESH, onRefreshCalendar)
})

onUnmounted(() => {
  calendarBus.off(CALENDAR_EVENTS.REFRESH, onRefreshCalendar)
})

// ================== HELPERS ==================

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

// ================== COMPUTED ==================

const tasksByDate = computed(() => {
  // Aplicar filtro de supervisor antes de agrupar
  let filtered = calendarTasks.value
  
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
  
  const grouped = {}
  filtered.forEach(task => {
    // Usar hora Argentina para determinar el día correcto
    const dateKey = ArgentinaTime.getDateKey(task.date)
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(task)
  })
  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) => new Date(a.date) - new Date(b.date))
  })
  return grouped
})

const currentMonthLabel = computed(() => {
  return currentMonth.value.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
})

const getTasksForDay = (day) => {
  const dateKey = day.id
  return tasksByDate.value[dateKey] || []
}

const getStatusColor = (task) => {
  switch (task.status) {
    case 'COMPLETADA': return 'task-completed'
    case 'VENCIDA': return 'task-expired'
    default: return 'task-pending'
  }
}

const getStatusLabel = (task) => {
  switch (task.status) {
    case 'COMPLETADA': return 'Completada'
    case 'VENCIDA': return 'Vencida'
    default: return 'Pendiente'
  }
}

const getAssigneesNames = (assignedTo) => {
  if (!assignedTo || assignedTo.length === 0) return 'Sin asignar'
  return assignedTo.map(user => user.name || user.email || 'Usuario').join(', ')
}

const getTaskTooltip = (task) => {
  let tooltip = `${task.title}\nAsignados: ${getAssigneesNames(task.assignedTo)}\nEstado: ${getStatusLabel(task)}`
  if (task.recurringTaskId) tooltip += '\nTarea recurrente'
  return tooltip
}

const formatTime = (date) => ArgentinaTime.formatTime(date)

const goToTaskDetail = (taskId) => router.push(`/taskDetail/${taskId}`)

// ================== NAVIGATION ==================

const prevMonth = () => {
  const newDate = new Date(currentMonth.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentMonth.value = newDate
}

const nextMonth = () => {
  const newDate = new Date(currentMonth.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentMonth.value = newDate
}

// ================== DATA ==================

const loadCalendarTasks = async () => {
  loadingTasks.value = true
  try {
    const month = currentMonth.value.getMonth() + 1
    const year = currentMonth.value.getFullYear()
    calendarTasks.value = await getCalendarTasks(month, year)
  } catch (error) {
    console.error('Error al cargar tareas del calendario:', error)
    calendarTasks.value = []
  } finally {
    loadingTasks.value = false
  }
}

watch(currentMonth, () => loadCalendarTasks(), { immediate: true })

// // Asegurar carga al montar el componente
// onMounted(() => {
//   loadCalendarTasks()
// })
</script>

<template>
  <div class="calendar-component">
    <!-- HEADER CUSTOM -->

    <!-- LOADING -->
    <div v-if="loadingTasks" class="calendar-loading-overlay">
      <div class="spinner"></div>
      <span class="loading-text">Cargando tareas...</span>
    </div>

    <!-- VCALENDAR -->
    <VCalendar
      :key="currentMonth.toISOString()"
      :initial-page="{ month: currentMonth.getMonth() + 1, year: currentMonth.getFullYear() }"
      expanded
      borderless
      transparent
      :masks="{ weekdays: 'WWW' }"
      class="custom-vcalendar"
      :first-day-of-week="2"
    >
      <template #day-content="{ day }">
        <div class="day-cell">
          <span class="day-label" :class="{ 'is-today': day.isToday }">{{ day.day }}</span>
          <div class="day-tasks">
            <div
              v-for="task in getTasksForDay(day)"
              :key="task._id || task.id"
              class="task-item"
              :class="getStatusColor(task)"
              :title="getTaskTooltip(task)"
              @click.stop="goToTaskDetail(task._id || task.id)"
            >
              <span class="task-time">{{ formatTime(task.date) }}</span>
              <span class="task-name">{{ task.title }}</span>
            </div>
          </div>
        </div>
      </template>
    </VCalendar>
  </div>
</template>

<style>
/* ========================================
   CALENDAR COMPONENT - FULL WIDTH
======================================== */
.calendar-component {
  width: 100%;
  height: 100%;
  padding: 1rem 1rem 1.5rem 1rem;
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* ========================================
   CUSTOM HEADER
======================================== */
.calendar-header {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.calendar-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: #1f2937;
  text-transform: capitalize;
  margin: 0;
  min-width: 240px;
  text-align: center;
}

.calendar-nav-btn {
  background: #4f83cc;
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.calendar-nav-btn:hover {
  background: #3d6db5;
  transform: scale(1.05);
}

/* ========================================
   LOADING OVERLAY
======================================== */
.calendar-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 16px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e5e7eb;
  border-top: 4px solid #4f83cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 1rem;
  color: #6b7280;
  font-size: 1rem;
  font-weight: 500;
}

/* ========================================
   VCALENDAR OVERRIDES (v3)
======================================== */
.custom-vcalendar {
  width: 100% !important;
  max-width: 100% !important;
  --vc-font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Hide native header completely */
.custom-vcalendar .vc-header {
  display: none !important;
}

/* Container */
.custom-vcalendar .vc-pane-container {
  width: 100% !important;
}

.custom-vcalendar .vc-pane {
  width: 100% !important;
}

/* Weekday headers */
.custom-vcalendar .vc-weekdays {
  padding: 0 !important;
  border-bottom: 2px solid #e5e7eb;
}

.custom-vcalendar .vc-weekday {
  font-size: 0.85rem !important;
  font-weight: 700 !important;
  padding: 0.6rem 0 !important;
  color: #374151 !important;
  text-transform: uppercase !important;
  background: #f3f4f6 !important;
}

/* Days grid */
.custom-vcalendar .vc-weeks {
  padding: 0 !important;
  width: 100% !important;
}

/* Each day cell - FIXED HEIGHT */
  .custom-vcalendar .vc-day {
    height: 105px !important;
    min-height: 105px !important;
    max-height: 105px !important;
  border: 1px solid #e5e7eb !important;
  background: white !important;
  position: relative !important;
  overflow: hidden !important;
}

.custom-vcalendar .vc-day:hover {
  background: #f8fafc !important;
}

/* Day content slot wrapper */
.custom-vcalendar .vc-day-content {
  width: 100% !important;
  height: 100% !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  padding: 0 !important;
  display: block !important;
  background: transparent !important;
  border-radius: 0 !important;
  font-weight: normal !important;
}

.custom-vcalendar .vc-day-content:hover {
  background: transparent !important;
}

.custom-vcalendar .vc-day-content:focus {
  outline: none !important;
  background: transparent !important;
}

/* Hide default highlights */
.custom-vcalendar .vc-highlights {
  display: none !important;
}

/* Days not in current month */
.custom-vcalendar .vc-day.is-not-in-month {
  background: #f1f5f9 !important;
  opacity: 0.5;
}

.custom-vcalendar .vc-day.is-not-in-month .day-label {
  color: #9ca3af !important;
}

/* Today */
.custom-vcalendar .vc-day.is-today {
  background: #eff6ff !important;
}

/* ========================================
   DAY CELL CONTENT
======================================== */
  .day-cell {
    width: 100%;
    height: 97px;
    max-height: 97px;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
}

  .day-label {
    font-size: 0.85rem;
    font-weight: 700;
    color: #374151;
    margin-bottom: 1px;
    display: inline-block;
}

.day-label.is-today {
  background: #4f83cc;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
}

.day-tasks {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.day-tasks::-webkit-scrollbar {
  width: 4px;
}

.day-tasks::-webkit-scrollbar-track {
  background: transparent;
}

.day-tasks::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

/* ========================================
   TASK ITEMS
======================================== */
  .task-item {
    padding: 1px 2px;
    margin-bottom: 1px;
    border-radius: 3px;
    font-size: 0.7rem;
    line-height: 1.2;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 2px;
    border-left: 3px solid;
    transition: all 0.15s ease;
}

.task-item:hover {
  filter: brightness(0.95);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.task-time {
  font-weight: 700;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.task-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Task status colors */
.task-completed {
  background: #d1fae5;
  color: #065f46;
  border-color: #10b981;
}

.task-pending {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}

.task-expired {
  background: #fee2e2;
  color: #991b1b;
  border-color: #ef4444;
}

/* ========================================
   DARK MODE
======================================== */
body.dark .calendar-title {
  color: #f1f5f9;
}

body.dark .calendar-nav-btn {
  background: #3b82f6;
}

body.dark .calendar-nav-btn:hover {
  background: #2563eb;
}

body.dark .calendar-loading-overlay {
  background: rgba(30, 41, 59, 0.95);
}

body.dark .spinner {
  border-color: #374151;
  border-top-color: #60a5fa;
}

body.dark .loading-text {
  color: #9ca3af;
}

body.dark .custom-vcalendar .vc-weekday {
  color: #e5e7eb !important;
  background: #334155 !important;
}

body.dark .custom-vcalendar .vc-weekdays {
  border-color: #475569;
}

body.dark .custom-vcalendar .vc-day {
  border-color: #475569 !important;
  background: #1e293b !important;
}

body.dark .custom-vcalendar .vc-day:hover {
  background: #334155 !important;
}

body.dark .custom-vcalendar .vc-day.is-not-in-month {
  background: #0f172a !important;
}

body.dark .custom-vcalendar .vc-day.is-today {
  background: #1e3a5f !important;
}

body.dark .day-label {
  color: #e5e7eb;
}

body.dark .day-label.is-today {
  background: #3b82f6;
  color: white;
}

body.dark .day-tasks::-webkit-scrollbar-thumb {
  background: #475569;
}

body.dark .task-completed {
  background: #064e3b;
  color: #a7f3d0;
  border-color: #10b981;
}

body.dark .task-pending {
  background: #78350f;
  color: #fde68a;
  border-color: #f59e0b;
}

body.dark .task-expired {
  background: #7f1d1d;
  color: #fecaca;
  border-color: #ef4444;
}
</style>
