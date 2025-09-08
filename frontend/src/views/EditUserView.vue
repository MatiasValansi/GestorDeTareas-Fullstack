<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const route = useRoute()
const idUsuario = route.params.id

const MOCKAPI = 'https://685c760b769de2bf085ccc90.mockapi.io/taskapi/users'

const nombre = ref('')
const email = ref('')
const celular = ref('')
const rol = ref('')
const descripcion = ref('')
const admin = ref(false)

const cargando = ref(false)
const error = ref('')

const rolesDisponibles = [
  'Frontend DEV',
  'Backend DEV',
  'Mobile DEV',
  'QA Engineer',
  'Data Engineer',
  'Security Engineer'
]

const cargarUsuario = async () => {
  cargando.value = true
  try {
    const res = await axios.get(`${MOCKAPI}/${idUsuario}`)
    const data = res.data
    nombre.value = data.nombre || ''
    email.value = data.email || ''
    celular.value = data.celular?.toString() || ''
    rol.value = data.rol || ''
    descripcion.value = data.descripcion || ''
    admin.value = data.admin || false
  } catch (err) {
    error.value = 'Error al cargar el usuario.'
    console.error(err)
  } finally {
    cargando.value = false
  }
}

const soloNumeros = (e) => {
  const original = e.target.value
  const filtrado = original.replace(/\D/g, '')
  if (original !== filtrado) {
    alert('⚠️ Solo se permiten números en el campo celular.')
  }
  celular.value = filtrado
}

const guardarCambios = async () => {
  const confirmar = confirm(`¿Guardar cambios de "${nombre.value}"?`)
  if (!confirmar) return

  if (!/^\d+$/.test(celular.value)) {
    alert('⚠️ El campo celular debe contener solo números.')
    return
  }

  try {
    await axios.put(`${MOCKAPI}/${idUsuario}`, {
      nombre: nombre.value,
      email: email.value,
      celular: celular.value,
      rol: rol.value,
      descripcion: descripcion.value,
      admin: admin.value
    })
    alert('✅ Usuario actualizado con éxito')
    router.push('/users')
  } catch (err) {
    console.error('Error al actualizar usuario', err)
  }
}

const volverAlMenu = () => {
  router.push(`/users`)
}

onMounted(() => {
  cargarUsuario()
})
</script>

<template>
  
  <h2 class="titulo-usuario-modern">
  Editar registro {{ nombre }}
  </h2>

   <div class="volver-link" @click="volverAlMenu">
    <span class="volver-texto">← Volver al Menú</span>
  </div>


  
  <main class="form-container">
          

    <div v-if="cargando">⏳ Cargando...</div>
    <p v-else-if="error" class="error">{{ error }}</p>

    <form v-else @submit.prevent="guardarCambios">
      <div>
        <label for="nombre">Nombre</label>
        <input v-model="nombre" type="text" placeholder="Nombre" required />
      </div>

      <div>
        <label for="email">Email</label>
        <input v-model="email" type="email" placeholder="Correo electrónico" required />
      </div>

      <div>
        <label for="celular">Celular</label>
        <input
          v-model="celular"
          @input="soloNumeros"
          type="text"
          placeholder="Sólo números"
          required
        />
      </div>

      <div>
        <label for="rol">Rol</label>
        <select v-model="rol" required>
          <option value="">Seleccionar rol...</option>
          <option v-for="opcion in rolesDisponibles" :key="opcion" :value="opcion">
            {{ opcion }}
          </option>
        </select>
      </div>

      <div>
        <label for="descripcion">Descripción</label>
        <textarea
          v-model="descripcion"
          placeholder="Descripción del usuario"
          required
        ></textarea>
      </div>

          <div class="checkbox-wrapper">
        <label for="admin">¿Es administrador?</label>
        <input id="admin" type="checkbox" v-model="admin" class="checkbox" />
      </div>

      <button type="submit">Guardar cambios</button>
    </form>
  </main>
</template>

<style scoped>
.form-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  background-color: var(--card-color, white);
  border-radius: var(--border-radius, 12px);
  box-shadow: var(--shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
}

h2 {
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

body.dark .form-container {
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

.checkbox-wrapper {
  display: flex;
  align-items: left;
  justify-content: flex-start;
  gap: 0.6rem;
  margin: 1rem 0;
  font-weight: bold;
  font-size: 1rem;
  width: 100%;
}


.checkbox {
  appearance: none;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #ccc;
  border-radius: 6px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.checkbox:checked {
  background-color: #22c55e;
  border-color: #22c55e;
}

.checkbox:checked::after {
  content: '✓';
  position: absolute;
  color: white;
  font-weight: bold;
  font-size: 1rem;
  left: 0.35rem;
  top: 0;
}

/* 🌙 Estilo para modo oscuro */
body.dark .checkbox {
  border: 2px solid #4b5563;
  background-color: #374151;
}

body.dark .checkbox:checked {
  background-color: #22c55e;
  border-color: #22c55e;
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
  max-width: 600px; /* igual que form-container */
  margin: 0 auto 1.5rem auto;
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

