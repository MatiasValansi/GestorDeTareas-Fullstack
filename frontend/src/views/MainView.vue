<script setup>
import { ref, provide } from 'vue'

import CalendarView from '@/components/CalendarView.vue'
import TaskListView from '@/components/TaskListView.vue'
import DashboardStats from '@/components/DashboardStats.vue'
import GraficoTareas from '@/components/GraficoTareas.vue'
import { useUserStore } from '@/stores/user'

const store = useUserStore()

/* Vista */
const viewMode = ref('calendario')

/* Calendar shared state */
const currentMonth = ref(new Date())
provide('currentMonth', currentMonth)
</script>

<template>
  <div class="app-container">
    <main class="main-content">

      <div class="tasks-content">

        <!-- SWITCH -->
        <div class="tasks-toolbar">
          <span class="view-label">Vista</span>

          <div class="view-toggle">
            <button
              class="toggle-option"
              :class="{ active: viewMode === 'calendario' }"
              @click="viewMode = 'calendario'"
            >
              Calendario
            </button>

            <button
              class="toggle-option"
              :class="{ active: viewMode === 'lista' }"
              @click="viewMode = 'lista'"
            >
              Lista
            </button>
          </div>
        </div>

        <div v-show="viewMode === 'calendario'" class="view-container">
          <CalendarView />
        </div>

        <div v-show="viewMode === 'lista'" class="view-container">
          <TaskListView />
        </div>

      </div>

      <!-- STATS -->
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
