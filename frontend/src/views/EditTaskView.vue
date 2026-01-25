<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { getUsersBySector } from "@/services/users";
import { 
    getTaskById, 
    updateTask, 
    getTaskOwnerId, 
    canEditTask,
    isTaskShared,
    getAssignedUserIds
} from "@/services/tasks";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

// ===== ESTADO =====
const tarea = ref(null);
const tareaOriginal = ref(null); // Para comparar cambios
const loading = ref(false);
const cargando = ref(true);
const errorMsg = ref("");
const successMsg = ref("");

// ===== USUARIOS =====
const usuarios = ref([]);
const usuariosSeleccionados = ref([]);

// ===== SWITCH DE COMPARTIDA =====
const esCompartidaOriginal = ref(false);
const esCompartida = ref(false);

// ===== HELPERS =====
const getCurrentUserId = () => {
    const user = userStore.user;
    return user?._id ? String(user._id) : user?.id ? String(user.id) : null;
};

// Convertir ISO a datetime-local
const toDatetimeLocal = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ===== CARGAR DATOS =====
const obtenerUsuarios = async () => {
    try {
        usuarios.value = await getUsersBySector();
    } catch (err) {
        console.error("Error al obtener usuarios:", err);
    }
};

onMounted(async () => {
    cargando.value = true;
    try {
        // Cargar usuarios y tarea en paralelo
        await Promise.all([
            obtenerUsuarios(),
            (async () => {
                const data = await getTaskById(route.params.id);
                if (data) {
                    tarea.value = {
                        ...data,
                        date: toDatetimeLocal(data.date),
                        deadline: toDatetimeLocal(data.deadline),
                    };
                    
                    // Guardar copia original para comparar
                    tareaOriginal.value = {
                        title: data.title,
                        description: data.description,
                        status: data.status,
                        date: toDatetimeLocal(data.date),
                        deadline: toDatetimeLocal(data.deadline),
                        assignedTo: getAssignedUserIds(data),
                    };

                    // Inicializar usuarios seleccionados (excluyendo al titular)
                    const titularId = getTaskOwnerId(data);
                    const allAssigned = getAssignedUserIds(data);
                    usuariosSeleccionados.value = allAssigned.filter(id => id !== titularId);

                    // Determinar si es compartida
                    esCompartidaOriginal.value = isTaskShared(data);
                    esCompartida.value = isTaskShared(data);
                }
            })()
        ]);
    } catch (e) {
        errorMsg.value = e?.response?.data?.message || "Error al cargar la tarea";
    } finally {
        cargando.value = false;
    }
});

// ===== COMPUTED: PERMISOS =====
const titularId = computed(() => {
    return getTaskOwnerId(tarea.value);
});

const isOwner = computed(() => {
    return titularId.value === getCurrentUserId();
});

const isExpired = computed(() => {
    if (!tareaOriginal.value?.deadline) return false;
    // Usar la fecha original sin formatear para comparar
    const originalData = tarea.value?.deadline;
    if (!originalData) return false;
    // Buscar en los datos originales de la API
    return tarea.value?.status === "VENCIDA";
});

const isRecurring = computed(() => !!tarea.value?.recurringTaskId);

const canEdit = computed(() => {
    return isOwner.value && !isExpired.value && !isRecurring.value;
});

const editBlockReason = computed(() => {
    if (!isOwner.value) return "No eres el titular de esta tarea (posición 0 en asignados)";
    if (isExpired.value) return "Esta tarea está vencida";
    if (isRecurring.value) return "Las tareas recurrentes no se pueden editar";
    return "";
});

// ===== COMPUTED: VALIDACIONES DE FECHAS =====
const fechasValidas = computed(() => {
    if (!tarea.value?.date || !tarea.value?.deadline) return true;
    return new Date(tarea.value.deadline) >= new Date(tarea.value.date);
});

const fechaEnPasado = computed(() => {
    const now = new Date();
    if (tarea.value?.date && new Date(tarea.value.date) < now) return 'date';
    if (tarea.value?.deadline && new Date(tarea.value.deadline) < now) return 'deadline';
    return null;
});

