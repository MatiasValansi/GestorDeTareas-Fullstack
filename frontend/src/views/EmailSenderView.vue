<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import emailjs from '@emailjs/browser'

const route = useRoute()
const router = useRouter()

const destinatario = ref(route.query.email || '')
const mensaje = ref('')

const enviarEmail = async () => {
  if (!mensaje.value.trim()) {
    return alert('⚠️ Escribí un mensaje antes de enviar.')
  }

  try {
    const params = {
      to_email: destinatario.value,
      message: mensaje.value
    }

    await emailjs.send('service_pfdfnbk', 'template_cxzvlka', params, 'E2DVeZ92a-5Pv2KmO')
    alert('✅ Correo enviado correctamente')
    router.push('/users')
  } catch (err) {
    console.error('Error al enviar email:', err)
    alert('❌ Error al enviar el email')
  }
}
</script>

<template>
  <div class="volver-link" @click="router.back()">
    <span class="volver-texto">← Volver al Menú</span>
  </div>

  <main class="email-container">
    <h2>Enviar Correo</h2>
    <p class="destinatario-linea">
      <strong>Para:</strong> {{ destinatario }}
    </p>

    <textarea
      v-model="mensaje"
      placeholder="Escribí tu mensaje aquí..."
      rows="8"
    ></textarea>

    <div class="boton-container">
      <button class="button modern" @click="enviarEmail">Enviar</button>
    </div>
  </main>
</template>

<style scoped>
.email-container {
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #f7f5f1;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  animation: fadeIn 0.4s ease;
}

h2 {
  text-align: center;
  color: #1f2937;
  margin: 0.5rem 0 1.2rem;
  font-size: 1.8rem;
  font-weight: bold;
}

.destinatario-linea {
  font-size: 1rem;
  color: #4a5568;
  background-color: #e2e8f0;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  word-break: break-all;
}

strong {
  color: #4f83cc;
}

textarea {
  width: 100%;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 10px;
  font-size: 1rem;
  resize: vertical;
  margin-bottom: 1.5rem;
  background-color: white;
  color: #1f2937;
  transition: border-color 0.3s ease;
}

textarea:focus {
  outline: none;
  border-color: #4f83cc;
  box-shadow: 0 0 0 3px rgba(79, 131, 204, 0.2);
}

.boton-container {
  text-align: center;
  margin-top: 1rem;
}

.button.modern {
  background-color: #4f83cc;
  padding: 0.7rem 1.4rem;
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background-color 0.3s ease, transform 0.2s ease;
  border: none;
  cursor: pointer;
  display: inline-block; /* necesario para centrar con text-align */
}

.button.modern:hover {
  background-color: #3d6db5;
  transform: translateY(-1px);
}

/* 🌙 MODO OSCURO */
body.dark .email-container {
  background-color: #1f2937;
  color: #f9fafb;
  border: 1px solid #374151;
}

body.dark .destinatario-linea {
  background-color: #374151;
  color: #f9fafb;
}

body.dark textarea {
  background-color: #374151;
  color: #f9fafb;
  border-color: #4b5563;
}

body.dark textarea:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
}

body.dark .button.modern {
  background-color: #3b82f6;
}

body.dark .button.modern:hover {
  background-color: #2563eb;
}

.volver-link {
  width: 100%;
  max-width: 600px;
  margin: 1.5rem auto 0;
  padding: 0 2rem;
  text-align: left;
  cursor: pointer;
  font-weight: bold;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.volver-texto {
  color: #6f7a8b;
  text-decoration: underline;
  font-size: 1rem;
  font-weight: bold;
}

.volver-link:hover .volver-texto {
  color: #2563eb;
}

body.dark .volver-link {
  color: #ffffff;
}

body.dark .volver-link:hover {
  color: #60a5fa;
}

body.dark .volver-texto {
  color: #ffffff;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>