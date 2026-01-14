<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

// Services
import { getUsersBySector } from '@/services/users'
import { createTask } from '@/services/tasks'
import { createRecurringTask } from '@/services/recurringTasks'

const router = useRouter()
const store = useUserStore()

// ===== ESTADO DEL FORMULARIO =====
const titulo = ref('')
const descripcion = ref('')
const date = ref('')          // Fecha de la tarea (no usada en el formulario)
const deadline = ref('')        // Para tareas individuales: fecha y hora completa
const startingFrom = ref('')    // Para tareas recurrentes: desde cuándo comienza

// ===== SWITCHES PRINCIPALES =====
const esRecurrente = ref(false)
const esCompartida = ref(false)
const tareaParaMi = ref(true) // Solo para supervisores en tareas individuales

// ===== USUARIOS =====
const usuarios = ref([])
const usuariosSeleccionados = ref([])
const cargando = ref(true)
const enviando = ref(false)

// ===== CONFIGURACIÓN DE RECURRENCIA =====
const periodicity = ref('SEMANAL')
const datePattern = ref('LUNES')
const numberPattern = ref(1)
const tipoPatron = ref('DAILY_PATTERN') // 'DAILY_PATTERN' o 'NUMERIC_PATTERN'

// Opciones disponibles (sin MENSUAL porque usa patrón numérico)
const PERIODICIDADES = [
  { value: 'DIARIA', label: 'Diaria', description: 'Todos los días' },
  { value: 'SEMANAL', label: 'Semanal', description: 'Una vez por semana' },
  { value: 'QUINCENAL', label: 'Quincenal', description: 'Cada dos semanas' }
]

const DIAS_SEMANA = [
  { value: 'LUNES', label: 'Lunes' },
  { value: 'MARTES', label: 'Martes' },
  { value: 'MIERCOLES', label: 'Miércoles' },
  { value: 'JUEVES', label: 'Jueves' },
  { value: 'VIERNES', label: 'Viernes' },
  { value: 'SABADO', label: 'Sábado' },
  { value: 'DOMINGO', label: 'Domingo' }
]

// ===== COMPUTED =====
// Si el usuario no es supervisor, no puede crear tareas para otros
const puedeAsignarOtros = computed(() => store.isSupervisor)

// Determina si necesitamos mostrar el selector de día de semana
const necesitaDiaSemana = computed(() => {
  return esRecurrente.value && tipoPatron.value === 'DAILY_PATTERN' && ['SEMANAL', 'QUINCENAL'].includes(periodicity.value)
})

// Determina si necesitamos mostrar el selector de día del mes
const necesitaDiaMes = computed(() => {
  return esRecurrente.value && tipoPatron.value === 'NUMERIC_PATTERN'
})

// El tipo de recurrencia para el backend
const recurrenceType = computed(() => {
  return tipoPatron.value
})

// Lista de usuarios disponibles para asignar (sin el supervisor, ordenados alfabéticamente)
const usuariosDisponibles = computed(() => {
  let lista = []
  const miId = store.user?.id
  
  if (store.isSupervisor) {
    // Supervisor: ve a todos EXCEPTO a sí mismo (se asigna con el checkbox)
    lista = usuarios.value.filter(u => u.id !== miId)
  } else if (esCompartida.value) {
    // Usuario normal con tarea compartida: ve a todos
    lista = [...usuarios.value]
  } else {
    // Usuario normal con tarea no compartida: solo se ve a sí mismo
    lista = usuarios.value.filter(u => u.id === miId)
  }
  
  // Ordenar alfabéticamente
  return lista.sort((a, b) => {
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  })
})

// Nombre del usuario actual (para mostrar en el mensaje)
const nombreUsuarioActual = computed(() => {
  const miId = store.user?.id
  const usuario = usuarios.value.find(u => u.id === miId)
  return usuario?.nombre || store.user?.name || 'Usuario'
})

const fechasValidas = computed(() => {
  if (!date.value || !deadline.value) return true
  return new Date(deadline.value) >= new Date(date.value)
})


