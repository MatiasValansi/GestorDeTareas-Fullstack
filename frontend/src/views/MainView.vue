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

const irANuevaVistaTarea = () => {
  router.push('/newTask')
}

</script>

<template>
  <div class="app-container">
    <main class="main-content">

      <!-- Botón agregar tarea (solo supervisores) -->
    <button
      
      class="add-task-btn"
      @click="irANuevaVistaTarea"
    >
      + Nueva Tarea
    </button>

    
      <!-- CONTENIDO PRINCIPAL DE TAREAS -->
      <div class="tasks-content">

        <!-- TOOLBAR (MES + SWITCH) -->
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

      <!-- PANEL LATERAL / STATS -->
      <div>
        <div v-if="store.isSupervisor">
          <h2>📊 Estadísticas Generales</h2>
          <DashboardStats />
          <GraficoTareas />
        </div>

        <div v-else>
          <h2>Bienvenido</h2>
          <p class="rol-alert">
            Estás logueado como <strong>Usuario</strong>.
          </p>
        </div>
      </div>

    </main>
  </div>
</template>
<style scoped>
.add-task-btn { 
  margin: 1rem 1rem 1rem auto; 
  display: block;
  padding: 0.9rem; 
  background: lch(63.64% 84.82 133.75); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s ease;  } 
  
  .add-task-btn:hover { 
    background: #3d6db5; 
  }


</style>

