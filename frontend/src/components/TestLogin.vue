<script setup>
import { ref } from "vue";
import api, { setAuthToken } from "@/utils/api";

const user = ref("");
const pwd = ref("");
const message = ref("");

async function login() {
  try {
    const res = await api.post("/login", {
      user: user.value,
      pwd: pwd.value,
    });

    // ⚡ Tu backend devuelve el token con esta key
    const token = res.data.token;
    setAuthToken(token);

    message.value = "✅ Login exitoso, token guardado en localStorage";
  } catch (err) {
    console.error(err);
    message.value = "❌ Error al iniciar sesión";
  }
}
</script>

<template>
  <div>
    <h2>Prueba Login</h2>
    <input v-model="user" placeholder="Usuario" />
    <input v-model="pwd" placeholder="Contraseña" type="password" />
    <button @click="login">Login</button>

    <p>{{ message }}</p>
  </div>
</template>
