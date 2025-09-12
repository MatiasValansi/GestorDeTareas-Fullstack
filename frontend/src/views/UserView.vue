<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

import { getAllUsers, deleteUser } from '@/services/users'
import { getAllTasks } from '@/services/tasks'

const router = useRouter()

const usuarios = ref([])
const tareas = ref([])
const cargando = ref(false)
const error = ref("")
const store = useUserStore()



const mostrarUsuariosYTareas = async () => {
  cargando.value = true
  try {
    const [resUsuarios, resTareas] = await Promise.all([
      getAllUsers(),
      getAllTasks()
    ])

    let usuariosFiltrados = resUsuarios

    usuarios.value = usuariosFiltrados.map(usuario => {
      const tareasDelUsuario = resTareas.filter(t => t.userId == usuario.id)
      const completadas = tareasDelUsuario.filter(t => t.completada).length
      return {
        ...usuario,
        cantTareas: tareasDelUsuario.length,
        cantCompletadas: completadas
      }
    })
  } catch (err) {
    error.value = 'Error al cargar usuarios y tareas.'
    console.error(err)
  } finally {
    cargando.value = false
  }
}

onMounted(async () => {
  await mostrarUsuariosYTareas()
})

const irANuevaVistaUsuario = () => {
  router.push('/newUser')
}

const eliminarUsuario = async (id, nombre) => {
  if (!confirm(`❌¿Eliminar a "${nombre}"?`)) return
  try {
    await deleteUser(id)
    alert(`Usuario "${nombre}" eliminado.`)
    await mostrarUsuariosYTareas()
  } catch (err) {
    console.error('Error al eliminar usuario', err)
  }
}

const editarUsuario = (id) => {
  router.push(`/editUser/${id}`)
}

const verDetalleUsuario = (id) => {
  router.push(`/userDetail/${id}`)
}

</script>

<template>
  <main class="task-container">
    <h2>Usuarios registrados</h2>
    
    <button v-if="store.user.admin"class="button modern" @click="irANuevaVistaUsuario">+ Agregar Usuario</button>
    
    <div class="divider"></div>
    <div v-if="cargando">⏳ Cargando Usuarios...</div>
    <p v-else-if="error" class="error">{{ error }}</p>

    <div v-else-if="usuarios.length" class="task-list">
      <div v-for="cadaUsuario in usuarios" :key="cadaUsuario.id" class="task-card">
        <h3>👨‍🎓 {{ cadaUsuario.nombre }}</h3>
        <p>ID: {{ cadaUsuario.id }}</p>
        <p>📧 Email: {{ cadaUsuario.email }}</p>
        <p>📋 Tareas: {{ cadaUsuario.cantTareas }}</p>
        <p>✅ Completadas: {{ cadaUsuario.cantCompletadas }}</p>
        <div class="actions">
          <button class="button info" @click="verDetalleUsuario(cadaUsuario.id)">Detalles</button>
          <template v-if="store.user.admin">
          <button class="button danger" @click="eliminarUsuario(cadaUsuario.id, cadaUsuario.nombre)">Eliminar</button>
          <button class="button secondary" @click="editarUsuario(cadaUsuario.id)">Editar</button>
          </template>
        </div>
      </div>
    </div>

    <p v-else>📝 No hay usuarios cargados.</p>
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
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background-color 0.3s ease, transform 0.2s ease;
}

.button.modern:hover {
  background-color: #777272;
  transform: translateY(-1px);
}

body.dark .button.modern {
  background-color: #888585;
  color: white;
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

body.dark .task-container h2 {
  color: #f9fafb;
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
body.dark .button.modern {
  background-color: #4f83cc;
  color: white;
}
</style>
