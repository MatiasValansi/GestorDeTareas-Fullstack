<script setup>
import { ref, provide } from 'vue'

import CalendarView from '@/components/CalendarView.vue'
import TaskListView from '@/components/TaskListView.vue'
import DashboardStats from '@/components/DashboardStats.vue'
import GraficoTareas from '@/components/GraficoTareas.vue'
import { useUserStore } from '@/stores/user'
import TasksToolbar from '@/components/TasksToolbar.vue'
import { useRouter } from 'vue-router'

const store = useUserStore()
const router = useRouter()

/* Vista actual */
const viewMode = ref('calendario')

/* Estado compartido del calendario */
const currentMonth = ref(new Date())
provide('currentMonth', currentMonth)


const selectedCategory = ref('tareas')

const irANuevaVistaTarea = () => {
  router.push('/newTask')
}

// const userToBeDisplayed = UserRepository.getUserById(store.user.id);

</script>

<template>

  <span class="text">
    {{  }}
  </span>
  <div class="app-container">
    <main class="main-content">

    
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

  .tasks-content {
    height: 800px;
  }

</style>


