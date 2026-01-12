<script setup>
import { ref, provide } from 'vue'

import CalendarView from '@/components/CalendarView.vue'
import TaskListView from '@/components/TaskListView.vue'
import DashboardStats from '@/components/DashboardStats.vue'
import GraficoTareas from '@/components/GraficoTareas.vue'
import { useUserStore } from '@/stores/user'
import TasksToolbar from '@/components/TasksToolbar.vue'

const store = useUserStore()

/* Vista actual */
const viewMode = ref('calendario')

/* Estado compartido del calendario */
const currentMonth = ref(new Date())
provide('currentMonth', currentMonth)
</script>

<template>
  <div class="app-container">
    <main class="main-content">

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

</style>

