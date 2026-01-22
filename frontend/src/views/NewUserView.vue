<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { createUser } from '@/services/users.js'

const name = ref('')
const email = ref('')
const password = ref('')
const isSupervisor = ref(false)
const showPassword = ref(false)
const router = useRouter()

// Validación de contraseña
const passwordMinLength = 6
const passwordIsValid = computed(() => password.value.length >= passwordMinLength)
const passwordErrors = computed(() => {
  const errors = []
  if (password.value && password.value.length < passwordMinLength) {
    errors.push(`Mínimo ${passwordMinLength} caracteres`)
  }
  return errors
})

// Generar contraseña segura
const generarPasswordSegura = () => {
  const length = 12
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let generatedPassword = ''
  
  // Asegurar al menos un carácter de cada tipo
  generatedPassword += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  generatedPassword += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
  generatedPassword += '0123456789'[Math.floor(Math.random() * 10)]
  generatedPassword += '!@#$%^&*'[Math.floor(Math.random() * 8)]
  
  // Completar el resto
  for (let i = generatedPassword.length; i < length; i++) {
    generatedPassword += charset[Math.floor(Math.random() * charset.length)]
  }
  
  // Mezclar los caracteres
  password.value = generatedPassword.split('').sort(() => Math.random() - 0.5).join('')
  showPassword.value = true // Mostrar la contraseña generada
}

// Crear usuario en BD
const agregarUsuario = async () => {
  if (!name.value.trim() || !email.value.trim() || !password.value.trim()) {
    return alert('⚠️ Completá todos los campos obligatorios.')
  }

  if (!passwordIsValid.value) {
    return alert(`⚠️ La contraseña debe tener al menos ${passwordMinLength} caracteres.`)
  }

  const nuevoUsuario = {
    name: name.value.trim(),
    email: email.value.trim(),
    password: password.value,
    isSupervisor: isSupervisor.value
  }

  try {
    await createUser(nuevoUsuario)
    alert(`✅ Usuario "${name.value}" creado con éxito`)
    router.push('/users')
  } catch (error) {
    console.error(
      '❌ Error al agregar usuario',
      {
        msg: error.message,
        status: error.response?.status,
        data: error.response?.data
      }
    )
    alert(
      `Error al crear el usuario.\n` +
      `Status: ${error.response?.status || '—'}\n` +
      `Mensaje: ${error.response?.data?.message || error.message}`
    )
  }
}

// Volver al menú
const volverAlMenu = () => {
  router.push(`/users`)
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

      <!-- Campo de contraseña con toggle y generador -->
      <div class="password-section">
        <label for="password">Contraseña</label>
        <div class="password-input-wrapper">
          <input 
            v-model="password" 
            :type="showPassword ? 'text' : 'password'" 
            placeholder="Contraseña segura"
            required
            :class="{ 'input-error': password && !passwordIsValid }"
          />
          <button 
            type="button" 
            class="toggle-password-btn"
            @click="showPassword = !showPassword"
            :title="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          >
            {{ showPassword ? 'Ocultar' : 'Ver' }}
          </button>
        </div>
        <div class="password-actions">
          <button type="button" class="generate-btn" @click="generarPasswordSegura">
             Generar contraseña segura
          </button>
        </div>
        <div v-if="passwordErrors.length" class="password-hints">
          <span v-for="error in passwordErrors" :key="error" class="hint-error">{{ error }}</span>
        </div>
        <div v-else-if="password && passwordIsValid" class="password-hints">
          <span class="hint-success">✓ Contraseña válida</span>
        </div>
      </div>

      <!-- Switch de Supervisor -->
      <div class="supervisor-section">
        <label class="switch-label">
          <span class="switch-text">Rol del Usuario</span>
          <div class="role-toggle">
            <span :class="['role-option', { active: !isSupervisor }]">Usuario</span>
            <label class="switch">
              <input type="checkbox" v-model="isSupervisor" />
              <span class="slider"></span>
            </label>
            <span :class="['role-option', { active: isSupervisor }]">Supervisor</span>
          </div>
        </label>
        <p class="role-description">
          {{ isSupervisor 
            ? 'El Supervisor puede gestionar usuarios y asignar tareas a otros.' 
            : 'El Usuario solo puede ver y completar sus propias tareas.' 
          }}
        </p>
      </div>

      <button type="submit" :disabled="!passwordIsValid && password.length > 0">
        Agregar Usuario
      </button>
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

input.input-error {
  border-color: #ef4444;
}

/* Password Section */
.password-section {
  margin-bottom: 1.5rem;
}

.password-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.password-input-wrapper input {
  flex: 1;
}

.toggle-password-btn {
  background: none;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 1rem;
  transform: translateY(-7px);
}

.toggle-password-btn:hover {
  background-color: #f3f4f6;
}

.password-actions {
  margin-top: 0.5rem;
}

.generate-btn {
  display: block;
  margin: 0 auto;
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.generate-btn:hover {
  background-color: #059669;
}

.password-hints {
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.hint-error {
  color: #ef4444;
}

.hint-success {
  color: #10b981;
}

/* Supervisor Switch */
.supervisor-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: var(--bg-secondary, #0080ff);  
  transform: translateX(1px);
}

body:not(.dark) .supervisor-section {

 background-color: #ffffff;
}

.switch-label {  
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.75rem;
}

.switch-text {
  position: center;
  font-weight: bold;
  color: var(--text-primary, #94a3b8);
}

.role-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;  
  transform: translateX(10px);
}

.role-option {
  font-size: 0.95rem;
  color: #94a3b8;
  transition: color 0.3s, font-weight 0.3s;
}

.role-option.active {
  color: var(--primary-color, #3b82f6);
  font-weight: bold;
}

/* Toggle Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: 0.3s;
  border-radius: 26px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary-color, #3b82f6);
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.role-description {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #64748b;
  text-align: center;
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

button[type="submit"]:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
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

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .toggle-password-btn:hover {
    background-color: #374151;
  }
  
  .supervisor-section {
    background-color: #1e293b;
    border-color: #334155;
  }
}
</style>