// Validación del formulario
const formularioValido = computed(() => {
  if (!titulo.value.trim()) return false
  
  // Validar asignación
  if (store.isSupervisor && !esCompartida.value) {
    // Supervisor con tarea individual: debe tener tareaParaMi O al menos un usuario seleccionado
    if (!tareaParaMi.value && usuariosSeleccionados.value.length === 0) return false
  } else {
    // Otros casos: debe haber al menos un usuario seleccionado
    if (usuariosSeleccionados.value.length === 0) return false
  }
  
  if (esRecurrente.value) {
    if (!startingFrom.value) return false
  } else {
    if (!date.value || !deadline.value) return false
  }

  if (!fechasValidas.value) return false

  
  return true
})

// ===== MÉTODOS =====
const obtenerUsuarios = async () => {
  cargando.value = true
  try {
    usuarios.value = await getUsersBySector()
    
    // Auto-asignarse solo si NO es supervisor
    if (!store.isSupervisor && store.user?.id) {
      if (!usuariosSeleccionados.value.includes(store.user.id)) {
        usuariosSeleccionados.value = [store.user.id]
      }
    }
    // Si es supervisor, no pre-seleccionar nada
  } catch (err) {
    console.error("Error al obtener usuarios:", err)
    alert('Error al cargar usuarios')
  } finally {
    cargando.value = false
  }
}

// Alternar selección de usuario
const toggleUsuario = (userId) => {
  const miId = store.user?.id
  
  // Si no es supervisor y está intentando deseleccionarse a sí mismo, no permitir
  if (!store.isSupervisor && userId === miId && usuariosSeleccionados.value.includes(userId)) {
    return // No puede deseleccionarse a sí mismo
  }
  
  // Si no es tarea compartida, solo permitir un usuario seleccionado
  if (!esCompartida.value) {
    usuariosSeleccionados.value = [userId]
    return
  }
  
  const index = usuariosSeleccionados.value.indexOf(userId)
  if (index === -1) {
    usuariosSeleccionados.value.push(userId)
  } else {
    // No permitir deseleccionar si es el único usuario y no es supervisor
    if (!store.isSupervisor && usuariosSeleccionados.value.length === 1) {
      return // No puede quedarse sin usuarios asignados
    }
    usuariosSeleccionados.value.splice(index, 1)
  }
}

// Formatear fecha sin 'Z' (hora Argentina)
const formatearFechaParaBackend = (fechaInput) => {
  if (!fechaInput) return null
  // El input datetime-local devuelve "2026-01-10T14:00"
  // Agregamos segundos para completar el formato
  return fechaInput.includes(':') && fechaInput.split(':').length === 2 
    ? fechaInput + ':00' 
    : fechaInput
}

// Crear tarea individual
const crearTareaIndividual = async () => {
  // Construir lista de asignados
  let asignados = [...usuariosSeleccionados.value]
  
  // Si es supervisor y tareaParaMi está activo, agregarse al principio
  if (store.isSupervisor && tareaParaMi.value && store.user?.id) {
    asignados.unshift(store.user.id)
  }
  
  const tarea = {
    title: titulo.value.trim(),
    description: descripcion.value.trim(),
    date: formatearFechaParaBackend(date.value),
    deadline: formatearFechaParaBackend(deadline.value),
    assignedTo: asignados,
    status: 'PENDIENTE'
  }

  console.log("Enviando tarea individual:", tarea)
  await createTask(tarea)
}

// Crear tarea recurrente
const crearTareaRecurrente = async () => {
  // Construir lista de asignados
  let asignados = [...usuariosSeleccionados.value]
  
  // Si es supervisor y (tareaParaMi o tarea compartida con tareaParaMi), agregarse
  if (store.isSupervisor && store.user?.id) {
    if (!esCompartida.value && tareaParaMi.value) {
      asignados.unshift(store.user.id)
    } else if (esCompartida.value && tareaParaMi.value) {
      // En compartida, agregar al inicio si tareaParaMi
      asignados.unshift(store.user.id)
    }
  }
  
  const tareaRecurrente = {
    title: titulo.value.trim(),
    description: descripcion.value.trim(),
    assignedTo: asignados,
    periodicity: tipoPatron.value === 'NUMERIC_PATTERN' ? 'MENSUAL' : periodicity.value,
    startingFrom: formatearFechaParaBackend(startingFrom.value),
    recurrenceType: tipoPatron.value
  }

  // Agregar campos según el tipo de patrón
  if (tipoPatron.value === 'NUMERIC_PATTERN') {
    tareaRecurrente.numberPattern = numberPattern.value
  } else {
    if (['SEMANAL', 'QUINCENAL'].includes(periodicity.value)) {
      tareaRecurrente.datePattern = datePattern.value
    }
  }

  console.log("Enviando tarea recurrente:", tareaRecurrente)
  await createRecurringTask(tareaRecurrente)
}

