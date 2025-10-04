<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createUser } from '@/services/users.js' // 👈 importa la función del service

const name = ref('')
const email = ref('')
const router = useRouter()

// Crear usuario en BD
const agregarUsuario = async () => {
  if (!name.value.trim() || !email.value.trim()) {
    return alert('⚠️ Completá todos los campos obligatorios.')
  }

  const nuevoUsuario = {
    name: name.value,
    email: email.value
  }

  try {
    await createUser(nuevoUsuario)
    alert(`✅ Usuario agregado con éxito`)
    router.push('/users') // redirige a la lista de usuarios
    } catch (error) {
    console.error(
      '❌ Error al agregar usuario',
      {
        msg: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
        payload: error.config?.data
      }
    )
    alert(
      `Error al crear el usuario.\n` +
      `Status: ${error.response?.status || '—'}\n` +
      `Mensaje: ${error.response?.data?.error || error.response?.data?.message || error.message}`
    )
  }
}

// Volver al menú
const volverAlMenu = () => {
  router.push(`/task`)
}
</script>

<template>
  <h2 class="titulo-tarea-modern">Agregar Usuario</h2>

  <div class="volver-link" @click="volverAlMenu">
    <span class="volver-texto">← Volver al Menú</span>
  </div>

  <main>
    <form @submit.prevent="agregarUsuario">
      <div>
        <label for="name">Nombre</label>
        <input v-model="name" type="text" placeholder="Nombre completo" required />
      </div>

      <div>
        <label for="email">Email</label>
        <input v-model="email" type="email" placeholder="Correo electrónico" required />
      </div>

      <button type="submit">Agregar Usuario</button>
    </form>
  </main>
</template>

<style scoped>
main {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
  background-color: var(--card-color, white);
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
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

input {
  padding: 0.6rem;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 1rem;
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

.volver-link {
  max-width: 500px;
  margin: 1.5rem auto 0;
  padding: 0 2rem;
  text-align: left;
  cursor: pointer;
  font-weight: bold;
}

.volver-texto {
  color: #6f7a8b;
  text-decoration: underline;
}

.volver-link:hover .volver-texto {
  color: #2563eb;
}
</style>
