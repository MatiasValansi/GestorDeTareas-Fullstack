<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { getMyRecurringTasks } from '@/services/recurringTasks'
import TaskListView from '@/components/TaskListView.vue'

const store = useUserStore()

// Estado
const recurringTasks = ref([])
const cargando = ref(false)
const error = ref('')

// Filtro de estado: 'todas', 'activas', 'pausadas'
const filtroEstado = ref('todas')

// Cargar tareas recurrentes (el backend ya filtra según el rol del usuario)
const cargarRecurringTasks = async () => {
  cargando.value = true
  error.value = ''
  try {
    // El endpoint /my-tasks ya retorna las tareas filtradas según el rol:
    // - Usuario normal: solo las que tiene asignadas
    // - Supervisor: todas las de usuarios de su mismo sector
    recurringTasks.value = await getMyRecurringTasks()
  } catch (err) {
    error.value = 'Error al cargar tareas recurrentes'
    console.error('Error cargando recurring tasks:', err)
  } finally {
    cargando.value = false
  }
}

// Tareas filtradas según el estado seleccionado
const tareasFiltradas = computed(() => {
  if (filtroEstado.value === 'activas') {
    return recurringTasks.value.filter(t => t.active !== false)
  }
  if (filtroEstado.value === 'pausadas') {
    return recurringTasks.value.filter(t => t.active === false)
  }
  return recurringTasks.value
})

// Contadores para los filtros
const contadores = computed(() => ({
  total: recurringTasks.value.length,
  activas: recurringTasks.value.filter(t => t.active !== false).length,
  pausadas: recurringTasks.value.filter(t => t.active === false).length
}))

// Mensaje para estado vacío según el rol
const emptyStateMessage = computed(() => {
  if (store.isSupervisor) {
    return 'No hay tareas recurrentes asignadas a usuarios de su sector.'
  }
  return 'Su usuario aún no tiene tareas recurrentes asignadas.'
})

onMounted(async () => {
  await cargarRecurringTasks()
})
</script>



<template>
  <div class="app-container">
    <main class="main-content">
      <div class="tasks-content">
        <!-- Header de la vista -->
        <div class="recurrent-tasks-header">
          <h1 class="page-title">Tareas Recurrentes</h1>
          <p class="page-subtitle">
            {{ store.isSupervisor 
              ? 'Apartado de tareas del sector que se generan periódicamente' 
              : 'Apartado de tareas que se generan periódicamente asignadas a tu usuario' 
            }}
          </p>
        </div>

        <!-- Estado de carga -->
        <div v-if="cargando" class="loading-state">
          <div class="spinner"></div>
          <span>Cargando tareas recurrentes...</span>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="error-state">
          <span>{{ error }}</span>
        </div>

        <!-- Lista de tareas recurrentes usando TaskListView -->
        <TaskListView 
          v-else
          :hide-status-filters="true"
          mode="recurring"
          :custom-items="tareasFiltradas"
          detail-route="/recurringTaskDetail"
          :empty-state-title="emptyStateMessage"
        >
          <!-- Filtros personalizados para tareas recurrentes -->
          <template #custom-filters>
            <div class="filters-row recurring-filters">
              <button 
                class="filter-chip status-todas"
                :class="{ active: filtroEstado === 'todas' }"
                @click="filtroEstado = 'todas'"
              >
                Todas ({{ contadores.total }})
              </button>

              <button
                class="filter-chip status-activa"
                :class="{ active: filtroEstado === 'activas' }"
                @click="filtroEstado = filtroEstado === 'activas' ? 'todas' : 'activas'"
              >
                Activas ({{ contadores.activas }})
              </button>

              <button
                class="filter-chip status-pausada"
                :class="{ active: filtroEstado === 'pausadas' }"
                @click="filtroEstado = filtroEstado === 'pausadas' ? 'todas' : 'pausadas'"
              >
                Pausadas ({{ contadores.pausadas }})
              </button>
            </div>
          </template>
        </TaskListView>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
}

.main-content {
  padding: 0;
}

.tasks-content {
  min-height: 800px;
}

.recurrent-tasks-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #e8dff5 0%, #d4c4f0 100%);
  border-radius: 0 0 20px 20px;
  margin-bottom: 0;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #6b21a8;
  margin: 0 0 0.5rem 0;
}

.page-subtitle {
  font-size: 0.95rem;
  color: #7c3aed;
  margin: 0;
}

/* Estilos para filtros dentro del slot (usando :deep para penetrar el scoped) */
:deep(.recurring-filters) {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  padding: 0 0 0.5rem 0;
}

:deep(.recurring-filters .filter-chip) {
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
  transition: all 0.15s ease;
}

:deep(.recurring-filters .filter-chip:hover) {
  background: #f3f4f6;
  transform: translateY(-1px);
}

:deep(.recurring-filters .filter-chip.active) {
  transform: translateY(-1px) scale(1.05);
}

:deep(.recurring-filters .filter-chip.active:not(.status-activa):not(.status-pausada)) {
  background: #1f2937;
  color: white;
  border-color: #1f2937;
}

/* ACTIVAS */
:deep(.recurring-filters .filter-chip.status-activa.active) {
  background: #d1fae5;
  color: #065f46;
  border-color: #10b981;
}

/* PAUSADAS */
:deep(.recurring-filters .filter-chip.status-pausada.active) {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}

/* Hover en filtros activos */
:deep(.recurring-filters .filter-chip.active:hover) {
  filter: brightness(0.95);
}

/* Loading y Error states */
.loading-state,
.error-state {
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
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  color: #dc2626;
}

/* Dark mode */
body.dark .recurrent-tasks-header {
  background: linear-gradient(135deg, #4c1d95 0%, #5b21b6 100%);
}

body.dark .recurrent-tasks-header .page-title {
  color: white;
}

body.dark .recurrent-tasks-header .page-subtitle {
  color: rgba(255, 255, 255, 0.85);
}

:deep(body.dark .recurring-filters .filter-chip) {
  background: #1f2937;
  color: #f1f5f9;
  border-color: #374151;
}

:deep(body.dark .recurring-filters .filter-chip:hover) {
  box-shadow: 0 6px 14px rgba(0,0,0,0.6);
}

body.dark .loading-state {
  color: #9ca3af;
}

body.dark .loading-state .spinner {
  border-color: #374151;
  border-top-color: #8b5cf6;
}

body.dark .filter-chip.status-todas.active {
  background: #9e9e9e!important;
  border-color: #505050!important;
}

</style>