<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import api, { setAuthToken } from "@/utils/api";

const email = ref("");
const password = ref("");
const message = ref("");

const router = useRouter();
const userStore = useUserStore();

async function handleLogin() {
  if (!email.value.trim() || !password.value.trim()) {
    return alert("Ingresá email y contraseña");
  }

  try {
    // Nuevo login contra backend real: POST /auth/login
    const res = await api.post("/auth/login", {
      email: email.value,
      password: password.value,
    });

    const { token, user } = res.data;
    if (!token || !user) {
      throw new Error("Respuesta de login inválida");
    }

    // Guardamos token en Axios + localStorage
    setAuthToken(token);

    // Guardamos usuario autenticado en el store
    userStore.login({
      id: user.id,
      name: user.name,
      email: user.email,
      sector: user.sector,
      isSupervisor: user.isSupervisor,
      token,
    });

    message.value = "✅ Login exitoso";

    // Redirigimos a una ruta protegida existente (por ejemplo, /task)
    router.push("/task");
  } catch (err) {
    console.error(err.response?.data || err.message);
    message.value = "❌ Credenciales inválidas o error en servidor";
  }
}
</script>

<template>
  <main class="login-container">
    <h2>Iniciar Sesión</h2>
    <input v-model="email" placeholder="Email" />
    <input v-model="password" type="password" placeholder="Contraseña" />
    <button @click="handleLogin">Entrar</button>
    <p>{{ message }}</p>
  </main>
</template>
