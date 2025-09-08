<script setup>
import { ref, onMounted, defineExpose } from 'vue'
import axios from 'axios'

const MOCKAPI = 'https://685c760b769de2bf085ccc90.mockapi.io/taskapi/tasks'

const total = ref(0)
const completadas = ref(0)
const pendientes = ref(0)

const cargarEstadisticas = async () => {
  try {
    const res = await axios.get(MOCKAPI)
    const tareas = res.data
    total.value = tareas.length
    completadas.value = tareas.filter(t => t.completada).length
    pendientes.value = tareas.filter(t => !t.completada).length
  } catch (err) {
    console.error('Error al cargar estadísticas', err)
  }
}

onMounted(() => {
  cargarEstadisticas()
})

defineExpose({ cargarEstadisticas })
</script>

<template>
  <section class="dashboard">
    <div class="stat-card">
      <h3>Total de tareas</h3>
      <p>{{ total }}</p>
    </div>
    <div class="stat-card">
      <h3>Completadas</h3>
      <p>{{ completadas }}</p>
    </div>
    <div class="stat-card">
      <h3>Pendientes</h3>
      <p>{{ pendientes }}</p>
    </div>
  </section>
</template>

<style scoped>
.dashboard {
  display: flex;
  gap: 1.5rem;
  justify-content: space-between;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 150px;
  background-color: var(--card-color, white);
  padding: 1rem;
  border-radius: var(--border-radius, 12px);
  box-shadow: var(--shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
  text-align: center;
}
</style>