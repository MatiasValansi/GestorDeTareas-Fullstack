<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import api, { setAuthToken } from "@/utils/api";

const email = ref("");
const password = ref("");
const message = ref("");
const showPassword = ref(false);
const isLoading = ref(false);

const router = useRouter();
const userStore = useUserStore();

async function handleLogin() {
  if (!email.value.trim() || !password.value.trim()) {
    return alert("Ingresá email y contraseña");
  }

  try {
    isLoading.value = true;
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
  } finally {
    isLoading.value = false;
  }
}

function togglePasswordVisibility() {
  showPassword.value = !showPassword.value;
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="card-header">
        <img src="/logo.png" alt="Logo" class="logo" />
        <p class="subtitle">Ingresá con tu cuenta</p>
      </div>

      <div class="form-group">
        <label for="email" class="label">Email</label>
        <div class="input-wrapper">
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="tuemail@empresa.com"
            class="input"
            autocomplete="email"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="password" class="label">Contraseña</label>
        <div class="input-wrapper">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            class="input"
            autocomplete="current-password"
          />
        </div>
      </div>

      <button
        class="submit-btn"
        :disabled="isLoading"
        @click="handleLogin"
      >
        <span v-if="!isLoading">Entrar</span>
        <span v-else class="loader"></span>
      </button>

      <p v-if="message" class="status-msg">{{ message }}</p>

      <div class="helper-row">
        <span class="hint">¿Olvidaste tu contraseña? Contactá al administrador.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Página y fondo */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  padding: 1.5rem;
}

/* Tarjeta principal */
.login-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  padding: 1.75rem;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.card-header {
  text-align: center;
  margin-bottom: 1.25rem;
  padding-top: 0.5rem;
}

.logo {
  max-height: 80px;
  width: 190px;
  object-fit: contain;
  margin-bottom: 0.3rem;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

/* Inputs */
.form-group { margin-top: 1rem; }
.label {
  display: block;
  font-size: 0.9rem;
  color: #374151;
  margin-bottom: 0.35rem;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.input-icon {
  position: absolute;
  left: 0.8rem;
  font-size: 1rem;
  color: #9ca3af;
}

.input {
  height: 46px;
  padding: 0 1rem;
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #f9fafb;
  font-size: 1rem;
  display: flex;
  align-items: center;
}

.input:focus {
  border-color: #4f83cc;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(79, 131, 204, 0.15);
}

/* Submit */
.submit-btn {
  margin-top: 1.25rem;
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 0.8rem 1rem;
  background: #4f83cc;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}

.submit-btn:hover { background: #3d6db5; transform: translateY(-1px); }
.submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

.loader {
  width: 20px;
  height: 20px;
  border: 3px solid #e5e7eb;
  border-top-color: #ffffff;
  border-radius: 50%;
  display: inline-block;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Status */
.status-msg {
  margin-top: 0.75rem;
  font-size: 0.95rem;
  color: #374151;
  text-align: center;
}

.helper-row {
  margin-top: 0.5rem;
  text-align: center;
}
.hint { color: #9ca3af; font-size: 0.85rem; }

/* Dark mode */
body.dark .login-page { background: linear-gradient(135deg, #0f172a 0%, #111827 100%); }
body.dark .login-card { background: #1f2937; }
body.dark .title { color: #f9fafb; }
body.dark .subtitle { color: #9ca3af; }
body.dark .label { color: #e5e7eb; }
body.dark .input { background: #374151; border-color: #4b5563; color: #f9fafb; }
body.dark .input:focus { border-color: #3b82f6; background: #111827; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25); }
body.dark .toggle-visibility { background: #4b5563; color: #e5e7eb; }
body.dark .toggle-visibility:hover { background: #6b7280; }
body.dark .submit-btn { background: #3b82f6; }
body.dark .submit-btn:hover { background: #2563eb; }
body.dark .status-msg { color: #e5e7eb; }
body.dark .hint { color: #94a3b8; }
</style>
