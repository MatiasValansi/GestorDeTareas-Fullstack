<script setup>
import axios from 'axios'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const MOCKAPI = 'https://685c760b769de2bf085ccc90.mockapi.io/taskapi/tasks'
const USERAPI = 'https://685c760b769de2bf085ccc90.mockapi.io/taskapi/users'

const tareas = ref([])
const nuevaTarea = ref("")
const cargando = ref(false)
const error = ref("")
const usuarios = ref([])
const store = useUserStore()


// const mostrarTareas = async () => {
//   cargando.value = true
//   try {
//     const res = await axios.get(MOCKAPI)
//     tareas.value = res.data
//   } catch (err) {
//     error.value = 'Error al cargar tareas.'
//     console.error(err)
//   } finally {
//     cargando.value = false
//   }
// }

const mostrarTareas = async () => {
  cargando.value = true
  try {
    const res = await axios.get(MOCKAPI)
    const todasLasTareas = res.data

    // Si el usuario es admin, ve todas. Si no, solo las suyas.
    tareas.value = store.user.admin
      ? todasLasTareas
      : todasLasTareas.filter(t => t.userId == store.user.id)
  } catch (err) {
    error.value = 'Error al cargar tareas.'
    console.error(err)
  } finally {
    cargando.value = false
  }
}


const obtenerUsuarios = async () => {
  try {
    const res = await axios.get(USERAPI)
    usuarios.value = res.data
  } catch (err) {
    console.error('Error al cargar usuarios', err)
  }
}

onMounted(async () => {
  await mostrarTareas()
  await obtenerUsuarios()
})

const agregarTarea = async () => {
  if (nuevaTarea.value.trim() === '') return
  try {
    await axios.post(MOCKAPI, {
      titulo: nuevaTarea.value,
      completada: false,
      userId: Math.floor(Math.random() * 100) + 1
    })
    nuevaTarea.value = ''
    await mostrarTareas()
  } catch (err) {
    console.error('Error al agregar tarea', err)
  }
}

const eliminarTarea = async (id, titulo) => {
  if (!confirm(`❌¿Eliminar "${titulo}"?`)) return
  try {
    await axios.delete(`${MOCKAPI}/${id}`)
    await mostrarTareas()
  } catch (err) {
    console.error('Error al eliminar tarea', err)
  }
}

const editarTarea = (id) => {
  router.push(`/editTask/${id}`)
}

const toggleCompletada = async (tarea) => {
  try {
    await axios.put(`${MOCKAPI}/${tarea.id}`, {
      titulo: tarea.titulo,
      completada: !tarea.completada,
      userId: tarea.userId
    })
    await mostrarTareas()
  } catch (err) {
    console.error('Error al actualizar tarea', err)
  }
}

const irANuevaVistaTarea = () => {
  router.push('/newTask')
}