// Enviar formulario
const enviarFormulario = async () => {
  if (!formularioValido.value) {
    alert('Por favor, completá todos los campos requeridos')
    return
  }

  enviando.value = true

  try {
    if (esRecurrente.value) {
      await crearTareaRecurrente()
      alert(`Tarea recurrente "${titulo.value}" creada con éxito`)
    } else {
      await crearTareaIndividual()
      alert(`Tarea "${titulo.value}" creada con éxito`)
    }
    
    router.push('/task')
  } catch (error) {
    console.error('Error al crear tarea:', error)
    const mensaje = error.response?.data?.message || 'Error desconocido'
    alert(`No se pudo crear la tarea: ${mensaje}`)
  } finally {
    enviando.value = false
  }
}

const volverAlMenu = () => {
  router.push('/task')
}

// Resetear campos de recurrencia cuando cambia el switch
watch(esRecurrente, (nuevoValor) => {
  if (!nuevoValor) {
    periodicity.value = 'SEMANAL'
    datePattern.value = 'LUNES'
    numberPattern.value = 1
    tipoPatron.value = 'DAILY_PATTERN'
    startingFrom.value = ''
  } else {
    date.value = '' 
    deadline.value = ''
  }
})

// Resetear campos cuando cambia el tipo de patrón
watch(tipoPatron, (nuevoValor) => {
  if (nuevoValor === 'DAILY_PATTERN') {
    periodicity.value = 'SEMANAL'
    datePattern.value = 'LUNES'
  } else {
    numberPattern.value = 1
  }
})

// Resetear usuarios cuando cambia el switch de compartida
watch(esCompartida, (nuevoValor) => {
  const miId = store.user?.id
  
  if (store.isSupervisor) {
    // Supervisor: limpiar selección al cambiar modo
    usuariosSeleccionados.value = []
    // En compartida, resetear tareaParaMi a false (puede elegir si incluirse)
    if (nuevoValor) {
      tareaParaMi.value = false
    } else {
      tareaParaMi.value = true
    }
  } else {
    if (!nuevoValor) {
      // Si no es compartida, dejar solo al usuario actual
      if (miId) {
        usuariosSeleccionados.value = [miId]
      }
    } else {
      // Si es compartida, asegurar que el usuario actual esté incluido
      if (miId && !usuariosSeleccionados.value.includes(miId)) {
        usuariosSeleccionados.value.unshift(miId)
      }
    }
  }
})

// Al montar: cargar usuarios
onMounted(obtenerUsuarios)
</script>

