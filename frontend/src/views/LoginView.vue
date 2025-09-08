<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import axios from 'axios'

const email = ref('')
const password = ref('')
const router = useRouter()
const userStore = useUserStore()

const handleLogin = async () => {
  if (!email.value.trim() || !password.value.trim()) {
    return alert('Ingresá email y contraseña')
  }

  try {
    const res = await axios.get('https://685c760b769de2bf085ccc90.mockapi.io/taskapi/users')
    const usuarios = res.data

    console.log('Usuarios obtenidos:', usuarios)

    const usuario = usuarios.find(u =>
      u.email === email.value && u.contrasenia === password.value
    )

    if (!usuario) {
      return alert('Credenciales inválidas')
    }

    userStore.login({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      admin: usuario.admin
    })

    alert(`Bienvenido ${usuario.nombre}`)
    router.push('/')
  } catch (err) {
    console.error('Error en login:', err.response?.data || err.message || err)
    alert('Error al intentar loguear')
  }
}
</script>

<template>
  <main class="login-container">
    <h2>Iniciar Sesión</h2>
    <input v-model="email" placeholder="Email" />
    <input v-model="password" type="password" placeholder="Contraseña" />
    <button @click="handleLogin">Entrar</button>
  </main>
</template>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 4rem auto;
  padding: 2rem;
  background-color: var(--card-color, white);
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

input {
  padding: 0.7rem;
  border-radius: 8px;
  border: 1px solid #ccc;
}

button {
  background-color: var(--primary-color, #3b82f6);
  color: white;
  border: none;
  padding: 0.7rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}

button:hover {
  background-color: var(--secondary-color, #2563eb);
}
</style>