<script setup>
import { ref, onMounted, watch, provide, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import DashboardStats from './components/DashboardStats.vue'
import GraficoTareas from './components/GraficoTareas.vue'
import { useUserStore } from '@/stores/user'
import { getCalendarTasks } from '@/services/tasks'

const store = useUserStore()
const isLoggedIn = computed(() => store.isLoggedIn)
const MOCKAPI = 'https://685c760b769de2bf085ccc90.mockapi.io/taskapi/tasks'
const darkMode = ref(false)
const total = ref(0)
const completadas = ref(0)
const pendientes = ref(0)
const route = useRoute()
const router = useRouter()
const dashboardRef = ref()
provide('dashboardRef', dashboardRef)

// Calendar state
const currentMonth = ref(new Date())
const calendarTasks = ref([])
const loadingTasks = ref(false)

// Group tasks by date for calendar display
const tasksByDate = computed(() => {
  const grouped = {}
  calendarTasks.value.forEach(task => {
    const dateKey = new Date(task.deadline).toISOString().split('T')[0]
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(task)
  })
  // Sort tasks by time within each day
  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
  })
  return grouped
})

// Get tasks for a specific day
const getTasksForDay = (day) => {
  const dateKey = day.id // Format: YYYY-MM-DD
  return tasksByDate.value[dateKey] || []
}

// Get status color class
const getStatusColor = (status) => {
  switch (status) {
    case 'COMPLETADA':
      return 'task-completed'
    case 'PENDIENTE':
      return 'task-pending'
    case 'VENCIDA':
      return 'task-expired'
    default:
      return 'task-pending'
  }
}

// Get status label for tooltip
const getStatusLabel = (status) => {
  switch (status) {
    case 'COMPLETADA':
      return 'Completada'
    case 'PENDIENTE':
      return 'Pendiente'
    case 'VENCIDA':
      return 'Vencida'
    default:
      return status
  }
}

// Get assignees names for tooltip
const getAssigneesNames = (assignedTo) => {
  if (!assignedTo || assignedTo.length === 0) return 'Sin asignar'
  return assignedTo.map(user => user.name || user.email || 'Usuario').join(', ')
}

// Build tooltip for task (includes recurring info)
const getTaskTooltip = (task) => {
  let tooltip = `${task.title}\nAsignados: ${getAssigneesNames(task.assignedTo)}\nEstado: ${getStatusLabel(task.status)}`
  if (task.recurringTaskId) {
    tooltip += '\nTarea recurrente'
  }
  return tooltip
}

