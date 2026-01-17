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

/* Filtro de supervisor (todas, otros, mias) */
const supervisorFilter = ref('todas')
provide('supervisorFilter', supervisorFilter)

const selectedCategory = ref('tareas')

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
      <span class="icon">+</span>
      <span class="label">Agregar tarea</span>
    </button>

    
      <!-- CONTENIDO PRINCIPAL DE TAREAS -->
      <div class="tasks-content">

        <!-- TOOLBAR (MES + SWITCH + FILTRO SUPERVISOR) -->
        <TasksToolbar
          :currentMonth="currentMonth"
          :viewMode="viewMode"
          :supervisorFilter="supervisorFilter"
          @update:month="currentMonth = $event"
          @update:view="viewMode = $event"
          @update:supervisorFilter="supervisorFilter = $event"
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
      <!-- <div>
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
      </div> -->

    </main>
  </div>
</template>
<style scoped>

.add-task-btn {
  position: fixed;
  right: 24px;
  bottom: 24px;
  margin: 0.25rem 1rem 1rem auto;

  display: flex;
  align-items: center;
  justify-content: flex-start;
  

  width: 56px;
  height: 56px;
  padding-left: 16px;
  padding-bottom: 5px;

  background: #22C55E;
  color: white;
  border: none;
  border-radius: 999px;

  font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;

  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;

  overflow: hidden;
  white-space: nowrap;

  z-index: 9999;

  transition:
    width 0.25s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.add-task-btn:hover {
  width: 170px;              /* 🔥 se expande */
  background: #16A34A;
  box-shadow: 0 10px 24px rgba(0,0,0,0.25);
}

.add-task-btn:hover .label {
  opacity: 1;
  transform: translateX(0);
}

.add-task-btn:active {
  background: #15803D;
}

.add-task-btn .icon {
  width: 24px;
  height: 24px;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 2.4rem;
  font-weight: 700;
  line-height: 1;


  margin-top: -1px;

  flex-shrink: 0;
}
.add-task-btn .label {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1;
  opacity: 0;
  transform: translateX(-6px);
  padding-left: 10px;
  padding-top: 2.2px;

  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

body.dark .add-task-btn {
  background: #4ADE80;
}

body.dark .add-task-btn:hover {
  background: #22C55E;
}

  .tasks-content {
    height: 800px;
  }

</style>

