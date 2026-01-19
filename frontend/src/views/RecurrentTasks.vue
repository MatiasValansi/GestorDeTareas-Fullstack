<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { getAllRecurringTasks } from '@/services/recurringTasks'
import { getAllUsers } from '@/services/users'
import TaskListView from '@/components/TaskListView.vue'

const store = useUserStore()

// Estado
const recurringTasks = ref([])
const usuarios = ref([])
const cargando = ref(false)
const error = ref('')

// Cargar usuarios para obtener sectores
const cargarUsuarios = async () => {
  try {
    usuarios.value = await getAllUsers()
  } catch (err) {
    console.error('Error al cargar usuarios', err)
  }
}

// Obtener el sector del usuario actual
const getSectorUsuarioActual = () => {
  return store.user?.sector || null
}

// Verificar si el usuario logueado está asignado a una tarea recurrente
const usuarioEstaAsignado = (task) => {
  const userId = store.user?.id || store.user?._id
  if (!userId || !task.assignedTo) return false
  
  return task.assignedTo.some(assigned => {
    if (typeof assigned === 'object') {
      return (assigned._id || assigned.id) === userId
    }
    return assigned === userId
  })
}

// Verificar si algún usuario asignado pertenece al mismo sector del supervisor
const algunAsignadoMismoSector = (task, sectorSupervisor) => {
  if (!task.assignedTo || !sectorSupervisor) return false
  
  return task.assignedTo.some(assigned => {
    // Si está populado, obtener sector directamente
    if (typeof assigned === 'object' && assigned.sector) {
      return assigned.sector === sectorSupervisor
    }
    // Si es solo ID, buscar en la lista de usuarios
    const userId = typeof assigned === 'object' ? (assigned._id || assigned.id) : assigned
    const user = usuarios.value.find(u => (u._id || u.id) === userId)
    return user?.sector === sectorSupervisor
  })
}

// Filtrar tareas recurrentes según permisos:
// - Usuario normal: solo ve las que tiene asignadas
// - Supervisor: ve las propias + las de usuarios de su mismo sector
const recurringTasksFiltradas = computed(() => {
  const sectorActual = getSectorUsuarioActual()
  
  return recurringTasks.value.filter(task => {
    // Si el usuario está asignado, siempre puede ver la tarea
    if (usuarioEstaAsignado(task)) {
      return true
    }
    
    // Si es supervisor, puede ver tareas de usuarios del mismo sector
    if (store.isSupervisor && sectorActual) {
      return algunAsignadoMismoSector(task, sectorActual)
    }
    
    return false
  })
})

// Cargar tareas recurrentes
const cargarRecurringTasks = async () => {
  cargando.value = true
  error.value = ''
  try {
    const todas = await getAllRecurringTasks()
    recurringTasks.value = todas
  } catch (err) {
    error.value = 'Error al cargar tareas recurrentes'
    console.error('Error cargando recurring tasks:', err)
  } finally {
    cargando.value = false
  }
}

onMounted(async () => {
  // Cargar usuarios primero para tener la info de sectores
  await cargarUsuarios()
  // Luego cargar las tareas recurrentes
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
          :custom-items="recurringTasksFiltradas"
          detail-route="/recurringTaskDetail"
          empty-state-title="No hay tareas recurrentes disponibles para ti"
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