<template>
  <div class="new-task-container">
    <h2 class="titulo-principal">
      {{ esRecurrente ? 'Nueva Tarea Recurrente' : 'Nueva Tarea' }}
    </h2>

    <div class="volver-link" @click="volverAlMenu">
      <span class="volver-texto">← Volver al listado</span>
    </div>

    <main class="formulario-container">
      <div v-if="cargando" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando usuarios...</span>
      </div>

      <form v-else @submit.prevent="enviarFormulario">
        <!-- ===== SWITCHES PRINCIPALES ===== -->
        <div class="switches-section">
          <div class="switch-group">
            <label class="switch-label">
              <span class="switch-text">
                Tarea Recurrente
              </span>
              <div class="switch-toggle" :class="{ active: esRecurrente }" @click="esRecurrente = !esRecurrente">
                <div class="switch-thumb"></div>
              </div>
            </label>
            <p class="switch-hint">
              {{ esRecurrente ? 'Se repetirá según la periodicidad configurada' : 'Se crea una única vez' }}
            </p>
          </div>

          <div class="switch-group">
            <label class="switch-label">
              <span class="switch-text">
                Tarea Compartida
              </span>
              <div class="switch-toggle" :class="{ active: esCompartida }" @click="esCompartida = !esCompartida">
                <div class="switch-thumb"></div>
              </div>
            </label>
            <p class="switch-hint">
              {{ esCompartida ? 'Podés asignar a múltiples usuarios' : 'Asignada a un único usuario' }}
            </p>
          </div>
        </div>

        <!-- ===== INFORMACIÓN BÁSICA ===== -->
        <div class="form-section">
          <h3 class="section-title">Información Básica</h3>
          
          <div class="form-group">
            <label for="titulo">Título</label>
            <input 
              id="titulo"
              v-model="titulo" 
              type="text" 
              placeholder="Ej: Reunión de equipo semanal" 
              required 
              maxlength="100"
            />
          </div>

          <div class="form-group last-in-section">
            <label for="descripcion">Descripción</label>
            <textarea 
              id="descripcion"
              v-model="descripcion" 
              placeholder="Detalles adicionales de la tarea..."
              rows="3"
            ></textarea>
          </div>
        </div>

        <!-- ===== CONFIGURACIÓN DE RECURRENCIA ===== -->
        <div class="form-section recurrence-section" v-if="esRecurrente">
          <h3 class="section-title">Configuración de Recurrencia</h3>

          <!-- Switch tipo de patrón -->
          <div class="form-group">
            <label>Tipo de patrón</label>
            <p class="field-hint">Cómo se determinará la repetición</p>
            <div class="pattern-switch">
              <button 
                type="button"
                class="pattern-btn"
                :class="{ selected: tipoPatron === 'DAILY_PATTERN' }"
                @click="tipoPatron = 'DAILY_PATTERN'"
              >
                <span class="pattern-label">Diario</span>
                <span class="pattern-desc">Por día de la semana</span>
              </button>
              <button 
                type="button"
                class="pattern-btn"
                :class="{ selected: tipoPatron === 'NUMERIC_PATTERN' }"
                @click="tipoPatron = 'NUMERIC_PATTERN'"
              >
                <span class="pattern-label">Numérico</span>
                <span class="pattern-desc">Por número específico de día</span>
              </button>
            </div>
          </div>

          <!-- Opciones para patrón diario -->
          <template v-if="tipoPatron === 'DAILY_PATTERN'">
            <!-- Selector de día de la semana -->
            <Transition name="slide-fade">
              <div class="form-group" v-if="necesitaDiaSemana">
                <label>Día</label>
                <p class="field-hint">Qué día se va a repetir la tarea</p>
                <div class="days-grid">
                  <button 
                    v-for="dia in DIAS_SEMANA" 
                    :key="dia.value"
                    type="button"
                    class="day-btn"
                    :class="{ selected: datePattern === dia.value }"
                    @click="datePattern = dia.value"
                  >
                    {{ dia.label }}
                  </button>
                </div>
              </div>
            </Transition>
            
            <div class="form-group last-in-section">
              <label>Periodicidad</label>
              <p class="field-hint">Con qué frecuencia se va a repetir la tarea</p>
              <div class="periodicity-options compact">
                <button 
                  v-for="p in PERIODICIDADES" 
                  :key="p.value"
                  type="button"
                  class="periodicity-btn"
                  :class="{ selected: periodicity === p.value }"
                  @click="periodicity = p.value"
                >
                  <span class="periodicity-label">{{ p.label }}</span>
                  <span class="periodicity-desc">{{ p.description }}</span>
                </button>
              </div>
            </div>
          </template>

          <!-- Opciones para patrón numérico -->
          <div class="form-group last-in-section" v-if="tipoPatron === 'NUMERIC_PATTERN'">
            <label for="numberPattern">Día del mes</label>
            <p class="field-hint">La tarea se repetirá este día de cada mes</p>
            <div class="number-pattern-input">
              <input 
                id="numberPattern"
                v-model.number="numberPattern" 
                type="number" 
                min="1" 
                max="31"
                required
              />
              <span class="number-hint">de cada mes</span>
            </div>
            <p class="field-hint-secondary">Si el día no existe en un mes (ej: 31 en febrero), se omitirá</p>
          </div>
        </div>

                <!-- ===== FECHA Y HORA ===== -->
        <div v-if="!esRecurrente">
          <!-- FECHA DE LA TAREA -->
          <div class="form-group">
            <label for="date">Fecha de la tarea</label>
            <p class="field-hint">Día en el que la tarea aparece en el calendario</p>
            <input
              id="date"
              v-model="date"
              type="datetime-local"
              required
            />
          </div>

          <!-- DEADLINE -->
          <div class="form-group last-in-section">
            <label for="deadline">Fecha y hora límite</label>
            <p class="field-hint">La tarea vence en esta fecha y hora</p>
            <input
              id="deadline"
              v-model="deadline"
              type="datetime-local"
              required
            />
          </div>

          <p v-if="!fechasValidas" class="error-text">
            La fecha de vencimiento no puede ser anterior a la fecha de la tarea
          </p>
        </div>




        <!-- ===== ASIGNACIÓN DE USUARIOS ===== -->
        <div class="form-section">
          <h3 class="section-title">Asignación</h3>
          
          <!-- Usuario no-supervisor con tarea NO compartida: auto-asignación -->
          <div v-if="!puedeAsignarOtros && !esCompartida" class="auto-assign-notice last-in-section">
            <span>La tarea se te asignará automáticamente</span>
          </div>

          <!-- SUPERVISOR con tarea individual (no compartida) -->
          <div v-else-if="puedeAsignarOtros && !esCompartida" class="supervisor-assign last-in-section">
            <!-- Checkbox para asignarse a sí mismo -->
            <label class="self-assign-checkbox">
              <span class="checkbox-text">¿Esta tarea es para su usuario?</span>
              <input type="checkbox" v-model="tareaParaMi" />
            </label>
            
            <!-- Si tareaParaMi está activo, mostrar mensaje -->
            <div v-if="tareaParaMi" class="auto-assign-notice">
              <div class="notice-content">
                <span class="notice-label">Esta tarea será asignada a ti:</span>
                <span class="notice-name">{{ nombreUsuarioActual }}</span>
              </div>
            </div>
            
            <!-- Si tareaParaMi NO está activo, mostrar lista de usuarios -->
            <div v-else class="form-group">
              <label>Asignar a</label>
              <p class="field-hint">Seleccioná un usuario</p>
              <div class="users-grid">
                <div 
                  v-for="usuario in usuariosDisponibles" 
                  :key="usuario.id"
                  class="user-chip"
                  :class="{ selected: usuariosSeleccionados.includes(usuario.id) }"
                  @click="toggleUsuario(usuario.id)"
                >
                  <span class="user-avatar">{{ usuario.nombre.charAt(0).toUpperCase() }}</span>
                  <div class="user-info">
                    <span class="user-name">{{ usuario.nombre }}</span>
                    <span class="user-email">{{ usuario.email }}</span>
                  </div>
                  <span class="check-icon" v-if="usuariosSeleccionados.includes(usuario.id)">✓</span>
                </div>
              </div>
              <p class="field-hint" v-if="usuariosSeleccionados.length > 0">
                {{ usuariosSeleccionados.length }} usuario(s) seleccionado(s)
              </p>
            </div>
          </div>

          <!-- SUPERVISOR con tarea compartida O usuario no-supervisor con tarea compartida -->
          <div v-else class="form-group last-in-section">
            <!-- Checkbox para supervisor en tarea compartida -->
            <label v-if="puedeAsignarOtros" class="self-assign-checkbox">
              <span class="checkbox-text">Incluirme en esta tarea</span>
              <input type="checkbox" v-model="tareaParaMi" />
            </label>
            
            <label>Asignar a (múltiples)</label>
            <p class="field-hint">Seleccioná uno o más usuarios</p>
            <div class="users-grid">
              <div 
                v-for="usuario in usuariosDisponibles" 
                :key="usuario.id"
                class="user-chip"
                :class="{ 
                  selected: usuariosSeleccionados.includes(usuario.id),
                  'is-creator': usuario.id === store.user?.id && usuariosSeleccionados.includes(usuario.id),
                  'is-locked': !store.isSupervisor && usuario.id === store.user?.id
                }"
                @click="toggleUsuario(usuario.id)"
              >
                <span class="user-avatar">{{ usuario.nombre.charAt(0).toUpperCase() }}</span>
                <div class="user-info">
                  <span class="user-name">{{ usuario.nombre }}</span>
                  <span class="user-email">{{ usuario.email }}</span>
                </div>
                <span class="check-icon" v-if="usuariosSeleccionados.includes(usuario.id)">✓</span>
                <span class="creator-badge" v-if="usuario.id === store.user?.id && usuariosSeleccionados.includes(usuario.id)">Yo</span>
              </div>
            </div>
            <p class="field-hint" v-if="usuariosSeleccionados.length > 0 || (puedeAsignarOtros && tareaParaMi)">
              {{ (puedeAsignarOtros && tareaParaMi ? 1 : 0) + usuariosSeleccionados.length }} usuario(s) seleccionado(s)
            </p>
          </div>
        </div>

        <!-- ===== RESUMEN Y BOTONES ===== -->
        <div class="form-actions">
          <div class="summary-box" v-if="formularioValido">
            <h4>Resumen</h4>
            <ul>
              <li><strong>Tipo:</strong> {{ esRecurrente ? 'Recurrente' : 'Individual' }}</li>
              <li v-if="esRecurrente"><strong>Patrón:</strong> {{ tipoPatron === 'DAILY_PATTERN' ? 'Diario' : 'Numérico' }}</li>
              <li v-if="esRecurrente && tipoPatron === 'DAILY_PATTERN'"><strong>Periodicidad:</strong> {{ periodicity }}</li>
              <li v-if="necesitaDiaSemana"><strong>Día:</strong> {{ datePattern }}</li>
              <li v-if="necesitaDiaMes"><strong>Día del mes:</strong> {{ numberPattern }}</li>
              <li><strong>Usuarios:</strong> {{ usuariosSeleccionados.length }}</li>
            </ul>
          </div>

          <div class="buttons-row">
            <button type="button" class="btn-secondary" @click="volverAlMenu">
              Cancelar
            </button>
            <button 
              type="submit" 
              class="btn-primary"
              :disabled="!formularioValido || enviando"
            >
              <span v-if="enviando" class="btn-spinner"></span>
              {{ enviando ? 'Creando...' : (esRecurrente ? 'Crear Tarea Recurrente' : 'Crear Tarea') }}
            </button>
          </div>
        </div>
      </form>
    </main>
  </div>