// Format time from deadline
const formatTime = (deadline) => {
  const date = new Date(deadline)
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

// Load calendar tasks
const loadCalendarTasks = async () => {
  if (!isLoggedIn.value) return
  
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

const currentMonthLabel = computed(() => {
  return currentMonth.value.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
})

const cargarEstadisticas = async () => {
  try {
    const res = await axios.get(MOCKAPI)
    const tareas = res.data
    total.value = tareas.length
    completadas.value = tareas.filter(t => t.completada).length
    pendientes.value = tareas.filter(t => !t.completada).length
  } catch (err) {
    console.error('Error al cargar estadísticas', err)
  }
}

const toggleDarkMode = () => {
  darkMode.value = !darkMode.value
  document.body.classList.toggle('dark', darkMode.value)
}

const logout = () => {
  store.logout()
  router.push('/login')
}

onMounted(() => {
  if (localStorage.getItem('dark') === 'true') {
    darkMode.value = true
    document.body.classList.add('dark')
  }
  cargarEstadisticas()
  loadCalendarTasks()
})

watch(darkMode, (value) => {
  localStorage.setItem('dark', value)
})

// Reload calendar tasks when month changes
watch(currentMonth, () => {
  loadCalendarTasks()
})

// Reload calendar tasks when user logs in
watch(isLoggedIn, (newValue) => {
  if (newValue) {
    loadCalendarTasks()
  }
})
</script>

<template>
  <div v-if="isLoggedIn">
    <!-- 🔐 BARRA DE USUARIO -->
    <div class="user-bar">
      <div class="user-info">
        <span class="login-alert">
          🔐 Logueado como: <strong>{{ store.user.email }}</strong>
        </span>
        <span class="login-role">
          Permisos de
          <strong>{{ store.isSupervisor ? 'Supervisor' : 'Usuario' }}</strong>
        </span>
      </div>

      <div class="top-buttons">
        <button class="toggle-button" @click="toggleDarkMode">
          {{ darkMode ? '☀️ Claro' : '🌙 Oscuro' }}
        </button>
        <button class="toggle-button danger" @click="logout">
          🔓 Cerrar sesión
        </button>
      </div>
    </div>


    <!-- ✅ HEADER: LOGO Y NAVBAR SOBRIO -->
    <header class="header-bar">
      <div class="header-inner">
        <div class="header-top">
          <div class="logo-container">
            <img src="/logo.png" alt="Logo" class="logo-title" />
          </div>

          <nav class="navbar">
            <RouterLink to="/" class="nav-button" :class="{ active: route.path === '/' }">Inicio</RouterLink>
            <RouterLink to="/task" class="nav-button" :class="{ active: route.path === '/task' }">Ver Tareas</RouterLink>
            <RouterLink
              v-if="store.isSupervisor"
              to="/users"
              class="nav-button"
              :class="{ active: route.path === '/users' }"
            >
              Ver Usuarios
            </RouterLink>
          </nav>
        </div>
      </div>
    </header>

    <!-- Calendar Section - FUERA del contenedor limitado -->
    <div v-if="route.path === '/'" class="calendar-wrapper">
      <!-- Calendar Section -->
      <div class="calendar-section">
        <div class="calendar-header">
          <button class="calendar-nav-btn" @click="prevMonth">◀</button>
          <h3 class="calendar-title">{{ currentMonthLabel }}</h3>
          <button class="calendar-nav-btn" @click="nextMonth">▶</button>
        </div>
        <VCalendar
          :key="currentMonth.toISOString()"
          :initial-page="{ month: currentMonth.getMonth() + 1, year: currentMonth.getFullYear() }"
          :rows="1"
          :columns="1"
          expanded
          borderless
          transparent
          :nav-visibility="'hidden'"
          title-position="left"
          class="custom-calendar"
          :first-day-of-week="1"
        >
          <template #day-content="{ day }">
            <div class="day-content-wrapper">
              <span class="day-number">{{ day.day }}</span>
              <div class="day-tasks" v-if="!day.isDisabled">
                <div
                  v-for="task in getTasksForDay(day)"
                  :key="task._id"
                  class="calendar-task"
                  :class="getStatusColor(task.status)"
                  :title="getTaskTooltip(task)"
                >
                  <span class="task-time">{{ formatTime(task.deadline) }}</span>
                  <span class="task-title">{{ task.title }}</span>
                </div>
              </div>
            </div>
          </template>
        </VCalendar>
        <div v-if="loadingTasks" class="calendar-loading">
          Cargando tareas...
        </div>
      </div>
    </div>

    <div class="app-container">
      <main class="main-content">
        <RouterView />
      </main>

      <div v-if="route.path === '/'">
        <div v-if="store.isSupervisor">
          <h2>📊 Estadísticas Generales</h2>
          <DashboardStats />
          <GraficoTareas />
        </div>
        <div v-else>
          <h2>Bienvenido, {{ store.user.name || store.user.nombre }}</h2>
          <p class="rol-alert">
            Estás logueado como <strong>Usuario</strong>. No tenés acceso a las estadísticas del inicio.
          </p>
        </div>
      </div>
    </div>
  </div>

  <div v-else>
    <RouterView />
  </div>

  <footer class="app-footer">
  <div class="footer-content">
    <p>&copy; {{ new Date().getFullYear() }} Gestor de Tareas - Desarrollado por Lucio Giraldez y Matías Valansi</p>
    
    <p><a href="https://github.com/lucioGiraldez/PNT2TrabajoFinal" target="_blank" rel="noopener" class="footer-link">
      🌐 GitHub 
    </a>- Tecnologías Usadas: Vue.js, Pinia, LocalStorage, Axios, VueChart.js, Email.Js</p>     
  </div>
</footer>

</template>


<style>
body {
  background-color: #f4f4f2;
  color: #1f2937;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.header-bar {
  width: 100%;
  background-color: transparent;
  padding: 1.5rem 1rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-inner {
  background-color: transparent;
  border: none;
  box-shadow: none;
  padding-bottom: 3rem;
  position: relative;
}

.header-inner::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px; /* más fino */
  background: linear-gradient(to bottom, rgba(79, 131, 204, 0.1), transparent); /* menos opacidad */
  pointer-events: none;
}

body.dark .header-inner::after {
  background: linear-gradient(to bottom, rgba(96, 165, 250, 0.1), transparent); /* más suave */
}

.header-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
}

.logo-container {
  display: flex;
  justify-content: center;
  width: 100%;
}

.logo-title {
  width: 240px;
  object-fit: contain;
}

/* === NAVBAR === */
.navbar {
  display: flex;
  justify-content: center;
  gap: 1.2rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.nav-button {
  background-color: #4f83cc;
  color: white;
  padding: 0.7rem 1.5rem;
  border-radius: 9999px;
  font-weight: 600;
  text-decoration: none;
  font-size: 1rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.nav-button:hover {
  background-color: #3d6db5;
  transform: translateY(-1px);
}

.nav-button.active {
  background-color: #22c55e;
  color: white;
}

.user-bar {
  width: 100%;
  padding: 0.6rem 2rem;
  background-color: rgba(240, 239, 239, 0.87);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

body.dark .user-bar {
  background-color: rgba(12, 21, 44, 0.7);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.88rem;
}


.login-alert {
  font-size: 0.9rem;
  color: #1f2937;
}

.login-role {
  font-size: 0.85rem;
  color: #1f2937;
  margin-left: 1.5rem; /* opcional si querés alinearlo un poco a la derecha */
}

body.dark .login-alert,
body.dark .login-role {
  color: #e0d7d7;
}


.top-buttons {
  display: flex;
  gap: 0.5rem;
}

.toggle-button {
  background-color: #4f83cc;
  color: white;
  border: none;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.85rem;
  transition: background-color 0.3s ease;
}

.toggle-button:hover {
  background-color: #3d6db5;
}

.toggle-button.danger {
  background-color: #e16060;
}

.toggle-button.danger:hover {
  background-color: #c84c4c;
}

/* === CONTENIDO === */
.app-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.main-content {
  animation: fadeIn 0.6s ease-in-out;
}

h2 {
  margin-top: 2rem;
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
}

/* === MODO OSCURO === */
body.dark {
  background-color: #111827;
  color: #f9fafb;
}

body.dark .header-inner {
  background-color: transparent;
  box-shadow: none;
  border: none;
}

body.dark .nav-button {
  background-color: #374151;
  color: #f9fafb;
}

body.dark .nav-button:hover {
  background-color: #4b5563;
}

body.dark .nav-button.active {
  background-color: #22c55e;
  color: white;
}

body.dark .toggle-button {
  background-color: #334155;
  color: #f1f5f9;
}

body.dark .toggle-button:hover {
  background-color: #475569;
}

body.dark .toggle-button.danger {
  background-color: #f87171;
}

body.dark .toggle-button.danger:hover {
  background-color: #ef4444;
}

body.dark h2 {
  color: #ffffff;
}

/* === ANIMACIÓN === */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.app-footer {
  margin-top: 3rem;
  padding: 1rem;
  text-align: center;
  font-size: 0.95rem;
  color: #4b5563;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
}

.footer-content {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: center;
  justify-content: center;
}

.footer-link {
  color: #4f83cc;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}

.footer-link:hover {
  color: #3d6db5;
}

/* 🌙 Dark mode compatible */
body.dark .app-footer {
  background-color: #1f2937;
  color: #d1d5db;
  border-top: 1px solid #374151;
}

body.dark .footer-link {
  color: #60a5fa;
}

body.dark .footer-link:hover {
  color: #93c5fd;
}

/* === CALENDAR WRAPPER - 70% WIDTH === */
.calendar-wrapper {
  width: 70%;
  margin: 0 auto 2rem auto;
  padding: 0;
}

/* === CALENDAR LOADING === */
.calendar-loading {
  text-align: center;
  padding: 1rem;
  color: #6b7280;
  font-style: italic;
}

/* === CALENDAR STYLES === */
.calendar-section {
  width: 100% !important;
  max-width: none !important;
  margin: 1rem 0;
  padding: 1.5rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding: 0 1rem;
}

.calendar-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  text-transform: capitalize;
  margin: 0;
}

.calendar-nav-btn {
  background: #4f83cc;
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.calendar-nav-btn:hover {
  background: #3d6db5;
  transform: scale(1.05);
}

.custom-calendar {
  width: 100% !important;
  --vc-day-content-width: 100% !important;
  --vc-day-content-height: 100% !important;
}

/* Dark mode calendar */
body.dark .calendar-section {
  background: #1e293b;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

body.dark .calendar-title {
  color: #f1f5f9;
}

body.dark .calendar-nav-btn {
  background: #3b82f6;
}

body.dark .calendar-nav-btn:hover {
  background: #2563eb;
}

/* VCalendar FULL override */
.custom-calendar .vc-container,
.custom-calendar.vc-container {
  width: 100% !important;
  max-width: 100% !important;
  --vc-bg: transparent !important;
  --vc-border: none !important;
}

/* Hide native header */
.custom-calendar .vc-header,
.custom-calendar .vc-title {
  display: none !important;
}

/* Weeks container */
.custom-calendar .vc-weeks {
  padding: 0 !important;
  width: 100% !important;
}

/* Weekday headers - días de la semana */
.custom-calendar .vc-weekdays {
  padding: 0 !important;
}

.custom-calendar .vc-weekday {
  font-size: 1.2rem !important;
  font-weight: 700 !important;
  padding: 1.2rem 0 !important;
  color: #374151 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  background: #f3f4f6 !important;
  border: 1px solid #e5e7eb !important;
}

/* === DÍAS - RECTANGULARES Y PROPORCIONALES === */
.custom-calendar .vc-day {
  min-height: 106px !important;
  height: 106px !important;
  min-width: 0 !important;
  padding: 0 !important;
  border: 1px solid #d1d5db !important;
  background: #ffffff !important;
  position: relative !important;
  overflow: hidden !important;
  transition: all 0.15s ease !important;
}

.custom-calendar .vc-day:hover {
  background: #f0f7ff !important;
  border-color: #4f83cc !important;
  box-shadow: inset 0 0 0 3px rgba(79, 131, 204, 0.25) !important;
}

/* === CONTENIDO DEL DÍA CON TAREAS === */
.day-content-wrapper {
  width: 100%;
  height: 100%;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.day-number {
  font-size: 0.9rem;
  font-weight: 700;
  color: #374151;
  margin-bottom: 2px;
}

.day-tasks {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Scrollbar sutil para tareas */
.day-tasks::-webkit-scrollbar {
  width: 3px;
}

.day-tasks::-webkit-scrollbar-track {
  background: transparent;
}

.day-tasks::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

/* === TAREA INDIVIDUAL EN CALENDARIO === */
.calendar-task {
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.65rem;
  line-height: 1.2;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s ease;
  border-left: 3px solid;
}

.calendar-task:hover {
  transform: scale(1.02);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.task-time {
  font-weight: 600;
  opacity: 0.8;
  flex-shrink: 0;
}

.task-title {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* === COLORES POR ESTADO === */
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

/* === DÍA ACTUAL === */
.custom-calendar .vc-day.is-today .day-number {
  background: #4f83cc;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

/* === DÍA CLICKEABLE - OCUPA TODO === */
.custom-calendar .vc-day-content {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 100% !important;
  min-height: 100% !important;
  border-radius: 0 !important;
  display: flex !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
  padding: 0 !important;
  font-size: 1.2rem !important;
  font-weight: 700 !important;
  color: #374151 !important;
  cursor: pointer !important;
  transition: background 0.15s ease !important;
  background: transparent !important;
}

.custom-calendar .vc-day-content:hover {
  background: rgba(79, 131, 204, 0.05) !important;
}

.custom-calendar .vc-day-content:focus {
  outline: none !important;
  background: rgba(79, 131, 204, 0.15) !important;
}

/* Día actual */
.custom-calendar .vc-day.is-today {
  background: #e8f4fd !important;
}

.custom-calendar .vc-day.is-today .vc-day-content {
  color: #1e40af !important;
  font-weight: 800 !important;
}

/* Highlight del día actual */
.custom-calendar .vc-day.is-today .vc-highlights {
  display: none !important;
}

/* Días de otros meses - GRISES Y NO INTERACTIVOS */
.custom-calendar .vc-day.is-not-in-month {
  background: #e5e7eb !important;
  pointer-events: none !important;
  opacity: 0.5 !important;
}

.custom-calendar .vc-day.is-not-in-month:hover {
  background: #e5e7eb !important;
  border-color: #d1d5db !important;
  box-shadow: none !important;
}

.custom-calendar .vc-day.is-not-in-month .vc-day-content {
  color: #9ca3af !important;
  font-weight: 400 !important;
  cursor: default !important;
  pointer-events: none !important;
}

.custom-calendar .vc-day.is-not-in-month .vc-day-content:hover {
  background: transparent !important;
}

/* Espacio para tareas */
.custom-calendar .vc-day-box-center-bottom {
  position: absolute !important;
  top: 50px !important;
  left: 10px !important;
  right: 10px !important;
  bottom: 10px !important;
  width: auto !important;
  overflow-y: auto !important;
  padding: 4px !important;
}

/* Ocultar highlights por defecto */
.custom-calendar .vc-highlights {
  z-index: 0 !important;
}

/* === DARK MODE === */
body.dark .custom-calendar .vc-weekday {
  color: #e5e7eb !important;
  background: #334155 !important;
  border-color: #475569 !important;
}

body.dark .custom-calendar .vc-day {
  border-color: #475569 !important;
  background: #1e293b !important;
}

body.dark .custom-calendar .vc-day:hover {
  background: #2d3a4f !important;
  border-color: #3b82f6 !important;
}

body.dark .custom-calendar .vc-day-content {
  color: #e5e7eb !important;
}

body.dark .custom-calendar .vc-day-content:hover {
  background: rgba(59, 130, 246, 0.1) !important;
}

body.dark .custom-calendar .vc-day.is-today {
  background: #1e3a5f !important;
}

body.dark .custom-calendar .vc-day.is-today .vc-day-content {
  color: #60a5fa !important;
}

/* Dark mode - Day number */
body.dark .day-number {
  color: #e5e7eb;
}

body.dark .custom-calendar .vc-day.is-today .day-number {
  background: #3b82f6;
  color: white;
}

/* Dark mode - Task colors */
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

/* Dark mode - Scrollbar */
body.dark .day-tasks::-webkit-scrollbar-thumb {
  background: #475569;
}

/* Dark mode - Días de otros meses - GRISES Y NO INTERACTIVOS */
body.dark .custom-calendar .vc-day.is-not-in-month {
  background: #1a1f2e !important;
  pointer-events: none !important;
  opacity: 0.4 !important;
}

body.dark .custom-calendar .vc-day.is-not-in-month .vc-day-content {
  color: #4b5563 !important;
  cursor: default !important;
}

body.dark .custom-calendar .vc-container,
body.dark .custom-calendar.vc-container {
  --vc-bg: transparent !important;
  --vc-color: #f1f5f9 !important;
  --vc-gray-100: #334155 !important;
  --vc-gray-200: #475569 !important;
  --vc-gray-400: #94a3b8 !important;
  --vc-gray-500: #64748b !important;
  --vc-gray-600: #cbd5e1 !important;
  --vc-gray-700: #e2e8f0 !important;
  --vc-gray-800: #f1f5f9 !important;
  --vc-gray-900: #f8fafc !important;
}
</style>