<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTaskById, updateTask } from '@/services/tasks'

const router = useRouter()
const route = useRoute()

const titulo = ref('')
const descripcion = ref('')
const completada = ref('')   // string: "true" | "false"
const userId = ref('')       // id del usuario asignado
const date = ref('')      // fecha de la tarea
const deadline = ref('') // fecha de vencimiento


const taskId = route.params.id   // viene de /editTask/:id

// Solo para tener la referencia cruda si la necesitamos
const taskToEdit = ref(null)

const cargarTareaAEditar = async () => {
  if (!taskId) {
    alert('No se recibió el id de la tarea para editar.')
    router.push('/task')
    return
  }

  try {
    const data = await getTaskById(taskId)

    // Soportamos distintas formas de respuesta
    const doc =
      data?.payload?.taskFoundById ??
      data?.payload ??
      data

    if (!doc) {
      throw new Error('No se encontró la tarea en la respuesta del backend')
    }

    taskToEdit.value = doc
    console.log('Tarea para editar (raw):', doc)

    // Campos básicos
    titulo.value       = doc.title        ?? doc.titulo       ?? ''
    descripcion.value  = doc.description  ?? doc.descripcion  ?? ''

    // completed / completada -> string para el <select>
    const completedRaw = doc.completed ?? doc.completada ?? false
    completada.value = completedRaw ? 'true' : 'false'

    // Usuario asignado: backend la guarda como assignedTo
    userId.value = doc.assignedTo ?? doc.userId ?? ''

    const toDatetimeLocal = (dateStr) => {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
    }

    date.value = toDatetimeLocal(doc.date)
    deadline.value = toDatetimeLocal(doc.deadline)


  } catch (error) {
    console.error('Error al cargar la tarea para editar', error)
    alert('No se pudo cargar la tarea para editar.')
    router.push('/task')
  }
}

const editarTarea = async () => {
  if (date.value && deadline.value) {
    const taskDate = new Date(date.value)
    const deadlineDate = new Date(deadline.value)

    if (deadlineDate < taskDate) {
      alert('❌ La fecha de vencimiento no puede ser anterior a la fecha de la tarea')
      return
    }
  }

  
  const confirmar = confirm(`¿Guardar cambios de "${titulo.value}"?`)
  if (!confirmar) return

  try {

    const tareaActualizada = {
        title: titulo.value,
        description: descripcion.value,
        completed: completada.value === 'true',
        assignedTo: userId.value || (taskToEdit.value?.assignedTo ?? taskToEdit.value?.userId),
        date: date.value || null,
        deadline: deadline.value || null,
      }


    console.log('Enviando tarea actualizada al backend:', tareaActualizada)

    // NO tocamos el service, asumimos que ya hace el { task: ... } si hace falta
    await updateTask(taskId, tareaActualizada)

    alert(`✅ Tarea "${titulo.value}" editada con éxito`)
    router.push('/task')
  } catch (error) {
    console.error('Error al editar tarea', error)
    alert('❌ No se pudo editar la tarea. Revisá la consola.')
  }
}

const volverAlMenu = () => {
  router.push('/task')
}

onMounted(cargarTareaAEditar)
</script>


<template>
  
  <h2 class="titulo-usuario-modern">
  Editar Tarea
  </h2>

  <div class="volver-link" @click="volverAlMenu">
    <span class="volver-texto">← Volver al Menú</span>
  </div>
  
  <main>
    <form @submit.prevent="editarTarea">
      <div>
        <label for="titulo">Título</label>
        <input v-model="titulo" type="text" placeholder="Título" required />
      </div>

      <div>
        <label for="descripcion">Descripción</label>
        <textarea v-model="descripcion" placeholder="Descripción de la tarea" required></textarea>
      </div>

      <div>
        <label for="completada">Completada</label>
        <select v-model="completada" required>
          <option value="">Seleccionar...</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      </div>

      <div>
        <label for="date">Fecha de la tarea</label>
        <input
          v-model="date"
          type="datetime-local"
          required
          onkeydown="return false"
        />
      </div>

      <div>
        <label for="deadline">Fecha de vencimiento</label>
        <input
          v-model="deadline"
          type="datetime-local"
          required
          onkeydown="return false"
        />
      </div>


      <button type="submit">Guardar tarea editada</button>
    </form>
  </main>
</template>

