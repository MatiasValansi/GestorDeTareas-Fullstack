<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentMonth: {
    type: Date,
    required: true
  },
  viewMode: {
    type: String,
    required: true
  }
})

const emit = defineEmits([
  'update:month',
  'update:view'
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
</script>

<template>
  <div class="tasks-toolbar">

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
</style>