const formatFecha = (fechaStr) => {
  if (!fechaStr) return 'No disponible'
  const [anio, mes, dia] = fechaStr.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

const getUserNameById = (id) => {
  const user = usuarios.value.find(u => u.id == id)
  return user ? user.nombre : 'Usuario desconocido'
}

const verDetalleTarea = (id) => {
  router.push(`/taskDetail/${id}`)
}
</script>

<template>
  <main class="task-container">
    <h2>Lista de tareas:</h2>
    <button v-if="store.user.admin"
    class="button modern" @click="irANuevaVistaTarea">+ Agregar Tarea</button>

    <div class="divider"></div>
    <div v-if="cargando">⏳ Cargando tareas...</div>
    <p v-else-if="error" class="error">{{ error }}</p>

    <div v-else-if="tareas.length" class="task-list">
      <div v-for="cadaTarea in tareas" :key="cadaTarea.id" class="task-card">
        <h3>{{ cadaTarea.titulo }}</h3>
        <div> 
          <p>📅 Fecha límite: {{ formatFecha(cadaTarea.deadline) }}</p>
        </div>
<div class="completada">
  <span class="estado-label">Estado:</span>
  <label class="switch">
    <input type="checkbox" :checked="cadaTarea.completada" @change="toggleCompletada(cadaTarea)" />
    <span class="slider"></span>
  </label>
  <span class="estado-text">{{ cadaTarea.completada ? 'Completada' : 'Pendiente' }}</span>
</div>
        <p>📌 ID Usuario: {{ cadaTarea.userId }}</p>
        <p>👨‍🎓 Usuario: {{ getUserNameById(cadaTarea.userId) }}</p>
        <div class="actions">
          <button class="button info" @click="verDetalleTarea(cadaTarea.id)">Detalles</button>
          <template v-if="store.user.admin">
          <button class="button danger" @click="eliminarTarea(cadaTarea.id, cadaTarea.titulo)">Eliminar</button>
          <button class="button secondary" @click="editarTarea(cadaTarea.id)">Editar</button>
          </template>
        </div>
      </div>
    </div>

    <p v-else>📝 No hay tareas cargadas.</p>
  </main>
</template>

<style>
.task-container {
  padding: 2rem;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

h2 {
  margin-bottom: 1.5rem;
  font-weight: 600;
  color: #2d3748;
}

.button {
  background-color: #4f83cc;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background-color 0.3s ease, transform 0.2s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.button:hover {
  background-color: #3d6db5;
  transform: translateY(-1px);
}

.button.secondary {
  background-color: #4cad73;
  color: white;
}
.button.secondary:hover {
  background-color: #3c965f;
}

.button.danger {
  background-color: #e16060;
  color: white;
}
.button.danger:hover {
  background-color: #c84c4c;
}

.button.info {
  background-color: #7b61ff;
  color: white;
}
.button.info:hover {
  background-color: #684de0;
}

.button.modern {
  background-color: #888585;
  padding: 0.7rem 1.4rem;
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background-color 0.3s ease, transform 0.2s ease;
}

.button.modern:hover {
  background-color: #818080;
  transform: translateY(-1px);
}

body.dark .button.modern {
  background-color: #888585 !important;
  color: white !important;
}

.task-list {
  display: grid;
  gap: 1.2rem;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.task-card {
  background-color: #f7f5f1;
  padding: 1.4rem;
  border-radius: 14px;
  border: 1px solid #dcd8d0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.task-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.task-card p {
  margin: 0.3rem 0;
  color: #4a5568;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.divider {
  margin: 2rem 0;
  height: 1px;
  background-color: #d1d5db;
  width: 100%;
}

.error {
  color: #e53e3e;
  font-weight: bold;
}

.completada {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.estado-label {
  font-weight: 500;
  font-size: 0.95rem;
  color: #2d3748;
}

.estado-btn {
  border: none;
  padding: 0.4rem 0.9rem;
  border-radius: 9999px;
  font-weight: bold;
  font-size: 0.9rem;
  color: white;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.estado-btn.completa {
  background-color: #4cad73;
}

.estado-btn.pendiente {
  background-color: #d1a837;
}

body.dark {
  background-color: #1a202c;
  color: #f9fafb;
}

body.dark .task-card {
  background-color: #2d3748;
  border: 1px solid #4a5568;
  color: #f9fafb;
}

body.dark .task-card p {
  color: #f1f5f9;
}

body.dark .estado-label {
  color: #e2e8f0;
}

body.dark .estado-btn.completa {
  background-color: #4cad73;
}

body.dark .estado-btn.pendiente {
  background-color: #d1a837;
  color: white;
}

body.dark .button.secondary {
  background-color: #4cad73;
  color: white;
}
body.dark .button.danger {
  background-color: #e16060;
  color: white;
}
body.dark .button.info {
  background-color: #7b61ff;
  color: white;
}

body.dark .task-container h2 {
  color: #f9fafb !important;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  background-color: #ccc;
  border-radius: 999px;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  transition: 0.3s;
}

.slider::before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.3s;
}

input:checked + .slider {
  background-color: #4cad73;
}

input:checked + .slider::before {
  transform: translateX(20px);
}

.estado-text {
  margin-left: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
}

body.dark .slider {
  background-color: #4a5568;
}

body.dark input:checked + .slider {
  background-color: #4cad73;
}

body.dark .estado-text {
  color: #f1f5f9;
}
</style>