// ===== COMPUTED: USUARIOS =====
const titularInfo = computed(() => {
    if (!titularId.value) return null;
    return usuarios.value.find(u => u.id === titularId.value);
});

// Usuarios disponibles para asignar (excluyendo al titular)
const usuariosDisponibles = computed(() => {
    if (!titularId.value) return [];
    return usuarios.value
        .filter(u => u.id !== titularId.value)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
});

// ===== COMPUTED: VALIDACIÓN DE CAMBIOS =====
const hayaCambiosEnAsignados = computed(() => {
    if (!tareaOriginal.value) return false;
    
    const originalAssigned = tareaOriginal.value.assignedTo || [];
    const currentAssigned = construirListaAsignados();
    
    if (originalAssigned.length !== currentAssigned.length) return true;
    
    const originalSorted = [...originalAssigned].sort();
    const currentSorted = [...currentAssigned].sort();
    
    return originalSorted.some((id, idx) => id !== currentSorted[idx]);
});

const hayCambiosEnCampos = computed(() => {
    if (!tarea.value || !tareaOriginal.value) return false;
    
    return (
        tarea.value.title !== tareaOriginal.value.title ||
        tarea.value.description !== tareaOriginal.value.description ||
        tarea.value.status !== tareaOriginal.value.status ||
        tarea.value.date !== tareaOriginal.value.date ||
        tarea.value.deadline !== tareaOriginal.value.deadline
    );
});

const hayCambios = computed(() => {
    return hayCambiosEnCampos.value || hayaCambiosEnAsignados.value;
});

// Validación: si se activa compartida sin agregar usuarios, no permitir guardar
const compartidaSinCambios = computed(() => {
    // Si originalmente NO era compartida y ahora SÍ está el switch activo
    if (!esCompartidaOriginal.value && esCompartida.value) {
        // Pero no se agregó ningún usuario
        return usuariosSeleccionados.value.length === 0;
    }
    return false;
});

// ===== COMPUTED: FORMULARIO VÁLIDO =====
const formularioValido = computed(() => {
    if (!canEdit.value) return false;
    if (!tarea.value?.title?.trim()) return false;
    if (!tarea.value?.date || !tarea.value?.deadline) return false;
    if (!fechasValidas.value) return false;
    if (fechaEnPasado.value) return false;
    if (compartidaSinCambios.value) return false;
    if (!hayCambios.value) return false;
    
    return true;
});

// ===== MÉTODOS =====
const toggleUsuario = (userId) => {
    // No permitir quitar al titular
    if (userId === titularId.value) return;
    
    const index = usuariosSeleccionados.value.indexOf(userId);
    if (index === -1) {
        usuariosSeleccionados.value.push(userId);
    } else {
        usuariosSeleccionados.value.splice(index, 1);
    }
};

const construirListaAsignados = () => {
    // El titular siempre en posición 0
    const titular = titularId.value;
    if (!titular) return [];
    
    // Si no es compartida, solo el titular
    if (!esCompartida.value) {
        return [titular];
    }
    
    // Si es compartida: titular + seleccionados
    return [titular, ...usuariosSeleccionados.value];
};

const formatearFechaParaBackend = (fechaInput) => {
    if (!fechaInput) return null;
    return fechaInput.includes(':') && fechaInput.split(':').length === 2 
        ? fechaInput + ':00' 
        : fechaInput;
};