<style scoped>
main {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  background-color: var(--card-color, white);
  border-radius: var(--border-radius, 12px);
  box-shadow: var(--shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
}

h1 {
  text-align: center;
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
  font-weight: bold;
}

form > div {
  margin-bottom: 1.2rem;
  display: flex;
  flex-direction: column;
}

label {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

input,
select,
textarea {
  padding: 0.6rem;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 1rem;
  background-color: white;
  transition: border-color 0.2s ease;
}

textarea {
  resize: vertical;
  min-height: 80px;
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #22c55e;
}

button[type="submit"] {
  background-color: var(--primary-color, #3b82f6);
  color: white;
  font-weight: bold;
  padding: 0.7rem 1.2rem;
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  width: 100%;
}

button[type="submit"]:hover {
  background-color: var(--secondary-color, #2563eb);
}


body.dark button[type="submit"] {
  background-color: #3b82f6;
  color: white;
}

body.dark button[type="submit"]:hover {
  background-color: #2563eb;
}

body.dark main {
  background-color: #1f2937;
  color: #f9fafb;
}

body.dark input,
body.dark select,
body.dark textarea {
  background-color: #374151;
  color: #f9fafb;
  border: 1px solid #4b5563;
}

body.dark button[type="submit"] {
  background-color: #374151;
}

body.dark button[type="submit"]:hover {
  background-color: #4b5563;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: start;
  max-width: 900px;
  margin: 2rem auto 0;
  padding: 0 1rem;
  gap: 1.5rem;
  flex-wrap: wrap;
}

/* Botón volver moderno */
.volver-btn {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 9999px;
  font-weight: bold;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background-color 0.3s ease;
  margin-left: 0;
}
.volver-btn:hover {
  background-color: #2563eb;
}

/* Contenedor del título más estrecho y centrado */
.titulo-box {
  flex-grow: 1;
  max-width: 500px;
  margin: 0 auto;
  background-color: #e0e7ff;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  border: 2px solid #3b82f6;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.titulo-box h2 {
  margin: 0;
  font-size: 1.6rem;
  color: #1e40af;
  font-weight: bold;
}

.volver-link {
  max-width: 900px;
  margin: 1.5rem auto 0;
  padding: 0 2rem;
  text-align: left;
  cursor: pointer;
  font-weight: bold;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.volver-texto {
  color: #3b82f6;
  text-decoration: underline;
  font-size: 1rem;
}

.volver-link:hover .volver-texto {
  color: #2563eb;
}

/* Título principal centrado arriba */
.titulo-usuario {
  text-align: center;
  font-size: 1.8rem;
  font-weight: bold;
  margin-top: 1rem;
  color: #1e40af;
}

.titulo-usuario-modern {
  text-align: center;
  font-size: 1.9rem;
  font-weight: bold;
  margin: 2rem auto 1.5rem;
  padding: 0.8rem 1.5rem;
  background-color: #e0e7ff;
  color: #1e3a8a;
  border-radius: 12px;
  border: 2px solid #3b82f6;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.06);
  max-width: 600px;
}

body.dark .titulo-usuario-modern {
  background-color: #1e293b;
  color: #93c5fd;
  border-color: #60a5fa;
  box-shadow: 0 4px 8px rgba(255, 255, 255, 0.05);
}

@keyframes fadeInSlideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.titulo-usuario-modern {
  animation: fadeInSlideUp 0.5s ease;
}

.titulo-usuario-modern {
  text-align: center;
  font-size: 1.7rem;
  font-weight: bold;
  margin: 2rem auto 1.5rem;
  padding: 1rem 1.8rem;
  background-color: #f8f8f3;
  color: #1f2937;
  border-radius: 12px;
  border: 1px solid #d1d5db;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  max-width: 600px;
  animation: fadeInSlideUp 0.4s ease;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

body.dark .titulo-usuario-modern {
  background-color: #1f2937;
  color: #f9fafb;
  border: 1px solid #374151;
  box-shadow: 0 2px 6px rgba(255, 255, 255, 0.05);
}

@keyframes fadeInSlideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.volver-link {
  width: 100%;
  max-width: 600px;
  margin: 1.5rem auto 0;
  padding: 0 2rem;
  text-align: left;
  cursor: pointer;
  font-weight: bold;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.volver-texto {
  color: #6f7a8b;
  text-decoration: underline;
  font-size: 1rem;
}

.volver-link:hover .volver-texto {
  color: #2563eb;
}

body.dark .volver-link {
  color: #ffffff;
}

body.dark .volver-link:hover {
  color: #60a5fa;
}

body.dark .volver-texto {
  color: #ffffff;
}

</style>