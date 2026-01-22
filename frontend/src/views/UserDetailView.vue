<script setup>
import { ref, provide, onMounted, computed } from 'vue'

import CalendarView from '@/components/CalendarView.vue'
import TaskListView from '@/components/TaskListView.vue'
import DashboardStats from '@/components/DashboardStats.vue'
import GraficoTareas from '@/components/GraficoTareas.vue'
import { useUserStore } from '@/stores/user'
import TasksToolbar from '@/components/TasksToolbar.vue'
import { useRouter, useRoute } from 'vue-router'
import { getUserById } from '@/services/users.js'

const store = useUserStore()
const router = useRouter()
const route = useRoute()

/* Vista actual */
const viewMode = ref('calendario')

/* Estado compartido del calendario */
const currentMonth = ref(new Date())
provide('currentMonth', currentMonth)

/* Usuario a mostrar (obtenido de la URL) */
const displayedUser = ref(null)
const loadingUser = ref(true)
const errorUser = ref('')

/* ID del usuario para filtrar tareas */
const filterUserId = computed(() => route.params.id || null)
provide('filterUserId', filterUserId)

/* Cargar datos del usuario */
const cargarUsuario = async () => {
  loadingUser.value = true
  errorUser.value = ''
  try {
    const userId = route.params.id
    if (userId) {
      displayedUser.value = await getUserById(userId)
    }
  } catch (err) {
    console.error('Error al cargar usuario:', err)
    errorUser.value = 'Error al cargar información del usuario'
  } finally {
    loadingUser.value = false
  }
}

onMounted(() => {
  cargarUsuario()
})

const selectedCategory = ref('tareas')

const irANuevaVistaTarea = () => {
  router.push('/newTask')
}

</script>

<template>
  <div class="app-container">
    <main class="main-content">

      <!-- ENCABEZADO DEL USUARIO -->
      <div class="user-header">
        <div v-if="loadingUser" class="user-header-loading">
          <div class="spinner-small"></div>
          <span>Cargando usuario...</span>
        </div>
        <div v-else-if="errorUser" class="user-header-error">
          <span>{{ errorUser }}</span>
        </div>
        <div v-else-if="displayedUser" class="user-header-content">
          <h1 class="user-name">{{ displayedUser.nombre || displayedUser.name || 'Usuario' }}</h1>
          <p class="user-email">{{ displayedUser.email || 'Sin email' }}</p>
        </div>
      </div>
    
      <!-- CONTENIDO PRINCIPAL DE TAREAS -->
      <div class="tasks-content">

        <!-- TOOLBAR (MES + SWITCH + FILTRO SUPERVISOR) -->
        <TasksToolbar
          :currentMonth="currentMonth"
          :viewMode="viewMode"
          @update:month="currentMonth = $event"
          @update:view="viewMode = $event"
        />

        <!-- VISTA CALENDARIO -->
        <div v-show="viewMode === 'calendario'" class="view-container">
          <CalendarView />
        </div>

        <!-- VISTA LISTA -->
        <div v-show="viewMode === 'lista'" class="view-container">
          <TaskListView />
        </div>

      </div>
    </main>
  </div>
</template>
<style scoped>

/* ENCABEZADO DEL USUARIO */
.user-header {  
  box-shadow: 0 4px 15px rgba(79, 131, 204, 0.3);
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, #cfddf1 0%, #c4d0f0 100%);
  border-radius: 12px;
  margin-bottom: 1.5rem;
  max-height: 90px;
}

body.dark .user-header {
  background: linear-gradient(135deg, #1d3995 0%, #213cb6 100%);
  box-shadow: 0 4px 15px rgba(21, 32, 65, 0.5);
}

.user-header-loading,
.user-header-error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #374151;
  font-size: 1rem;
}

.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(55, 65, 81, 0.3);
  border-top-color: #374151;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.user-header-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.user-name {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: #2a21a8;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  translate: 0rem -1rem;
}

.user-email {
  margin: 0.5rem 0 0;
  font-size: 1rem;
  color: #565194;
  font-weight: 400;
  margin-top: 0rem;
  translate: 0rem -1rem;

}

.tasks-content {
  height: 800px;
}

body.dark .user-name{
  color: #ffffff;
}

body.dark .user-email{
  color: #d4d4d4;
}

</style>