async function editarTarea() {
    errorMsg.value = "";
    successMsg.value = "";

    if (!canEdit.value) {
        errorMsg.value = editBlockReason.value;
        return;
    }

    if (!formularioValido.value) {
        if (compartidaSinCambios.value) {
            errorMsg.value = "Debes agregar al menos un usuario para convertir la tarea en compartida, o desactivar el switch";
        } else if (!hayCambios.value) {
            errorMsg.value = "No hay cambios para guardar";
        } else if (!fechasValidas.value) {
            errorMsg.value = "La fecha de vencimiento no puede ser anterior a la fecha de inicio";
        } else if (fechaEnPasado.value === 'date') {
            errorMsg.value = "La fecha de inicio no puede ser anterior al momento actual";
        } else if (fechaEnPasado.value === 'deadline') {
            errorMsg.value = "La fecha de vencimiento no puede ser anterior al momento actual";
        }
        return;
    }

    try {
        loading.value = true;

        const payload = {
            title: tarea.value.title,
            description: tarea.value.description,
            status: tarea.value.status,
            date: formatearFechaParaBackend(tarea.value.date),
            deadline: formatearFechaParaBackend(tarea.value.deadline),
        };

        // Solo incluir assignedTo si hay cambios en los asignados
        if (hayaCambiosEnAsignados.value) {
            payload.assignedTo = construirListaAsignados();
        }

        const response = await updateTask(route.params.id, payload);
        
        // Construir mensaje de éxito con info del email
        let msg = "✅ Tarea actualizada correctamente";
        const data = response?.payload || response;
        if (data?.newUsersNotified > 0) {
            if (data?.emailSent) {
                msg += `. Se envió notificación por email a ${data.emailsSentCount} usuario(s) agregado(s)`;
            } else if (data?.emailError) {
                msg += `. ⚠️ No se pudo enviar el email de notificación`;
            }
        }
        successMsg.value = msg;
        
        setTimeout(() => router.push("/main"), 2000);
    } catch (e) {
        errorMsg.value = e?.response?.data?.message || e?.message || "Error al actualizar";
        console.error("Error al editar:", e);
    } finally {
        loading.value = false;
    }
}

const volverAlListado = () => {
    router.push('/main');
};

// ===== WATCHERS =====
watch(esCompartida, (nuevoValor) => {
    if (!nuevoValor) {
        // Al desactivar compartida, limpiar usuarios seleccionados
        usuariosSeleccionados.value = [];
    }
});
</script>

