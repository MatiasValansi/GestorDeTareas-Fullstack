<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import api, { setAuthToken } from "@/utils/api";

const user = ref("");
const pwd = ref("");
const message = ref("");

const router = useRouter();
const userStore = useUserStore();

async function handleLogin() {
  if (!user.value.trim() || !pwd.value.trim()) {
    return alert("Ingresá usuario y contraseña");
  }

  try {
    const res = await api.post("/login", {
      user: user.value,
      pwd: pwd.value,
    });

    // ⚡ El backend devuelve el token
    const token = res.data.token;
    setAuthToken(token);

    // 👉 Guardar usuario y token en el store (podés mejorar con datos reales)
    userStore.login({
      nombre: user.value,
      token: token,
    });

    message.value = "✅ Login exitoso";

    // 👉 Redirigir al home
    router.push("/");
  } catch (err) {
    console.error(err.response?.data || err.message);
    message.value = "❌ Credenciales inválidas o error en servidor";
  }
}
</script>

<template>
  <main class="login-container">
    <h2>Iniciar Sesión</h2>
    <input v-model="user" placeholder="Usuario" />
    <input v-model="pwd" type="password" placeholder="Contraseña" />
    <button @click="handleLogin">Entrar</button>
    <p>{{ message }}</p>
  </main>
</template>
