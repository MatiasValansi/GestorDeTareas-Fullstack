<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

/* =======================
   STORE / AUTH
======================= */
const store = useUserStore()
const isLoggedIn = computed(() => store.isLoggedIn)

/* =======================
   ROUTER
======================= */
const route = useRoute()
const router = useRouter()

/* =======================
   UI STATE
======================= */
const darkMode = ref(false)

/* =======================
   ACTIONS
======================= */
const toggleDarkMode = () => {
  darkMode.value = !darkMode.value
  document.body.classList.toggle('dark', darkMode.value)
}

const logout = () => {
  store.logout()
  router.push('/login')
}

/* =======================
   LIFECYCLE
======================= */
onMounted(() => {
  if (localStorage.getItem('dark') === 'true') {
    darkMode.value = true
    document.body.classList.add('dark')
  }
})

watch(darkMode, v => localStorage.setItem('dark', v))
</script>

<template>
  <!-- =======================
       USUARIO LOGUEADO
  ======================== -->
  <div v-if="isLoggedIn">

    <!-- USER BAR -->
    <div class="user-bar">
      <div class="user-info">
        <span class="login-alert">
          Logueado como <strong>{{ store.user.email }}</strong>
        </span>
        <div></div>
        <span class="login-role">
          Permisos de <strong>{{ store.isSupervisor ? 'Supervisor' : 'Usuario' }}</strong>
        </span>
      </div>

      <div class="top-buttons">
        <button class="toggle-button" @click="toggleDarkMode">
          {{ darkMode ? 'Modo claro' : 'Modo oscuro' }}
        </button>
        <button class="toggle-button danger" @click="logout">
          Cerrar sesión
        </button>
      </div>
    </div>

    <!-- HEADER -->
    <header class="header-bar">
      <div class="header-inner">
        <img src="/logo.png" alt="Logo" class="logo-title" />

        <nav class="navbar">
          <RouterLink
            to="/main"
            class="nav-button"
            :class="{ active: route.path === '/main' }"
          >
            Tareas
          </RouterLink>

          <RouterLink
            v-if="store.isSupervisor"
            to="/users"
            class="nav-button"
            :class="{ active: route.path === '/users' }"
          >
            Usuarios
          </RouterLink>
        </nav>
      </div>
    </header>

    <!-- AQUÍ SE RENDERIZAN LAS VIEWS -->
    <RouterView />
  </div>

  <!-- =======================
       NO LOGUEADO
  ======================== -->
  <RouterView v-else />
</template>

<style>
/* =======================
   BASE
======================= */
body {
  background-color: #f4f4f2;
  color: #1f2937;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

body.dark {
  background-color: #111827;
  color: #f9fafb;
}

/* =======================
   USER BAR
======================= */
.user-bar {
  width: 100%;
  padding: 0.6rem 2rem;
  background-color: rgba(240, 239, 239, 0.87);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

body.dark .user-bar {
  background-color: rgba(12, 21, 44, 0.7);
}

.user-info {
  font-size: 0.9rem;
}

/* =======================
   HEADER / NAV
======================= */
.header-bar {
  text-align: center;
  padding: 1.5rem 1rem;
}

.logo-title {
  width: 350px;
}

.navbar {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
}

.nav-button {
  background-color: #4f83cc;
  color: white;
  padding: 0.6rem 1.4rem;
  border-radius: 9999px;
  text-decoration: none;
  font-weight: 600;
}

.nav-button.active {
  background-color: #22c55e;
}

/* =======================
   MAIN LAYOUT
======================= */
.app-container {
  max-width: 1610px;      /* 15% más ancho que 1400px */
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}

.tasks-content {
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,.1);
  overflow: hidden;
  width: 100%;
}

body.dark .tasks-content {
  background: #1e293b;
}

/* =======================
   SWITCH
======================= */
.tasks-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.8rem;
}


.view-label {
  font-size: 0.7rem;
  color: #6b7280;
  user-select: none;
}

.view-toggle {
  display: inline-flex;
  background: #e5e7eb;
  border-radius: 9999px;
  padding: 2px;
}

.toggle-option {
  border: none;
  background: transparent;
  padding: 0.2rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 9999px;
  color: #374151;
  line-height: 1.4;
}

.toggle-option.active {
  background: #64748b;
  color: white;
}

.toggle-button {
  background-color: #d1d5db;    /* sólido, neutro */
  color: #1f2937;
  border: none;
  padding: 0.4rem 0.9rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.toggle-button:hover {
  background-color: #9ca3af;
}

.toggle-button.danger {
  background-color: #ef4444;  /* rojo sólido */
  color: white;
}

.toggle-button.danger:hover {
  background-color: #dc2626;
}

body.dark .toggle-button {
  background-color: #374151;
  color: #f9fafb;
}

body.dark .toggle-button:hover {
  background-color: #4b5563;
}

body.dark .toggle-button.danger {
  background-color: #b91c1c;
}

body.dark .toggle-button.danger:hover {
  background-color: #991b1b;
}

/* =======================
   VIEW CONTAINER
======================= */
  .view-container {
    width: 100%;
    height: 773px;
    max-height: 773px;
    overflow: hidden;
}

/* =======================
   TRANSITION
======================= */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
