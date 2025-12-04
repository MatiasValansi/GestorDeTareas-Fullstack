<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getUserById, updateUser } from '@/services/users'

const router = useRouter()
const route = useRoute()
const idUsuario = route.params.id

const nombre = ref('')
const email = ref('')

const cargando = ref(false)
const error = ref('')

const cargarUsuario = async () => {
  cargando.value = true
  try {
    const u = await getUserById(idUsuario) // { id, nombre, email }
    nombre.value = u?.nombre || ''
    email.value = u?.email || ''
  } catch (err) {
    console.error(err)
    error.value = 'Error al cargar el usuario.'
  } finally {
    cargando.value = false
  }
}

const guardarCambios = async () => {
  if (!nombre.value.trim() || !email.value.trim()) {
    alert('⚠️ Completá nombre y email.')
    return
  }

  const confirmar = confirm(`¿Guardar cambios de "${nombre.value}"?`)
  if (!confirmar) return

  try {
    await updateUser(idUsuario, { name: nombre.value, email: email.value })
    alert('✅ Usuario actualizado con éxito')
    router.push('/users')
  } catch (err) {
    console.error('Error al actualizar usuario', err)
    const status = err?.response?.status
    const msg = err?.response?.data?.message || err.message

    if (status === 409) {
      alert('⚠️ El email ya está registrado')
    } else if (status === 400) {
      alert('⚠️ Faltan campos requeridos')
    } else {
      alert(`❌ No se pudo actualizar el usuario. ${msg}`)
    }
  }
}

const volverAlMenu = () => router.push('/users')

onMounted(cargarUsuario)
</script>

<template>
  <h2 class="titulo-usuario-modern">
    Editar registro {{ nombre || '' }}
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
form > div { margin-bottom: 1.2rem; display: flex; flex-direction: column; }
label { font-weight: bold; margin-bottom: 0.5rem; }
input { padding: 0.6rem; border-radius: 8px; border: 1px solid #ccc; font-size: 1rem; background-color: white; transition: border-color 0.2s ease; }
input:focus { outline: none; border-color: #22c55e; }
button[type="submit"] { background-color: var(--primary-color, #3b82f6); color: white; font-weight: bold; padding: 0.7rem 1.2rem; border: none; border-radius: 9999px; cursor: pointer; transition: background-color 0.3s ease; width: 100%; }
button[type="submit"]:hover { background-color: var(--secondary-color, #2563eb); }
body.dark .form-container { background-color: #1f2937; color: #f9fafb; }
body.dark input { background-color: #374151; color: #f9fafb; border: 1px solid #4b5563; }
.volver-link { width: 100%; max-width: 600px; margin: 0 auto 1.5rem auto; padding: 0 2rem; text-align: left; cursor: pointer; font-weight: bold; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
.volver-texto { color: #6f7a8b; text-decoration: underline; font-size: 1rem; }
.volver-link:hover .volver-texto { color: #2563eb; }
.titulo-usuario-modern { text-align: center; font-size: 1.7rem; font-weight: bold; margin: 2rem auto 1.5rem; padding: 1rem 1.8rem; background-color: #f8f8f3; color: #1f2937; border-radius: 12px; border: 1px solid #d1d5db; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05); max-width: 600px; }
body.dark .titulo-usuario-modern { background-color: #1f2937; color: #f9fafb; border: 1px solid #374151; box-shadow: 0 2px 6px rgba(255, 255, 255, 0.05); }
</style>