</template>

<style scoped>
/* ===== CONTENEDOR PRINCIPAL ===== */
.new-task-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.titulo-principal {
  text-align: center;
  font-size: 1.8rem;
  font-weight: bold;
  margin: 1.5rem auto;
  padding: 1rem 1.8rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #1f2937;
  border-radius: 16px;
  border: 1px solid #d1d5db;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.volver-link {
  margin-bottom: 1.5rem;
  cursor: pointer;
}

.volver-texto {
  color: #6b7280;
  font-weight: 500;
  transition: color 0.2s;
}

.volver-texto:hover {
  color: #4f83cc;
}

/* ===== FORMULARIO ===== */
.formulario-container {
  background: #f8fafc;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #4f83cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== TRANSICIONES ===== */
.slide-fade-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease, max-height 0.5s ease;
}

.slide-fade-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease, max-height 0.4s ease;
}

.slide-fade-enter-from {
  transform: translateY(-8px);
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

.slide-fade-enter-to,
.slide-fade-leave-from {
  transform: translateY(0);
  opacity: 1;
  max-height: 150px;
  overflow: hidden;
}

.slide-fade-leave-to {
  transform: translateY(-8px);
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

/* ===== SECCIONES (CARDS) ===== */
.form-section {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.form-section:last-of-type {
  margin-bottom: 0;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

/* ===== SWITCHES ===== */
.switches-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 1.25rem 1.5rem;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.switch-group {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.switch-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.switch-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #374151;
}

.switch-icon {
  font-size: 1.2rem;
}

.switch-toggle {
  width: 50px;
  height: 26px;
  background: #d1d5db;
  border-radius: 13px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
}

.switch-toggle.active {
  background: #4f83cc;
}

.switch-thumb {
  width: 22px;
  height: 22px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.switch-toggle.active .switch-thumb {
  transform: translateX(24px);
}

.switch-hint {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #6b7280;
}

/* ===== CAMPOS DEL FORMULARIO ===== */
.form-group {
  margin-bottom: 1.25rem;
}

/* Último form-group de cada sección sin margin */
.form-section > .form-group:last-child,
.form-section > template:last-of-type > .form-group:last-child,
.form-section > div:last-child.form-group {
  margin-bottom: 0;
}

.last-in-section {
  margin-bottom: 0 !important;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.15rem;
}

/* Asegurar que self-assign-checkbox mantenga sus estilos dentro de form-group */
.form-group label.self-assign-checkbox {
  display: flex;
  margin-bottom: 1rem;
}

.field-hint {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  color: #9ca3af;
}

.field-hint-secondary {
  margin-top: 0.25rem;
  margin-bottom: 0;
  font-size: 0.75rem;
  color: #9ca3af;
  font-style: italic;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.2s;
  background: white;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #4f83cc;
  box-shadow: 0 0 0 3px rgba(79, 131, 204, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

/* ===== SWITCH TIPO DE PATRÓN ===== */
.pattern-switch {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.pattern-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.875rem;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.pattern-btn:hover {
  border-color: #4f83cc;
  background: #f0f7ff;
}

.pattern-btn.selected {
  border-color: #4f83cc;
  background: #4f83cc;
  color: white;
}

.pattern-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.pattern-desc {
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: 0.2rem;
}

/* ===== PERIODICIDAD ===== */
.periodicity-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.periodicity-options.compact {
  grid-template-columns: repeat(3, 1fr);
}

.periodicity-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.periodicity-btn:hover {
  border-color: #4f83cc;
  background: #f0f7ff;
}

.periodicity-btn.selected {
  border-color: #4f83cc;
  background: #4f83cc;
  color: white;
}

.periodicity-label {
  font-weight: 600;
  font-size: 0.9rem;
}

.periodicity-desc {
  font-size: 0.7rem;
  opacity: 0.8;
  margin-top: 0.15rem;
}

/* ===== DÍAS DE LA SEMANA ===== */
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.day-btn {
  padding: 0.6rem 0.25rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
}

.day-btn:hover {
  border-color: #4f83cc;
}

.day-btn.selected {
  border-color: #4f83cc;
  background: #4f83cc;
  color: white;
}

/* ===== NÚMERO DEL MES ===== */
.number-pattern-input {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.number-pattern-input input {
  width: 80px;
  text-align: center;
}

.number-hint {
  color: #6b7280;
  font-size: 0.9rem;
}

/* ===== ASIGNACIÓN DE USUARIOS ===== */
.supervisor-assign {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.self-assign-checkbox {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.self-assign-checkbox:hover {
  border-color: #4f83cc;
  background: #f0f7ff;
}

.self-assign-checkbox:has(input:checked) {
  border-color: #4f83cc;
  background: #f0f7ff;
}

.self-assign-checkbox input[type="checkbox"] {
  width: 20px;
  height: 20px;
  margin: 0;
  flex-shrink: 0;
  accent-color: #4f83cc;
  cursor: pointer;
}

.checkbox-text {
  font-weight: 500;
  color: #374151;
}

.auto-assign-notice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f0f9ff;
  border-radius: 10px;
  color: #0369a1;
  font-size: 0.9rem;
}

.notice-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.notice-label {
  font-size: 0.8rem;
  color: #64748b;
}

.notice-name {
  font-weight: 600;
  color: #0369a1;
}

.notice-icon {
  font-size: 1.2rem;
}

.user-select {
  width: 100%;
}

.users-grid {
  display: grid;
  gap: 0.5rem;
  max-height: 220px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  background: white;
}

.user-chip:hover {
  border-color: #4f83cc;
  background: #f8fafc;
}

.user-chip.selected {
  border-color: #4f83cc;
  background: #f0f7ff;
}

.user-chip.is-creator {
  border-color: #10b981;
  background: #ecfdf5;
}

.user-chip.is-locked {
  cursor: not-allowed;
  opacity: 0.85;
}

.user-chip.is-locked.selected {
  border-color: #6b7280;
  background: #f3f4f6;
}

.user-chip.is-locked:hover {
  border-color: #6b7280;
  background: #f3f4f6;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f83cc, #6366f1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.7rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.check-icon {
  width: 20px;
  height: 20px;
  background: #4f83cc;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  flex-shrink: 0;
}

.creator-badge {
  position: absolute;
  top: -6px;
  right: 8px;
  background: #10b981;
  color: white;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

/* ===== RESUMEN Y ACCIONES ===== */
.form-actions {
  margin-top: 2rem;
}

.summary-box {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
}

.summary-box h4 {
  margin: 0 0 0.75rem 0;
  color: #374151;
}

.summary-box ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  font-size: 0.9rem;
  color: #6b7280;
}

.buttons-row {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 0.875rem 1.5rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, #4f83cc, #3b6cb5);
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 131, 204, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #6b7280;
  border: 2px solid #e5e7eb;
}

.btn-secondary:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* ===== DARK MODE ===== */
body.dark .titulo-principal {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: #f1f5f9;
  border-color: #475569;
}

body.dark .formulario-container {
  background: #0f172a;
}

body.dark .form-section {
  background: #1e293b;
  border-color: #334155;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

body.dark .switches-section {
  background: #1e293b;
  border-color: #334155;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

body.dark .section-title {
  color: #e2e8f0;
  border-bottom-color: #334155;
}

body.dark .switch-group {
  background: #334155;
  border-color: #475569;
}

body.dark .switch-text {
  color: #e2e8f0;
}

body.dark .switch-hint {
  color: #94a3b8;
}

body.dark .form-group label {
  color: #e2e8f0;
}

body.dark .form-group input,
body.dark .form-group textarea,
body.dark .form-group select {
  background: #334155;
  border-color: #475569;
  color: #f1f5f9;
}

body.dark .form-group input:focus,
body.dark .form-group textarea:focus,
body.dark .form-group select:focus {
  border-color: #60a5fa;
}

body.dark .periodicity-btn {
  background: #334155;
  border-color: #475569;
  color: #e2e8f0;
}

body.dark .periodicity-btn:hover {
  background: #3b5998;
}

body.dark .periodicity-btn.selected {
  background: #3b82f6;
}

body.dark .day-btn {
  background: #334155;
  border-color: #475569;
  color: #e2e8f0;
}

body.dark .day-btn.selected {
  background: #3b82f6;
}

body.dark .user-chip {
  border-color: #475569;
}

body.dark .user-chip:hover,
body.dark .user-chip.selected {
  background: #334155;
}

body.dark .user-name {
  color: #f1f5f9;
}

body.dark .summary-box {
  background: #334155;
  border-color: #475569;
}

body.dark .summary-box h4 {
  color: #e2e8f0;
}

body.dark .btn-secondary {
  background: #334155;
  border-color: #475569;
  color: #e2e8f0;
}

body.dark .auto-assign-notice {
  background: #1e3a5f;
  color: #7dd3fc;
}

body.dark .self-assign-checkbox {
  background: #334155;
  border-color: #475569;
}

body.dark .self-assign-checkbox:hover,
body.dark .self-assign-checkbox:has(input:checked) {
  background: #1e3a5f;
  border-color: #3b82f6;
}

body.dark .checkbox-text {
  color: #e2e8f0;
}

body.dark .notice-label {
  color: #94a3b8;
}

body.dark .notice-name {
  color: #7dd3fc;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 640px) {
  .switches-section {
    grid-template-columns: 1fr;
  }

  .periodicity-options {
    grid-template-columns: 1fr;
  }

  .days-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .buttons-row {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    justify-content: center;
  }
}
</style>