<template>
    <div class="edit-task-container">
        <h2 class="titulo-principal">Editar Tarea</h2>

        <div class="volver-link" @click="volverAlListado">
            <span class="volver-texto">← Volver al listado</span>
        </div>

        <main class="formulario-container">
            <!-- Loading state -->
            <div v-if="cargando" class="loading-state">
                <div class="spinner"></div>
                <span>Cargando tarea...</span>
            </div>

            <template v-else-if="tarea">
                <!-- Mensajes -->
                <div v-if="errorMsg" class="message-box error">
                    {{ errorMsg }}
                </div>
                <div v-if="successMsg" class="message-box success">
                    {{ successMsg }}
                </div>

                <!-- Aviso de bloqueo -->
                <div v-if="!canEdit" class="message-box warning">
                    <strong>No puedes editar esta tarea:</strong> {{ editBlockReason }}
                </div>

                <!-- Formulario -->
                <form @submit.prevent="editarTarea">
                    <!-- ===== INFORMACIÓN DEL TITULAR ===== -->
                    <div class="form-section">
                        <h3 class="section-title">Titular de la tarea</h3>
                        <div class="titular-info">
                            <span class="titular-badge">👑 Titular</span>
                            <span class="titular-name" v-if="titularInfo">
                                {{ titularInfo.nombre }}
                                <span v-if="isOwner" class="you-badge">(Tú)</span>
                            </span>
                            <span class="titular-hint">
                                Solo el titular puede editar esta tarea
                            </span>
                        </div>
                    </div>

                    <!-- ===== SWITCH DE COMPARTIDA ===== -->
                    <div class="switches-section" v-if="canEdit">
                        <div class="switch-group">
                            <label class="switch-label">
                                <span class="switch-text">Tarea Compartida</span>
                                <div 
                                    class="switch-toggle" 
                                    :class="{ active: esCompartida }" 
                                    @click="esCompartida = !esCompartida"
                                >
                                    <div class="switch-thumb"></div>
                                </div>
                            </label>
                            <p class="switch-hint">
                                {{ esCompartida ? 'Podés asignar a múltiples usuarios' : 'Asignada únicamente al titular' }}
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
                                v-model="tarea.title"
                                type="text"
                                placeholder="Título de la tarea"
                                :disabled="!canEdit"
                                required
                                maxlength="100"
                            />
                        </div>

                        <div class="form-group">
                            <label for="descripcion">Descripción</label>
                            <textarea
                                id="descripcion"
                                v-model="tarea.description"
                                placeholder="Detalles de la tarea..."
                                rows="3"
                                :disabled="!canEdit"
                            ></textarea>
                        </div>

                        <div class="form-group last-in-section">
                            <label for="status">Estado</label>
                            <select
                                id="status"
                                v-model="tarea.status"
                                :disabled="!canEdit"
                            >
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="COMPLETADA">Completada</option>
                            </select>
                        </div>
                    </div>

                    <!-- ===== FECHA Y HORA ===== -->
                    <div class="form-section">
                        <h3 class="section-title">Fecha y Hora</h3>
                        
                        <div class="form-group">
                            <label for="date">Comienzo</label>
                            <p class="field-hint">Fecha de inicio de la tarea</p>
                            <input
                                id="date"
                                v-model="tarea.date"
                                type="datetime-local"
                                :disabled="!canEdit"
                                required
                            />
                        </div>

                        <div class="form-group last-in-section">
                            <label for="deadline">Vencimiento</label>
                            <p class="field-hint">Fecha límite de la tarea</p>
                            <input
                                id="deadline"
                                v-model="tarea.deadline"
                                type="datetime-local"
                                :disabled="!canEdit"
                                required
                            />
                        </div>

                        <p v-if="!fechasValidas" class="error-text">
                            La fecha de vencimiento no puede ser anterior a la fecha de la tarea
                        </p>

                        <p v-if="fechaEnPasado === 'date'" class="error-text">
                            La fecha de inicio no puede ser anterior al momento actual
                        </p>

                        <p v-if="fechaEnPasado === 'deadline'" class="error-text">
                            La fecha de vencimiento no puede ser anterior al momento actual
                        </p>
                    </div>

                    <!-- ===== ASIGNACIÓN DE USUARIOS (Solo si está habilitado compartir) ===== -->
                    <Transition name="slide-fade">
                        <div class="form-section" v-if="esCompartida && canEdit">
                            <h3 class="section-title">Usuarios Asignados</h3>
                            
                            <p class="field-hint" style="margin-bottom: 1rem;">
                                Seleccioná otros usuarios para compartir la tarea. El titular no puede ser removido.
                            </p>

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
                                {{ usuariosSeleccionados.length }} usuario(s) adicional(es) seleccionado(s)
                            </p>

                            <p v-if="compartidaSinCambios" class="validation-warning">
                                ⚠️ Debes agregar al menos un usuario para convertir la tarea en compartida, o desactivar el switch
                            </p>
                        </div>
                    </Transition>

                    <!-- ===== LISTA DE ASIGNADOS ACTUAL (solo lectura si no puede editar) ===== -->
                    <div class="form-section" v-if="!canEdit && tarea.assignedTo?.length > 0">
                        <h3 class="section-title">Usuarios Asignados</h3>
                        <div class="assigned-list">
                            <div 
                                v-for="(assigned, index) in tarea.assignedTo" 
                                :key="index"
                                class="assigned-chip"
                            >
                                <span class="titular-chip-badge" v-if="index === 0">👑 Titular</span>
                                {{ assigned.nombre || assigned.name || assigned }}
                            </div>
                        </div>
                    </div>

                    <!-- ===== RESUMEN Y BOTONES ===== -->
                    <div class="form-actions">
                        <div class="summary-box" v-if="hayCambios && formularioValido">
                            <h4>Resumen de cambios</h4>
                            <ul>
                                <li v-if="hayCambiosEnCampos"><strong>Campos:</strong> Se actualizarán los datos básicos</li>
                                <li v-if="hayaCambiosEnAsignados">
                                    <strong>Asignados:</strong> 
                                    {{ construirListaAsignados().length }} usuario(s) total
                                </li>
                            </ul>
                        </div>

                        <div class="no-changes-notice" v-if="!hayCambios && canEdit">
                            No hay cambios para guardar
                        </div>

                        <div class="buttons-row">
                            <button type="button" class="btn-secondary" @click="volverAlListado">
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                class="btn-primary"
                                :disabled="!formularioValido || loading"
                            >
                                <span v-if="loading" class="btn-spinner"></span>
                                {{ loading ? "Guardando..." : "Guardar cambios" }}
                            </button>
                        </div>
                    </div>
                </form>
            </template>

            <div v-else class="error-state">
                No se pudo cargar la tarea
            </div>
        </main>
    </div>
