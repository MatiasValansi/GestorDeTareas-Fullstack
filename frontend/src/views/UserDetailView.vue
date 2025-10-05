<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

import { getUserById } from '@/services/users'
import { getAllTasks } from '@/services/tasks'

import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js'
ChartJS.register(Title, Tooltip, Legend, ArcElement)

const route = useRoute()
const router = useRouter()
const store = useUserStore()

const usuario = ref(null)
const tareasUsuario = ref([])

const tareasTotales = ref(0)
const tareasCompletadas = ref(0)

function formatFecha(fechaEntrada) {
  if (!fechaEntrada) return 'Fecha no disponible'
  const fecha = new Date(fechaEntrada) 
  if (isNaN(fecha)) return 'Fecha inválida'

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(fecha) + ' hs'
}

const cargarDatos = async () => {
  try {    
    const id = route.params.id
    usuario.value = await getUserById(id)
    console.log('User adaptado:', usuario.value);
    const allTasks = await getAllTasks()

    const tasksAdaptadas = allTasks.map(t => ({
      id: t._id || t.id,
      titulo: t.title || t.titulo,
      descripcion: t.description ?? t.descripcion ?? '',
      deadline: t.deadline ?? t.date ?? null,
      completada: typeof t.completed === 'boolean' ? t.completed : !!t.completada,
      userId: t.assignedToUser || t.userId || null,
    }))

    tareasUsuario.value = tasksAdaptadas.filter(t => String(t.userId) === String(id))

    tareasTotales.value = tareasUsuario.value.length
    tareasCompletadas.value = tareasUsuario.value.filter(t => t.completada).length
  } catch (err) {
    console.error('Error al cargar datos del usuario:', err)
    alert('No se pudo cargar el detalle del usuario.')
  }
}

onMounted(cargarDatos)

const verDetalleTarea = (id) => {
  router.push(`/taskDetail/${id}`)
}

const chartData = computed(() => ({
  labels: ['Completadas', 'Pendientes'],
  datasets: [
    {
      label: 'Tareas',
      backgroundColor: ['#22c55e', '#facc15'],
      data: [tareasCompletadas.value, tareasTotales.value - tareasCompletadas.value]
    }
  ]
}))

const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#4a5568',
        font: { size: 14 }
      }
    }
  }
}

const volverAlMenu = () => {
  router.push('/users')
}
</script>

<template>
  <h2 v-if="usuario" class="titulo-usuario-modern">
    {{ usuario.nombre }}
  </h2>

  <div class="volver-link" @click="volverAlMenu">
    <span class="volver-texto">← Volver al Menú</span>
  </div>

  <main v-if="usuario">
    <h2>👨‍🎓 Detalle de Usuario</h2>
    <p><strong>ID:</strong> {{ usuario.id }}</p>
    <p><strong>Nombre:</strong> {{ usuario.nombre }}</p>
    <p>
      <strong>Email:</strong>
      <span class="email-inline">
        {{ usuario.email }}
        <RouterLink
          :to="{ path: '/email-send', query: { email: usuario.email } }"
          title="Enviar correo"
          class="gmail-link"
        >
          <img src="../../public/logoGmail.png" alt="Gmail" class="gmail-icon" />
        </RouterLink>
      </span>
    </p>

   
    <p><strong>Fecha de creación:</strong> {{ formatFecha(usuario.createdAt) }}</p>
    

    <template v-if="store.user?.admin">
      <div class="divider"></div>

      <h3>📝 Tareas asignadas</h3>
      <div v-if="tareasUsuario.length" class="task-list">
        <div v-for="tarea in tareasUsuario" :key="tarea.id" class="task-card">
          <h4>{{ tarea.titulo }}</h4>
          <p>📅 Fecha límite: {{ formatFecha(tarea.deadline) }}</p>
          <p>
            Estado:
            <strong :class="tarea.completada ? 'texto-verde' : 'texto-amarillo'">
              {{ tarea.completada ? 'Completada' : 'Pendiente' }}
            </strong>
          </p>
          <p>Descripción: {{ tarea.descripcion || 'No ingresada' }}</p>
          <button class="button info" @click="verDetalleTarea(tarea.id)">Detalles</button>
        </div>
      </div>
      <p v-else>📭 Este usuario no tiene tareas asignadas.</p>

      <div class="divider"></div>

      <h3>📊 Estadísticas del Usuario</h3>
      <p><strong>Total de tareas:</strong> {{ tareasTotales }}</p>
      <p><strong>Tareas completadas:</strong> {{ tareasCompletadas }}</p>

      <div class="chart-box">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
    </template>
  </main>
</template>

<style scoped>
  .email-inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;           
  }

  .gmail-link {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .gmail-icon {
    width: 32px;
    height: 32px;
    vertical-align: middle;
  }

</style>
