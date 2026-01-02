<script setup>
import { ref } from "vue";
import api, { setAuthToken } from "@/utils/api";

const email = ref("");
const password = ref("");
const message = ref("");

async function login() {
  try {
    const res = await api.post("/auth/login", {
      email: email.value,
      password: password.value,
    });

    const { token, user } = res.data;
    setAuthToken(token);

    message.value = `✅ Login ok. Usuario: ${user?.email}`;
  } catch (err) {
    console.error(err.response?.data || err.message);
    message.value = "❌ Error al iniciar sesión";
  }
}
</script>

<template>
  <div>
    <h2>Prueba Login</h2>
    <input v-model="email" placeholder="Email" />
    <input v-model="password" placeholder="Contraseña" type="password" />
    <button @click="login">Login</button>

    <p>{{ message }}</p>
  </div>
</template>
