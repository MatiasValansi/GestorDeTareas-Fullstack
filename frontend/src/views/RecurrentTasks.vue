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
          :custom-items="recurringTasks"
          detail-route="/recurringTaskDetail"
          :empty-state-title="emptyStateMessage"
        />
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
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%, #000000 100%);
  border-radius: 0 0 20px 20px;
  margin-bottom: 0;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: white;
  margin: 0 0 0.5rem 0;
}

.page-subtitle {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
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
  background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
}

body.dark .loading-state {
  color: #9ca3af;
}

body.dark .loading-state .spinner {
  border-color: #374151;
  border-top-color: #8b5cf6;
}
</style>