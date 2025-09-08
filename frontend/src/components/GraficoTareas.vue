<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const MOCKAPI_USERS = 'https://685c760b769de2bf085ccc90.mockapi.io/taskapi/users'
const MOCKAPI_TASKS = 'https://685c760b769de2bf085ccc90.mockapi.io/taskapi/tasks'

const usuarios = ref([])
const tareas = ref([])

const cargarDatos = async () => {
  const [resUsuarios, resTareas] = await Promise.all([
    axios.get(MOCKAPI_USERS),
    axios.get(MOCKAPI_TASKS)
  ])

  usuarios.value = resUsuarios.data
  tareas.value = resTareas.data
}

onMounted(cargarDatos)

const nombresUsuarios = computed(() => usuarios.value.map(u => u.nombre))

const cantidadTareasPorUsuario = computed(() => {
  return usuarios.value.map(u => tareas.value.filter(t => t.userId == u.id).length)
})

const cantidadCompletadasPorUsuario = computed(() => {
  return usuarios.value.map(u => tareas.value.filter(t => t.userId == u.id && t.completada).length)
})

const chartDataTareas = computed(() => ({
  labels: nombresUsuarios.value,
  datasets: [
    {
      label: 'Tareas asignadas',
      backgroundColor: '#3b82f6',
      data: cantidadTareasPorUsuario.value
    }
  ]
}))

const chartDataCompletadas = computed(() => ({
  labels: nombresUsuarios.value,
  datasets: [
    {
      label: 'Tareas completadas',
      backgroundColor: '#22c55e',
      data: cantidadCompletadasPorUsuario.value
    }
  ]
}))

const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top'
    }
  }
}
</script>


<template>
  <div class="grafico-container">
    <h2>Tareas asignadas por usuario</h2>
    <div class="grafico">
      <Bar v-if="usuarios.length" :data="chartDataTareas" :options="chartOptions" />
    </div>

    <h2>Tareas completadas por usuario</h2>
    <div class="grafico">
      <Bar v-if="usuarios.length" :data="chartDataCompletadas" :options="chartOptions" />
    </div>
  </div>
</template>

<style scoped>
.grafico-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
}

.grafico {
  max-width: 700px;
  margin: 0 auto 2rem;
  padding: 1rem;
}

canvas {
  max-height: 400px !important;
  width: 100% !important;
}

h2 {
  margin: 1.5rem 0 1rem;
  font-size: 1.3rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