</template>

<style scoped>
/* ===== CONTENEDOR PRINCIPAL ===== */
.edit-task-container {
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

.loading-state,
.error-state {
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

/* ===== MENSAJES ===== */
.message-box {
    padding: 1rem;
    border-radius: 10px;
    margin-bottom: 1rem;
}

.message-box.error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
}

.message-box.success {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
}

.message-box.warning {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fcd34d;
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
    max-height: 500px;
    overflow: hidden;
}

.slide-fade-leave-to {
    transform: translateY(-8px);
    opacity: 0;
    max-height: 0;
    overflow: hidden;
}

/* ===== SECCIONES ===== */
.form-section {
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.25rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.section-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
}

/* ===== INFORMACIÓN DEL TITULAR ===== */
.titular-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    padding: 1rem;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 2px solid #f59e0b;
    border-radius: 10px;
}

.titular-badge {
    background: #f59e0b;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
}

.titular-name {
    font-weight: 600;
    color: #92400e;
}

.you-badge {
    font-size: 0.85rem;
    color: #b45309;
    font-weight: normal;
}

.titular-hint {
    width: 100%;
    font-size: 0.8rem;
    color: #b45309;
}

/* ===== SWITCHES ===== */
.switches-section {
    display: grid;
    grid-template-columns: 1fr;
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
    font-weight: 600;
    color: #374151;
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

.last-in-section {
    margin-bottom: 0 !important;
}

.form-group label {
    display: block;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.15rem;
}

.field-hint {
    margin-top: 0;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
    color: #9ca3af;
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

.form-group input:disabled,
.form-group textarea:disabled,
.form-group select:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
    opacity: 0.7;
}

.error-text {
    color: #dc2626;
    font-size: 0.85rem;
    margin-top: 0.5rem;
}

.validation-warning {
    color: #dc2626;
    font-size: 0.85rem;
    margin-top: 0.75rem;
    padding: 0.5rem;
    background: #fef2f2;
    border-radius: 6px;
}

/* ===== USERS GRID ===== */
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

/* ===== LISTA DE ASIGNADOS (solo lectura) ===== */
.assigned-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.assigned-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border-radius: 20px;
    font-size: 0.9rem;
    color: #374151;
}

.titular-chip-badge {
    background: #f59e0b;
    color: white;
    font-size: 0.65rem;
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

.no-changes-notice {
    text-align: center;
    color: #6b7280;
    font-size: 0.9rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 10px;
    margin-bottom: 1rem;
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

body.dark .form-section,
body.dark .switches-section {
    background: #1e293b;
    border-color: #334155;
}

body.dark .section-title {
    color: #e2e8f0;
    border-bottom-color: #334155;
}

body.dark .switch-group {
    background: #334155;
    border-color: #475569;
}

body.dark .switch-text,
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

body.dark .form-group input:disabled,
body.dark .form-group textarea:disabled,
body.dark .form-group select:disabled {
    background: #1e293b;
}

body.dark .user-chip {
    background: #334155;
    border-color: #475569;
}

body.dark .user-chip:hover,
body.dark .user-chip.selected {
    background: #3b5998;
}

body.dark .user-name {
    color: #f1f5f9;
}

body.dark .titular-info {
    background: linear-gradient(135deg, #78350f 0%, #92400e 100%);
    border-color: #f59e0b;
}

body.dark .titular-name {
    color: #fde68a;
}

body.dark .titular-hint {
    color: #fcd34d;
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

body.dark .message-box.error {
    background: #450a0a;
    border-color: #991b1b;
}

body.dark .message-box.success {
    background: #052e16;
    border-color: #166534;
}

body.dark .message-box.warning {
    background: #422006;
    border-color: #b45309;
}

body.dark .no-changes-notice {
    background: #334155;
    color: #94a3b8;
}

body.dark .assigned-chip {
    background: #334155;
    color: #e2e8f0;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 640px) {
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
