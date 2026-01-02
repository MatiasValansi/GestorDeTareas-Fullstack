<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import emailjs from '@emailjs/browser'

// Services
import { getAllUsers } from '@/services/users'
import { createTask } from '@/services/tasks'

const router = useRouter()

const titulo = ref('')
const descripcion = ref('')
const completada = ref('')
// ahora permitimos seleccionar uno o varios usuarios
const userIds = ref([])
const deadline = ref('')
const usuarios = ref([])

const obtenerUsuarios = async () => {
  try {
    usuarios.value = await getAllUsers()
  } catch (err) {
    console.error("Error al obtener usuarios:", err)
  }
}

const agregarTarea = async () => {
  if (
    titulo.value.trim() === '' ||
    userIds.value.length === 0 ||
    descripcion.value.trim() === '' ||
    completada.value === ''
  ) {
    return alert('⚠️ Completá todos los campos')
  }

  try {
    const ahora = new Date()

    // 👇 EXACTAMENTE como tu TaskModel:
    const nuevaTarea = {
      title: titulo.value,
      description: descripcion.value,
      completed: completada.value === 'true',
      // enviamos siempre un array de ids (1..n)
      assignedTo: userIds.value,
      date: ahora.toISOString(),
      deadline: deadline.value ? new Date(deadline.value).toISOString() : null
    }

    console.log("📤 Enviando tarea al backend:", nuevaTarea)

    // 👈 acá YA NO la envolvemos en { task: ... }
    await createTask(nuevaTarea)

    alert(`✅ Tarea "${titulo.value}" agregada con éxito`)
    router.push('/task')
  } catch (error) {
    console.error('❌ Error al agregar tarea:', error)
    alert('❌ No se pudo crear la tarea. Revisá la consola.')
  }
}

const volverAlMenu = () => {
  router.push('/task')
}

onMounted(obtenerUsuarios)
</script>


<template>
  <h2 class="titulo-tarea-modern">Agregar Tarea</h2>

  <div class="volver-link" @click="volverAlMenu">
    <span class="volver-texto">← Volver al Menú</span>
  </div>

  <main>
    <div v-if="cargando">⏳ Cargando usuarios...</div>

    <form v-else @submit.prevent="agregarTarea">
      <div>
        <label>Título</label>
        <input v-model="titulo" type="text" placeholder="Título" required />
      </div>

      <div>
        <label>Descripción</label>
        <textarea v-model="descripcion" placeholder="Descripción de la tarea" required />
      </div>

      <div>
        <label>Completada</label>
        <select v-model="completada" required>
          <option :value="true">Sí</option>
          <option :value="false">No</option>
        </select>
      </div>

      <div>
        <label>Asignar a Usuario(s)</label>
        <select v-model="userIds" multiple required>
          <option value="" disabled>Seleccionar uno o más usuarios...</option>
          <option
            v-for="usuario in usuarios"
            :key="usuario.id"
            :value="usuario.id"
          >
            {{ usuario.nombre }} ({{ usuario.email }})
          </option>
        </select>
      </div>

      <div>
        <label>Fecha límite</label>
        <input v-model="deadline" type="date" required onkeydown="return false" />
      </div>

      <button type="submit">Agregar</button>
    </form>
  </main>
</template>

<style scoped>
/* reutilizo tus estilos */
main {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  background-color: var(--card-color, white);
  border-radius: var(--border-radius, 12px);
  box-shadow: var(--shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
}
form > div { margin-bottom: 1.2rem; display: flex; flex-direction: column; }
label { font-weight: bold; margin-bottom: 0.5rem; }
input, select, textarea { padding: 0.6rem; border-radius: 8px; border: 1px solid #ccc; font-size: 1rem; background-color: white; transition: border-color 0.2s ease; }
textarea { resize: vertical; min-height: 80px; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #22c55e; }
button[type="submit"] { background-color: var(--primary-color, #3b82f6); color: white; font-weight: bold; padding: 0.7rem 1.2rem; border: none; border-radius: 9999px; cursor: pointer; transition: background-color 0.3s ease; width: 100%; }
button[type="submit"]:hover { background-color: var(--secondary-color, #2563eb); }
.titulo-tarea-modern {
  text-align: center; font-size: 1.7rem; font-weight: bold; margin: 2rem auto 1.5rem;
  padding: 1rem 1.8rem; background-color: #f8f8f3; color: #1f2937; border-radius: 12px;
  border: 1px solid #d1d5db; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05); max-width: 600px;
  animation: fadeInSlideUp 0.4s ease; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
.volver-link { width: 100%; max-width: 600px; margin: 1.5rem auto 0; padding: 0 2rem; text-align: left; cursor: pointer; font-weight: bold; }
.volver-texto { color: #6f7a8b; text-decoration: underline; font-size: 1rem; }
</style>
