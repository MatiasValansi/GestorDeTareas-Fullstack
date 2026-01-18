<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRoute } from 'vue-router'
const store = useUserStore()
const route = useRoute()


const props = defineProps({
  currentMonth: {
    type: Date,
    required: true
  },
  viewMode: {
    type: String,
    required: true
  },
  supervisorFilter: {
    type: String,
    default: 'todas'
  }
})

const emit = defineEmits([
  'update:month',
  'update:view',
  'update:supervisorFilter'
])

const monthLabel = computed(() =>
  props.currentMonth.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric'
  })
)

const prevMonth = () => {
  const d = new Date(props.currentMonth)
  d.setMonth(d.getMonth() - 1)
  emit('update:month', d)
}

const nextMonth = () => {
  const d = new Date(props.currentMonth)
  d.setMonth(d.getMonth() + 1)
  emit('update:month', d)
}

const mostrarFiltroSupervisor = computed(() => {
  return (
    store.isSupervisor &&
    (route.name === 'main' || route.name === 'mainRedirect')
  )
})

</script>

<template>
  <div class="tasks-toolbar">

    <!-- ZONA IZQUIERDA: FILTRO SUPERVISOR -->
    <div class="toolbar-left">
      <div v-if="mostrarFiltroSupervisor" class="supervisor-filter">
        <label class="filter-label">Filtrar tareas:</label>
        <select 
          :value="supervisorFilter"
          @change="emit('update:supervisorFilter', $event.target.value)"
          class="filter-select"
        >
          <option value="todas">Todas</option>
          <option value="otros">Solo del Sector</option>
          <option value="mias">Solo Mías</option>
        </select>
      </div>
    </div>

    <!-- ZONA CENTRAL: MES + FLECHAS -->
    <div class="toolbar-center">
      <button class="nav-btn" @click="prevMonth">◀</button>
      <h3 class="month-title">{{ monthLabel }}</h3>
      <button class="nav-btn" @click="nextMonth">▶</button>
    </div>

    <!-- ZONA DERECHA: SWITCH -->
    <div class="toolbar-right">
      <div class="view-toggle">
        <button
          :class="{ active: viewMode === 'calendario' }"
          @click="emit('update:view', 'calendario')"
        >
          Calendario
        </button>

        <button
          :class="{ active: viewMode === 'lista' }"
          @click="emit('update:view', 'lista')"
        >
          Lista
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ===========================
   GRID BASE DEL TOOLBAR
=========================== */
.tasks-toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr; /* centro REAL */
  align-items: center;
  height: 80px;
  padding: 0 2rem;
  box-sizing: border-box;
}

/* ===========================
   IZQUIERDA: FILTRO SUPERVISOR
=========================== */
.toolbar-left {
  grid-column: 1;
  display: flex;
  justify-content: flex-start;
}

.supervisor-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
}

.filter-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  background-color: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
}

.filter-select:hover {
  border-color: #4f83cc;
  background-color: #e5e7eb;
}

.filter-select:focus {
  border-color: #4f83cc;
  box-shadow: 0 0 0 3px rgba(79, 131, 204, 0.15);
}

/* ===========================
   CENTRO: MES + FLECHAS
=========================== */
.toolbar-center {
  grid-column: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
}

.month-title {
  font-size: 1.9rem;
  font-weight: 700;
  min-width: 300px;
  text-align: center;
  text-transform: capitalize;
  margin: 0;
  color: #1f2937;
}

/* Botones grandes */
.nav-btn {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #4f83cc;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;

  display: flex;
  align-items: center;
  justify-content: center;

  transition: background 0.2s ease, transform 0.15s ease;
}

.nav-btn:hover {
  background: #3d6db5;
  transform: scale(1.07);
}

/* ===========================
   DERECHA: SWITCH AISLADO
=========================== */
.toolbar-right {
  grid-column: 3;
  display: flex;
  justify-content: flex-end;
}

/* Switch (idéntico al que ya te gustaba) */
.view-toggle {
  display: flex;
  background: #e5e7eb;
  border-radius: 999px;
  padding: 4px;
}

.view-toggle button {
  padding: 0.4rem 1rem;
  border-radius: 999px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  color: #374151;
}

.view-toggle button.active {
  background: #1f2937;
  color: white;
}

/* ===========================
   DARK MODE
=========================== */
body.dark .month-title {
  color: #f1f5f9;
}

body.dark .nav-btn {
  background: #3b82f6;
}

body.dark .nav-btn:hover {
  background: #2563eb;
}

body.dark .view-toggle {
  background: #374151;
}

body.dark .view-toggle button {
  color: #d1d5db;
}

body.dark .view-toggle button.active {
  background: #f1f5f9;
  color: #1f2937;
}

body.dark .filter-label {
  color: #9ca3af;
}

body.dark .filter-select {
  background-color: #374151;
  border-color: #4b5563;
  color: #f1f5f9;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
}

body.dark .filter-select:hover {
  border-color: #3b82f6;
  background-color: #4b5563;
}

body.dark .filter-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

/* ===========================
   RESPONSIVE
=========================== */
@media (max-width: 900px) {
  .tasks-toolbar {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    height: auto;
    gap: 1rem;
    padding: 1rem;
  }

  .toolbar-left {
    grid-column: 1;
    justify-content: center;
  }

  .toolbar-center {
    grid-column: 1;
  }

  .toolbar-right {
    grid-column: 1;
    justify-content: center;
  }

  .month-title {
    font-size: 1.4rem;
    min-width: auto;
  }
}
</style>
