<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { getRecurringTaskDetailById, deactivateRecurringTask, updateRecurringTask } from "@/services/recurringTasks";
import { getUsersBySector } from "@/services/users";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const task = ref(null);
const loading = ref(true);
const error = ref("");
const successMsg = ref("");
const showTechnicalInfo = ref(false);
const updatingTask = ref(false);

// ===== GESTIÓN DE USUARIOS =====
const availableUsers = ref([]);
const selectedUsersToAdd = ref([]);
const loadingUsers = ref(false);
const savingUsers = ref(false);
const isSharedTask = ref(false);
const esCompartida = ref(false);
const esCompartidaOriginal = ref(false);
const usuariosSeleccionados = ref([]);

// Helper para obtener el ID del usuario actual
const getCurrentUserId = () => {
    const user = userStore.user;
    return user?._id ? String(user._id) : user?.id ? String(user.id) : null;
};

// ===== PERMISOS =====
// Solo el titular de la tarea (posición 0 de assignedTo) puede desactivar tareas recurrentes
const canEdit = computed(() => {
    if (!task.value?.assignedTo || task.value.assignedTo.length === 0) return false;
    const currentUserId = getCurrentUserId();
    const titular = task.value.assignedTo[0];
    
    if (typeof titular === 'object') {
        return String(titular._id || titular.id) === currentUserId;
    }
    return String(titular) === currentUserId;
});

// Verificar si la tarea ya fue desactivada (no se puede reactivar)
const isDeactivated = computed(() => {
    return task.value?.active === false || task.value?.deactivatedAt != null;
});

// Verificar si el usuario está asignado a la tarea
const isAssigned = computed(() => {
    if (!task.value?.assignedTo) return false;
    const currentUserId = getCurrentUserId();
    return task.value.assignedTo.some(assigned => {
        if (typeof assigned === 'object') {
            return (assigned._id || assigned.id) === currentUserId;
        }
        return assigned === currentUserId;
    });
});

// Verificar si un usuario es el titular (posición 0)
const isUserOwner = (user, index) => index === 0;

// ===== DESACTIVAR TAREA =====
// IMPORTANTE: Una vez desactivada, NO se puede volver a activar
const deactivateTask = async () => {
    if (!task.value || updatingTask.value || !canEdit.value || isDeactivated.value) return;
    
    // Mostrar confirmación
    const confirmed = confirm(
        "¿Está seguro de que desea desactivar la tarea recurrente?\n\n" +
        "Una vez que se desactive, NO se podrá volver a activar.\n\n" +
        "Las tareas individuales futuras no completadas serán eliminadas."
    );
    
    if (!confirmed) return;
    
    const taskId = task.value._id || task.value.id;
    
    try {
        updatingTask.value = true;
        
        const response = await deactivateRecurringTask(taskId);
        
        // Actualizar estado local con la fecha de desactivación
        task.value = {
            ...task.value,
            active: false,
            deactivatedAt: response.payload?.deactivatedAt || new Date().toISOString()
        };

        alert("Tarea recurrente desactivada correctamente");
    } catch (err) {
        console.error('Error al desactivar tarea recurrente:', err);
        error.value = err?.response?.data?.message || 'Error al desactivar la tarea';
        setTimeout(() => { error.value = ''; }, 5000);
    } finally {
        updatingTask.value = false;
    }
};

// ===== GESTIÓN DE USUARIOS =====
// Obtener IDs de usuarios actualmente asignados
const getAssignedUserIds = () => {
    if (!task.value?.assignedTo) return [];
    return task.value.assignedTo.map(user => {
        if (typeof user === 'object') {
            return String(user._id || user.id);
        }
        return String(user);
    });
};

// Estado inicial de usuarios asignados (para detectar cambios)
const initialAssignedUsers = ref([]);
// Usuarios a remover (desmarcados)
const usersToRemove = ref([]);

// ===== COMPUTED PARA ESTILO INLINE (como EditTaskView) =====

// ID del titular (posición 0)
const titularId = computed(() => {
    if (!task.value?.assignedTo?.length) return null;
    const first = task.value.assignedTo[0];
    if (typeof first === 'object') {
        return String(first._id || first.id);
    }
    return String(first);
});

// Info del titular
const titularInfo = computed(() => {
    if (!titularId.value) return null;
    return availableUsers.value.find(u => String(u._id || u.id) === titularId.value);
});

// Usuarios disponibles para asignar (excluyendo al titular)
const usuariosDisponibles = computed(() => {
    if (!titularId.value) return [];
    return availableUsers.value
        .filter(u => String(u._id || u.id) !== titularId.value)
        .sort((a, b) => (a.nombre || a.name || '').localeCompare(b.nombre || b.name || '', 'es', { sensitivity: 'base' }));
});

// Verificar si hay cambios en asignados
const hayaCambiosEnAsignados = computed(() => {
    if (!initialAssignedUsers.value.length) return false;
    
    const currentAssigned = construirListaAsignados();
    
    if (initialAssignedUsers.value.length !== currentAssigned.length) return true;
    
    const originalSorted = [...initialAssignedUsers.value].sort();
    const currentSorted = [...currentAssigned].sort();
    
    return originalSorted.some((id, idx) => id !== currentSorted[idx]);
});

// Validación: si se activa compartida sin agregar usuarios, no permitir guardar
const compartidaSinCambios = computed(() => {
    if (!esCompartidaOriginal.value && esCompartida.value) {
        return usuariosSeleccionados.value.length === 0;
    }
    return false;
});

// Usuarios disponibles para agregar (no asignados actualmente)
const usersToAdd = computed(() => {
    const assignedIds = getAssignedUserIds();
    return availableUsers.value.filter(user => !assignedIds.includes(String(user._id || user.id)));
});

// Usuarios asignados que pueden ser removidos (todos excepto el titular)
const removableUsers = computed(() => {
    if (!task.value?.assignedTo) return [];
    return task.value.assignedTo.slice(1); // Excluir posición 0 (titular)
});

// Verificar si un usuario está actualmente asignado a la tarea
const isUserCurrentlyAssigned = (user) => {
    const userId = String(user._id || user.id);
    const assignedIds = getAssignedUserIds();
    // Está asignado si: está en la lista Y no está marcado para remover
    return assignedIds.includes(userId) && !usersToRemove.value.includes(userId);
};

// Verificar si hay cambios pendientes
const hasChanges = computed(() => {
    return hayaCambiosEnAsignados.value;
});

// Manejar cambio en checkbox de usuario (mantenido por compatibilidad)
const handleUserCheckboxChange = (user, event) => {
    const userId = String(user._id || user.id);
    const isChecked = event.target.checked;
    const isCurrentlyAssigned = getAssignedUserIds().includes(userId);
    
    if (isChecked) {
        if (isCurrentlyAssigned) {
            const removeIndex = usersToRemove.value.indexOf(userId);
            if (removeIndex !== -1) {
                usersToRemove.value.splice(removeIndex, 1);
            }
        } else {
            if (!selectedUsersToAdd.value.includes(userId)) {
                selectedUsersToAdd.value.push(userId);
            }
        }
    } else {
        if (isCurrentlyAssigned) {
            if (!usersToRemove.value.includes(userId)) {
                usersToRemove.value.push(userId);
            }
        } else {
            const addIndex = selectedUsersToAdd.value.indexOf(userId);
            if (addIndex !== -1) {
                selectedUsersToAdd.value.splice(addIndex, 1);
            }
        }
    }
};

// ===== MÉTODOS PARA ESTILO INLINE (como EditTaskView) =====

// Toggle para seleccionar/deseleccionar usuario
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

// Construir lista de asignados para enviar al backend
const construirListaAsignados = () => {
    const titular = titularId.value;
    if (!titular) return [];
    
    // Si no es compartida, solo el titular
    if (!esCompartida.value) {
        return [titular];
    }
    
    // Si es compartida: titular + seleccionados
    return [titular, ...usuariosSeleccionados.value];
};

// Guardar cambios de usuarios
const guardarCambiosUsuarios = async () => {
    if (!hasChanges.value || savingUsers.value) return;
    
    error.value = "";
    successMsg.value = "";
    
    try {
        savingUsers.value = true;
        
        const newAssignedTo = construirListaAsignados();
        
        const response = await updateRecurringTask(task.value._id, {
            assignedTo: newAssignedTo
        });
        
        // Recargar datos completos
        const updatedTask = await getRecurringTaskDetailById(route.params.id);
        task.value = updatedTask;
        
        // Actualizar estados
        esCompartidaOriginal.value = updatedTask.assignedTo?.length > 1;
        esCompartida.value = updatedTask.assignedTo?.length > 1;
        isSharedTask.value = updatedTask.assignedTo?.length > 1;
        
        // Reinicializar usuarios seleccionados
        const allAssigned = getAssignedUserIds();
        usuariosSeleccionados.value = allAssigned.filter(id => id !== titularId.value);
        initialAssignedUsers.value = [...allAssigned];
        
        // Construir mensaje de éxito con info del email
        let msg = "✅ Tarea recurrente actualizada correctamente";
        const payload = response?.payload || response;
        if (payload?.newUsersNotified > 0) {
            if (payload?.emailSent) {
                msg += `. Se envió notificación por email a ${payload.emailsSentCount} usuario(s) agregado(s)`;
            } else if (payload?.emailError) {
                msg += `. ⚠️ No se pudo enviar el email de notificación`;
            }
        }
        successMsg.value = msg;
        setTimeout(() => { successMsg.value = ''; }, 6000);
        
    } catch (err) {
        console.error('Error al guardar cambios:', err);
        error.value = err?.response?.data?.message || 'Error al guardar cambios';
        setTimeout(() => { error.value = ''; }, 5000);
    } finally {
        savingUsers.value = false;
    }
};

// Aplicar todos los cambios (mantenido por compatibilidad)
const applyChanges = async () => {
    await guardarCambiosUsuarios();
};

// Cargar usuarios del sector
const cargarUsuarios = async () => {
    if (availableUsers.value.length > 0) return;
    
    try {
        loadingUsers.value = true;
        availableUsers.value = await getUsersBySector();
    } catch (err) {
        console.error('Error al cargar usuarios:', err);
        error.value = 'Error al cargar usuarios disponibles';
        setTimeout(() => { error.value = ''; }, 3000);
    } finally {
        loadingUsers.value = false;
    }
};

// Toggle selección de usuario para agregar
const toggleUserSelection = (userId) => {
    const index = selectedUsersToAdd.value.indexOf(userId);
    if (index === -1) {
        selectedUsersToAdd.value.push(userId);
    } else {
        selectedUsersToAdd.value.splice(index, 1);
    }
};

// Verificar si un usuario está seleccionado
const isUserSelected = (userId) => {
    return selectedUsersToAdd.value.includes(String(userId));
};

// Remover un usuario de la tarea
const removeUser = async (userToRemove) => {
    const userId = typeof userToRemove === 'object' 
        ? String(userToRemove._id || userToRemove.id) 
        : String(userToRemove);
    
    const userName = typeof userToRemove === 'object' 
        ? (userToRemove.name || userToRemove.nombre || 'este usuario') 
        : 'este usuario';
    
    const confirmed = confirm(`¿Está seguro de que desea remover a ${userName} de esta tarea recurrente?`);
    if (!confirmed) return;
    
    try {
        savingUsers.value = true;
        
        // Crear nuevo array sin el usuario a remover
        const newAssignedTo = getAssignedUserIds().filter(id => id !== userId);
        
        const response = await updateRecurringTask(task.value._id, {
            assignedTo: newAssignedTo
        });
        
        // Actualizar tarea local
        task.value = response.payload?.recurringTask || task.value;
        
        // Recargar datos completos
        const updatedTask = await getRecurringTaskDetailById(route.params.id);
        task.value = updatedTask;
        
        // Actualizar estado de tarea compartida
        isSharedTask.value = task.value.assignedTo.length > 1;
        
    } catch (err) {
        console.error('Error al remover usuario:', err);
        error.value = err?.response?.data?.message || 'Error al remover usuario';
        setTimeout(() => { error.value = ''; }, 5000);
    } finally {
        savingUsers.value = false;
    }
};

// Agregar usuarios seleccionados a la tarea
const addSelectedUsers = async () => {
    if (selectedUsersToAdd.value.length === 0) return;
    
    try {
        savingUsers.value = true;
        
        // Crear nuevo array con los usuarios actuales + los nuevos
        const currentIds = getAssignedUserIds();
        const newAssignedTo = [...currentIds, ...selectedUsersToAdd.value];
        
        const response = await updateRecurringTask(task.value._id, {
            assignedTo: newAssignedTo
        });
        
        // Actualizar tarea local
        task.value = response.payload?.recurringTask || task.value;
        
        // Recargar datos completos
        const updatedTask = await getRecurringTaskDetailById(route.params.id);
        task.value = updatedTask;
        
        // Limpiar selección y actualizar estado
        selectedUsersToAdd.value = [];
        isSharedTask.value = task.value.assignedTo.length > 1;
        
    } catch (err) {
        console.error('Error al agregar usuarios:', err);
        error.value = err?.response?.data?.message || 'Error al agregar usuarios';
        setTimeout(() => { error.value = ''; }, 5000);
    } finally {
        savingUsers.value = false;
    }
};

// Toggle para cambiar entre compartida/no compartida
const toggleSharedTask = async () => {
    if (savingUsers.value) return;
    
    const newIsShared = !isSharedTask.value;
    
    if (!newIsShared && task.value.assignedTo.length > 1) {
        // Si pasa a no compartida, preguntar confirmación
        const confirmed = confirm(
            '¿Está seguro de que desea quitar a todos los usuarios compartidos?\n\n' +
            'Solo quedará asignado el titular de la tarea.'
        );
        if (!confirmed) return;
        
        try {
            savingUsers.value = true;
            
            // Solo mantener el titular (posición 0)
            const titularId = getAssignedUserIds()[0];
            
            await updateRecurringTask(task.value._id, {
                assignedTo: [titularId]
            });
            
            // Recargar datos
            const updatedTask = await getRecurringTaskDetailById(route.params.id);
            task.value = updatedTask;
            isSharedTask.value = false;
            
        } catch (err) {
            console.error('Error al actualizar tarea:', err);
            error.value = err?.response?.data?.message || 'Error al actualizar tarea';
            setTimeout(() => { error.value = ''; }, 5000);
        } finally {
            savingUsers.value = false;
        }
    } else {
        // Solo cambia el estado visual, permite agregar usuarios
        isSharedTask.value = newIsShared;
    }
};

// ===== DATOS DE LA TAREA =====
onMounted(async () => {
    try {
        loading.value = true;
        
        // Cargar tarea y usuarios en paralelo
        const [taskData, usersData] = await Promise.all([
            getRecurringTaskDetailById(route.params.id),
            getUsersBySector()
        ]);
        
        task.value = taskData;
        availableUsers.value = usersData;
        
        // Configurar estados iniciales
        isSharedTask.value = taskData?.assignedTo?.length > 1;
        esCompartidaOriginal.value = taskData?.assignedTo?.length > 1;
        esCompartida.value = taskData?.assignedTo?.length > 1;
        
        // Inicializar usuarios seleccionados (excluyendo al titular)
        const allAssigned = getAssignedUserIds();
        const ownerIdVal = allAssigned[0];
        usuariosSeleccionados.value = allAssigned.filter(id => id !== ownerIdVal);
        initialAssignedUsers.value = [...allAssigned];
        
    } catch (e) {
        error.value = e?.response?.data?.message || "Error al cargar la tarea recurrente";
        console.error("Error al cargar tarea recurrente:", e);
    } finally {
        loading.value = false;
    }
});

// Watcher para esCompartida
watch(esCompartida, (nuevoValor) => {
    if (!nuevoValor) {
        // Al desactivar compartida, limpiar usuarios seleccionados
        usuariosSeleccionados.value = [];
    }
});

// Formatear fechas
const formatDate = (dateString) => {
    if (!dateString) return "No especificada";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatShortDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR");
};

// Mapear periodicidad a texto legible
const getPeriodicityLabel = (periodicity) => {
    const labels = {
        DIARIA: "Diaria",
        SEMANAL: "Semanal",
        QUINCENAL: "Quincenal",
        MENSUAL: "Mensual",
    };
    return labels[periodicity] || periodicity;
};

// Mapear día de la semana
const getDayLabel = (day) => {
    const labels = {
        LUNES: "Lunes",
        MARTES: "Martes",
        MIERCOLES: "Miércoles",
        JUEVES: "Jueves",
        VIERNES: "Viernes",
        SABADO: "Sábado",
        DOMINGO: "Domingo",
    };
    return labels[day] || day;
};

// Obtener descripción del patrón de repetición
const getPatternDescription = computed(() => {
    if (!task.value) return "";
    
    const periodicity = task.value.periodicity;
    const datePattern = task.value.datePattern;
    const numberPattern = task.value.numberPattern;
    
    if (periodicity === "DIARIA") {
        return "Se repite todos los días";
    }
    
    if (periodicity === "SEMANAL" && datePattern) {
        return `Se repite cada semana los días ${getDayLabel(datePattern)}`;
    }
    
    if (periodicity === "QUINCENAL" && datePattern) {
        return `Se repite cada dos semanas los días ${getDayLabel(datePattern)}`;
    }
    
    if (periodicity === "MENSUAL" && numberPattern) {
        return `Se repite el día ${numberPattern} de cada mes`;
    }
    
    return `Periodicidad: ${getPeriodicityLabel(periodicity)}`;
});

// Navegación
const goBack = () => router.push("/recurrent");
</script>

<template>
    <div class="task-detail-container">
        <div class="back-link" @click="goBack">← Volver a tareas recurrentes</div>

        <!-- Loading -->
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <span>Cargando tarea recurrente...</span>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="error-state">
            <span>{{ error }}</span>
            <button @click="goBack" class="btn-back">Volver</button>
        </div>

        <!-- Contenido -->
        <div v-else-if="task" class="task-card">
            <!-- Mensajes de alerta -->
            <Transition name="fade">
                <div v-if="error" class="message-box error">
                    {{ error }}
                </div>
            </Transition>
            <Transition name="fade">
                <div v-if="successMsg" class="message-box success">
                    {{ successMsg }}
                </div>
            </Transition>

            <!-- Header con estado -->
            <div class="task-header">
                <span class="status-badge" :class="task.active !== false ? 'status-active' : 'status-inactive'">
                    {{ task.active !== false ? 'Activa' : 'Desactivada' }}
                </span>
            </div>

            <!-- Mostrar fecha de desactivación si está desactivada -->
            <div v-if="isDeactivated && task.deactivatedAt" class="deactivated-notice">
                <span class="notice-icon">⚠️</span>
                <span class="notice-text">
                    Esta tarea fue desactivada el {{ formatDate(task.deactivatedAt) }} y no puede reactivarse
                </span>
            </div>

            

            
            <!-- Leyenda si no es titular -->
            <div v-else-if="!canEdit" class="not-supervisor-notice">
                <span class="notice-icon">ℹ️</span>
                <span class="notice-text">Solo el titular de la tarea puede desactivarla</span>
            </div>

            <!-- Título -->
            <h1 class="task-title">{{ task.title }}</h1>

            <!-- Descripción del patrón -->
            <div class="pattern-description">
                <span class="pattern-text">{{ getPatternDescription }}</span>
            </div>

            <!-- Descripción -->
            <div class="task-section">
                <span class="section-label">DESCRIPCIÓN</span>
                <p class="task-description">{{ task.description || 'Sin descripción' }}</p>
            </div>

            <!-- Fechas -->
            <div class="task-section">
                <span class="section-label">FECHA Y HORA</span>
            </div>
            <div class="dates-grid">
                <div class="date-card">
                    <div class="date-content">
                        <span class="date-label">FECHA DE INICIO</span>
                        <span class="date-value">{{ formatDate(task.date) }}</span>
                        <span class="date-label">VENCIMIENTO (Primera Tarea)</span>
                        <span class="date-value">{{ formatDate(task.deadline) }}</span>
                        <span class="date-label">CREADA EL</span>
                        <span class="date-value">{{ formatDate(task.createdAt) }}</span>
                    </div>
                </div>
            </div>

            <!-- ===== INFORMACIÓN DEL TITULAR ===== -->
            <div class="form-section" v-if="titularInfo || titularId">
                <h3 class="section-title">Titular de la tarea</h3>
                <div class="titular-info">
                    <span class="titular-badge">👑 Titular</span>
                    <span class="titular-name" v-if="titularInfo">
                        {{ titularInfo.nombre || titularInfo.name }}
                        <span v-if="titularId === getCurrentUserId()" class="you-badge">(Tú)</span>
                    </span>
                    <span class="titular-hint">
                        Solo el titular puede editar esta tarea
                    </span>
                </div>
            </div>

            <!-- ===== SWITCH DE COMPARTIDA (solo si puede editar y no está desactivada) ===== -->
            <div class="switches-section" v-if="canEdit && !isDeactivated">
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

            <!-- ===== ASIGNACIÓN DE USUARIOS (Solo si está habilitado compartir y puede editar) ===== -->
            <Transition name="slide-fade">
                <div class="form-section" v-if="esCompartida && canEdit && !isDeactivated">
                    <h3 class="section-title">Usuarios Asignados</h3>
                    
                    <p class="field-hint" style="margin-bottom: 1rem;">
                        Seleccioná otros usuarios para compartir la tarea. El titular no puede ser removido.
                    </p>

                    <div v-if="loadingUsers" class="loading-users">
                        <div class="spinner-small"></div>
                        <span>Cargando usuarios...</span>
                    </div>

                    <div v-else class="users-grid">
                        <div 
                            v-for="usuario in usuariosDisponibles" 
                            :key="usuario._id || usuario.id"
                            class="user-chip"
                            :class="{ selected: usuariosSeleccionados.includes(String(usuario._id || usuario.id)) }"
                            @click="toggleUsuario(String(usuario._id || usuario.id))"
                        >
                            <span class="user-avatar">{{ (usuario.nombre || usuario.name || 'U').charAt(0).toUpperCase() }}</span>
                            <div class="user-info">
                                <span class="user-name">{{ usuario.nombre || usuario.name }}</span>
                                <span class="user-email">{{ usuario.email }}</span>
                            </div>
                            <span class="check-icon" v-if="usuariosSeleccionados.includes(String(usuario._id || usuario.id))">✓</span>
                        </div>
                    </div>

                    <p class="field-hint" v-if="usuariosSeleccionados.length > 0" style="margin-top: 0.75rem;">
                        {{ usuariosSeleccionados.length }} usuario(s) adicional(es) seleccionado(s)
                    </p>

                    <p v-if="compartidaSinCambios" class="validation-warning">
                        ⚠️ Debes agregar al menos un usuario para convertir la tarea en compartida, o desactivar el switch
                    </p>

                    <!-- Info importante sobre cambios -->
                    <div class="recurring-users-notice" style="margin-top: 1rem;">
                        <span class="info-icon">ℹ️</span>
                        <span class="info-text">
                            Los cambios se aplicarán a las tareas futuras. Las tareas pasadas conservarán sus usuarios originales.
                        </span>
                    </div>

                    <!-- Botones de acción -->
                    <div class="users-actions" v-if="hasChanges">
                        <button 
                            class="btn-secondary"
                            @click="() => { 
                                const allAssigned = getAssignedUserIds(); 
                                usuariosSeleccionados = allAssigned.filter(id => id !== titularId); 
                                esCompartida = esCompartidaOriginal;
                            }"
                        >
                            Cancelar
                        </button>
                        <button 
                            class="btn-primary"
                            :disabled="savingUsers || compartidaSinCambios"
                            @click="guardarCambiosUsuarios"
                        >
                            <span v-if="savingUsers" class="btn-spinner"></span>
                            {{ savingUsers ? "Guardando..." : "Guardar cambios" }}
                        </button>
                    </div>
                </div>
            </Transition>

            <!-- ===== LISTA DE ASIGNADOS ACTUAL (solo lectura si no puede editar o está desactivada) ===== -->
            <div class="form-section" v-if="(!canEdit || isDeactivated || !esCompartida) && task.assignedTo?.length > 0">
                <h3 class="section-title">Usuarios Asignados</h3>
                <div class="assigned-list">
                    <div 
                        v-for="(user, index) in task.assignedTo" 
                        :key="user._id || user.id || index"
                        class="assigned-chip"
                        :class="{ 'is-owner': isUserOwner(user, index) }"
                    >
                        <span class="titular-chip-badge" v-if="isUserOwner(user, index)">👑 Titular</span>
                        {{ typeof user === 'object' ? (user.name || user.nombre || user.fullname || 'Usuario') : 'Usuario' }}
                    </div>
                </div>
            </div>

            <!-- Info de recurrencia -->
            <div class="recurring-info-notice">
                <span class="recurring-icon">ℹ️</span>
                <span class="recurring-text">Esta configuración genera tareas automáticamente según su periodicidad</span>
            </div>

            <!-- INFORMACIÓN TÉCNICA -->
            <div class="technical-section">
                <!-- <div class="technical-header" @click="showTechnicalInfo = !showTechnicalInfo">
                    <span class="technical-icon">🔧</span>
                    <span class="technical-label">Información técnica</span>
                    <span class="expand-icon">{{ showTechnicalInfo ? '▼' : '▶' }}</span>
                </div> -->
                <Transition name="slide">
                    <div v-if="showTechnicalInfo" class="technical-content">
                        <div class="tech-row">
                            <span class="tech-label">ID:</span>
                            <code class="tech-value">{{ task._id }}</code>
                        </div>
                        <div class="tech-row">
                            <span class="tech-label">Periodicidad:</span>
                            <code class="tech-value">{{ task.periodicity }}</code>
                        </div>
                        <div class="tech-row" v-if="task.datePattern">
                            <span class="tech-label">Patrón día:</span>
                            <code class="tech-value">{{ task.datePattern }}</code>
                        </div>
                        <div class="tech-row" v-if="task.numberPattern">
                            <span class="tech-label">Patrón número:</span>
                            <code class="tech-value">{{ task.numberPattern }}</code>
                        </div>
                        <div class="tech-row">
                            <span class="tech-label">Estado:</span>
                            <span :class="task.active !== false ? 'tech-yes' : 'tech-no'">
                                {{ task.active !== false ? 'Activa' : 'Inactiva' }}
                            </span>
                        </div>
                        <div class="tech-row">
                            <span class="tech-label">¿Puedo editar?:</span>
                            <span :class="canEdit ? 'tech-yes' : 'tech-no'">{{ canEdit ? 'Sí' : 'No' }}</span>
                        </div>
                    </div>
                </Transition>
            </div>

            <!-- Botón para desactivar (solo supervisores y si está activa) -->
            <div v-if="canEdit && !isDeactivated" class="deactivate-task-section">
                <span class = "deactivate-title">Desactivar Tarea Recurrente</span>    
                <button 
                    class="btn-deactivate"
                    :class="{ 'is-loading': updatingTask }"
                    :disabled="updatingTask"
                    @click="deactivateTask"
                >
                    <span v-if="updatingTask">Desactivando...</span>
                    <span class="icon" v-else>⏸</span>
                    <span class="label">Desactivar</span>
                </button>
                <p class="deactivate-warning">
                    La desactivación pausa la creación de nuevas instancias de estas tareas. Esta acción es permanente.
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.task-detail-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 1rem;
}

.back-link {
    color: #6b7280;
    cursor: pointer;
    margin-bottom: 1.5rem;
    font-weight: 500;
    transition: color 0.2s;
}

.back-link:hover {
    color: #8b5cf6;
}

/* Loading & Error */
.loading-state,
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem;
    color: #6b7280;
}

/* Message boxes */
.message-box {
    padding: 1rem 1.25rem;
    border-radius: 10px;
    margin-bottom: 1rem;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.message-box.error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
}

.message-box.success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #16a34a;
}

.message-box.warning {
    background: #fffbeb;
    border: 1px solid #fde68a;
    color: #d97706;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #8b5cf6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.btn-back {
    padding: 0.5rem 1rem;
    background: #8b5cf6;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}

/* Task Card */
.task-card {
    background: #1e293b;
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

/* Header */
.task-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.85rem;
}

.status-icon {
    font-size: 0.9rem;
}

.status-active {
    background: #ede9fe;
    color: #7c3aed;
    border: 1px solid #8b5cf6;
}

.status-inactive {
    background: #f3f4f6;
    color: #6b7280;
    border: 1px solid #9ca3af;
}

/* Botón Eliminar */
.btn-delete {
    width: 80px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #dd4c4c);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-delete:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(177, 55, 55, 0.4);
}

.deactivate-task-section {
  display: flex;
  flex-direction: column;
  align-items: center;      /* ✅ centra horizontal */
  justify-content: center;  /* ✅ centra vertical */
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 12px;
  margin-top: 2rem;         /* ⬅️ separación respecto al contenido */
}

.deactivate-title {
    font-size: 1.3rem;
    font-weight: 600;
    color: #000000;
}

body.dark .deactivate-title {
    color: #ffffff;
}

.btn-deactivate {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 56px;              
  height: 56px;
  padding-left: 0;

  background: linear-gradient(135deg, #dd4c4c);
  color: white;
  border: none;
  border-radius: 999px;

  font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;

  overflow: hidden;
  white-space: nowrap;

  transition:
  width 0.25s ease,
  box-shadow 0.2s ease;
}

.btn-deactivate:hover {
  width: 170px;             
  justify-content: flex-start;
  padding-left: 16px;     
  background: #cc4646;
  box-shadow: 0 10px 24px rgba(0,0,0,0.25);
}


.btn-deactivate:active {
  background: #801515;
}

.btn-deactivate.is-loading {
  opacity: 0.7;
  cursor: not-allowed;
}

.icon {
  width: 20px;
  height: 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 1.75rem;      
  font-weight: 700;
  line-height: 1;

  flex-shrink: 0;

  transform: translateX(+15px);
  padding-bottom: 5px;
}



.btn-deactivate .label {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1;
margin-left: 18px;

  opacity: 0;
  transform: translateX(-6px);
  padding-left: 10px;
  padding-top: 2.2px;

  max-width: 0;
  overflow: hidden;

  transition:
    max-width 0.25s ease,
    opacity 0.2s ease,
    transform 0.2s ease;
}

.btn-deactivate:hover .label {
  max-width: 140px;
  opacity: 1;
  transform: translateX(0);
}


.btn-deactivate:hover .label {
  max-width: 120px;
  opacity: 1;
  transform: translateX(0);
}

.btn-deactivate.is-loading {
    opacity: 0.7;
}

.deactivate-warning {
    margin: 0.75rem 0 0 0;
    font-size: 0.8rem;
    color: #cc4646;
    text-align: center;
}

/* Deactivated Notice */
.deactivated-notice {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.deactivated-notice .notice-text {
    color: #92400e;
    font-size: 0.9rem;
    font-weight: 500;
}

/* Already Deactivated Notice */
.already-deactivated-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    margin-bottom: 1.5rem;
    color: #6b7280;
    font-size: 0.9rem;
}

/* Toggle Section (deprecated - kept for backward compatibility) */
.toggle-task-section {
    display: flex;
    align-items: center;
    padding: 1rem;
    background: #ede9fe !important;
    border: 1px solid #8b5cf6 !important;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.toggle-switch {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
}

.toggle-switch.is-loading {
    opacity: 0.6;
    pointer-events: none;
}

.toggle-switch input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
}

.switch-slider {
    position: relative;
    width: 50px;
    height: 26px;
    background: #6b7280;
    border-radius: 26px;
    transition: all 0.3s ease;
    flex-shrink: 0;
}

.switch-slider::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch input:checked + .switch-slider {
    background: #8b5cf6;
}

.toggle-switch input:checked + .switch-slider::before {
    transform: translateX(24px);
}

.toggle-switch:hover .switch-slider {
    background: #9ca3af;
}

.toggle-switch input:checked:hover + .switch-slider {
    background: #7c3aed;
}

.switch-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: #1f2937;
}

/* Notice no supervisor */
.not-supervisor-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #374151;
    border-radius: 10px;
    margin-bottom: 1.5rem;
    color: #9ca3af;
    font-size: 0.9rem;
}

/* Título */
.task-title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #f1f5f9;
    margin: 0 0 1rem 0;
}

/* Badge de periodicidad */
.periodicity-badge-container {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
}

.periodicity-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem 0.8rem;
    background: #4c1d95;
    color: #c4b5fd;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.85rem;
}

.pattern-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem 0.8rem;
    background: #374151;
    color: #9ca3af;
    border-radius: 20px;
    font-size: 0.85rem;
}

/* Descripción del patrón */
.pattern-description {
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #312e81 0%, #4c1d95 100%);
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.pattern-text {
    color: #c4b5fd;
    font-size: 0.95rem;
    font-weight: 500;
}

/* Secciones */
.task-section {
    margin-top: 0;
    margin-bottom: 1.5rem;
}

.section-label {
    font-size: 0.8rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.task-description {
    margin-top: 0.5rem;
    padding: 1rem;
    background: #334155;
    border-radius: 10px;
    line-height: 1.6;
    margin-bottom: 2rem;
    font-weight: 500;
    color: #f1f5f9;
}

/* Grid de fechas */
.dates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
    margin-top: 0.5rem;
}

.date-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: #334155;
    border-radius: 10px;
}

.date-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.date-label {
    font-size: 0.7rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.5rem;
}

.date-label:first-child {
    margin-top: 0;
}

.date-value {
    color: #f1f5f9;
    font-weight: 500;
}

/* Lista de usuarios */
.users-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.user-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #334155;
    border-radius: 10px;
    transition: background 0.2s;
}

.user-item:hover {
    background: #3b4a63;
}

.user-item.is-owner {
    background: linear-gradient(135deg, #422006 0%, #78350f 100%);
    border: 1px solid #f59e0b;
}

.user-name {
    flex: 1;
    color: #f1f5f9;
    font-weight: 500;
}

.owner-badge {
    background: #f59e0b;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
}

/* Notice de info recurrencia */
.recurring-info-notice {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #312e81;
    border: 1px solid #4f46e5;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.recurring-icon {
    font-size: 1rem;
}

.recurring-text {
    color: #c7d2fe;
    font-size: 0.85rem;
}

/* Información técnica */
.technical-section {
    background: #0f172a;
    border-radius: 10px;
    overflow: hidden;
}

.technical-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s;
}

.technical-header:hover {
    background: #1e293b;
}

.technical-icon {
    font-size: 0.9rem;
}

.technical-label {
    flex: 1;
    color: #9ca3af;
    font-size: 0.85rem;
}

.expand-icon {
    color: #6b7280;
    font-size: 0.7rem;
}

.technical-content {
    padding: 0 1rem 1rem;
}

.tech-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #1e293b;
}

.tech-row:last-child {
    border-bottom: none;
}

.tech-label {
    color: #9ca3af;
    font-size: 0.8rem;
    min-width: 120px;
}

.tech-value {
    color: #a78bfa;
    font-size: 0.75rem;
    background: #1e293b;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    word-break: break-all;
}

.tech-yes {
    color: #4ade80;
    font-weight: 600;
}

.tech-no {
    color: #f87171;
    font-weight: 600;
}

/* Transiciones */
.slide-enter-active,
.slide-leave-active {
    transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
    opacity: 1;
    max-height: 200px;
}

/* Light mode */
body:not(.dark) .task-card {
    background: #ffffff;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

body:not(.dark) .task-title {
    color: #1f2937;
}

body:not(.dark) .task-description,
body:not(.dark) .date-card,
body:not(.dark) .user-item {
    background: #f3f4f6;
}

body:not(.dark) .user-item.is-owner {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

body:not(.dark) .date-value,
body:not(.dark) .user-name {
    color: #1f2937;
}

body:not(.dark) .task-description {
    color: #374151;
}

body:not(.dark) .periodicity-badge {
    background: #ede9fe;
    color: #7c3aed;
}

body:not(.dark) .pattern-badge {
    background: #f3f4f6;
    color: #6b7280;
}

body:not(.dark) .pattern-description {
    background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
}

body:not(.dark) .pattern-text {
    color: #6d28d9;
}

body:not(.dark) .status-active {
    background: #ede9fe;
    color: #7c3aed;
}

body:not(.dark) .technical-section {
    background: #f9fafb;
}

body:not(.dark) .technical-header:hover {
    background: #f3f4f6;
}

body:not(.dark) .tech-value {
    background: #e5e7eb;
    color: #7c3aed;
}

body:not(.dark) .not-supervisor-notice {
    background: #f3f4f6;
    color: #6b7280;
}

body:not(.dark) .recurring-info-notice {
    background: #ede9fe;
    border-color: #8b5cf6;
}

body:not(.dark) .recurring-text {
    color: #6d28d9;
}

/* ===== SECCIÓN DE USUARIOS CON BOTÓN ===== */
.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
}

.btn-manage-users {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-manage-users:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
}

/* ===== MODAL GESTIÓN DE USUARIOS ===== */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
}

.modal-content {
    background: #1e293b;
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #374151;
}

.modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #f1f5f9;
}

.btn-close-modal {
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.2s;
}

.btn-close-modal:hover {
    color: #ef4444;
}

.modal-body {
    padding: 1.5rem;
}

.modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #374151;
    display: flex;
    justify-content: flex-end;
}

/* Switch tarea compartida */
.shared-toggle-section {
    background: #374151;
    padding: 1rem;
    border-radius: 10px;
    margin-bottom: 1.5rem;
}

.toggle-description {
    margin: 0.5rem 0 0 0;
    font-size: 0.85rem;
    color: #9ca3af;
}

/* Secciones de usuarios en modal */
.users-section,
.add-users-section {
    margin-bottom: 1.5rem;
}

.users-section h3,
.add-users-section h3 {
    font-size: 0.9rem;
    color: #9ca3af;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Lista de usuarios actuales */
.current-users-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.current-user-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #374151;
    border-radius: 8px;
    transition: background 0.2s;
}

.current-user-item.is-titular {
    background: linear-gradient(135deg, #4c1d95, #6d28d9);
    border: 1px solid #8b5cf6;
}

.user-info {
    display: flex;
    align-items: left;
    gap: 0.1rem;
}

.user-avatar {
    width: 36px;
    height: 36px;
    background: #6b7280;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: white;
    font-size: 0.9rem;
}

.current-user-item.is-titular .user-avatar {
    background: #8b5cf6;
}

.user-name-modal {
    color: #f1f5f9;
    font-weight: 500;
}

.titular-badge {
    font-size: 0.75rem;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.2);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
}

.btn-remove-user {
    width: 28px;
    height: 28px;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    transition: all 0.2s;
}

.btn-remove-user:hover:not(:disabled) {
    background: #b91c1c;
    transform: scale(1.1);
}

.btn-remove-user:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Loading usuarios */
.loading-users {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    color: #9ca3af;
}

.spinner-small {
    width: 20px;
    height: 20px;
    border: 2px solid #374151;
    border-top-color: #8b5cf6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.no-users-available {
    padding: 1rem;
    text-align: center;
    color: #6b7280;
    background: #374151;
    border-radius: 8px;
}

/* Lista de usuarios disponibles para agregar */
.available-users-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
}

.available-user-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #374151;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    border: 2px solid transparent;
}

.available-user-item:hover {
    background: #4b5563;
}

.available-user-item.is-selected {
    background: #312e81;
    border-color: #8b5cf6;
}

.check-indicator {
    margin-left: auto;
    color: #8b5cf6;
    font-weight: bold;
    font-size: 1.1rem;
}

/* Botón agregar seleccionados */
.btn-add-selected {
    width: 100%;
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #059669, #047857);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-add-selected:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4);
}

.btn-add-selected:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Info notice en modal */
.modal-info-notice {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: #1e3a5f;
    border: 1px solid #3b82f6;
    border-radius: 8px;
    margin-top: 1rem;
}

.info-icon {
    flex-shrink: 0;
}

.info-text {
    font-size: 0.85rem;
    color: #93c5fd;
    line-height: 1.5;
}

/* ===== NUEVO DISEÑO MODAL - ESTILO FORMULARIO ===== */

/* Sección checkbox titular */
.titular-checkbox-section {
    margin-bottom: 1.5rem;
}

.user-checkbox-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
}

.user-checkbox-item:hover:not(.titular-item) {
    background: #f1f5f9;
    border-color: #cbd5e1;
}

.user-checkbox-item.titular-item {
    background: #f8fafc;
    cursor: default;
}

.user-checkbox-item.is-selected {
    background: #ede9fe;
    border-color: #8b5cf6;
}

.checkbox-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.checkbox-label {
    font-size: 0.95rem;
    color: #1f2937;
    font-weight: 500;
}

.user-checkbox {
    width: 20px;
    height: 20px;
    accent-color: #8b5cf6;
    cursor: pointer;
}

.user-checkbox:disabled {
    cursor: default;
    opacity: 0.6;
}

/* Sección Asignar a */
.assign-section {
    margin-bottom: 1.5rem;
}

.assign-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
}

.assign-subtitle {
    font-size: 0.85rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
}

/* Lista de usuarios con checkbox */
.users-checkbox-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 300px;
    overflow-y: auto;
}

.user-checkbox-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.user-avatar-checkbox {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: white;
    font-size: 1rem;
    flex-shrink: 0;
}

.user-details {
    display: flex;
    flex-direction: column;
}

.user-name-checkbox {
    font-size: 0.95rem;
    font-weight: 500;
    color: #1f2937;
}

.user-email-checkbox {
    font-size: 0.8rem;
    color: #6b7280;
}

/* Modal footer con botones */
.modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}

.btn-cancel {
    padding: 0.6rem 1.25rem;
    background: #f3f4f6;
    color: #4b5563;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-cancel:hover {
    background: #e5e7eb;
}

.btn-apply-changes {
    padding: 0.6rem 1.5rem;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-apply-changes:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.btn-apply-changes:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Modal light mode overrides */
.modal-content {
    background: #ffffff;
}

.modal-header {
    border-bottom: 1px solid #e2e8f0;
}

.modal-header h2 {
    color: #1f2937;
    font-size: 1.1rem;
}

.btn-close-modal {
    color: #6b7280;
}

.btn-close-modal:hover {
    color: #ef4444;
}

.modal-body {
    background: #ffffff;
}

/* Info notice light mode */
.modal-info-notice {
    background: #eff6ff;
    border-color: #bfdbfe;
}

.info-text {
    color: #1e40af;
}

/* Botón cerrar modal (legacy) */
.btn-close {
    padding: 0.6rem 1.5rem;
    background: #4b5563;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.btn-close:hover {
    background: #6b7280;
}

/* Transiciones del modal */
.modal-enter-active,
.modal-leave-active {
    transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
    transform: scale(0.9) translateY(-20px);
}

/* Responsive */
@media (max-width: 640px) {
    .task-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .dates-grid {
        grid-template-columns: 1fr;
    }

    .periodicity-badge-container {
        flex-direction: column;
    }

    .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .btn-manage-users {
        width: 100%;
        justify-content: center;
    }

    .modal-content {
        margin: 0.5rem;
        max-height: 95vh;
    }

    .modal-footer {
        flex-direction: column;
    }

    .btn-cancel,
    .btn-apply-changes {
        width: 100%;
        justify-content: center;
    }

    .users-actions {
        flex-direction: column;
    }

    .users-actions .btn-primary,
    .users-actions .btn-secondary {
        width: 100%;
        justify-content: center;
    }
}

/* ===== ESTILOS INLINE PARA USUARIOS (como EditTaskView) ===== */

/* Secciones del formulario */
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

/* Información del titular */
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

/* Switches */
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
    background: #8b5cf6;
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

/* Field hints */
.field-hint {
    margin-top: 0;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
    color: #9ca3af;
}

.validation-warning {
    color: #dc2626;
    font-size: 0.85rem;
    margin-top: 0.75rem;
    padding: 0.5rem;
    background: #fef2f2;
    border-radius: 6px;
}

/* Notice para info de recurrencia en usuarios */
.recurring-users-notice {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
}

.recurring-users-notice .info-icon {
    flex-shrink: 0;
}

.recurring-users-notice .info-text {
    font-size: 0.85rem;
    color: #1e40af;
    line-height: 1.5;
}

/* Botones de acción de usuarios */
.users-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
}

.btn-primary,
.btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.btn-primary {
    background: linear-gradient(135deg, #4f83cc, #6366f1);
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
    background: #f3f4f6;
    color: #4b5563;
    border: 1px solid #d1d5db;
}

.btn-secondary:hover {
    background: #e5e7eb;
}

.btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

/* Lista de asignados (solo lectura) */
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

.assigned-chip.is-owner {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b;
}

.titular-chip-badge {
    background: #f59e0b;
    color: white;
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;
}

/* Transiciones */
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

/* Dark mode overrides para estilos inline */
body.dark .form-section,
body.dark .switches-section {
    background: #1e293b;
    border-color: #374151;
}

body.dark .section-title {
    color: #f1f5f9;
    border-bottom-color: #374151;
}

body.dark .switch-group {
    background: #374151;
    border-color: #4b5563;
}

body.dark .switch-text {
    color: #f1f5f9;
}

body.dark .switch-hint {
    color: #9ca3af;
}

body.dark .users-grid {
    background: #0f172a;
    border-color: #374151;
}

body.dark .user-chip {
    background: #1e293b;
    border-color: #374151;
}

body.dark .user-chip:hover {
    background: #334155;
    border-color: #8b5cf6;
}

body.dark .user-chip.selected {
    background: #312e81;
    border-color: #8b5cf6;
}

body.dark .user-chip .user-name {
    color: #f1f5f9;
}

body.dark .user-email {
    color: #9ca3af;
}

body.dark .field-hint {
    color: #9ca3af;
}

body.dark .validation-warning {
    background: rgba(220, 38, 38, 0.2);
}

body.dark .recurring-users-notice {
    background: #1e3a5f;
    border-color: #3b82f6;
}

body.dark .recurring-users-notice .info-text {
    color: #93c5fd;
}

body.dark .users-actions {
    border-top-color: #374151;
}

body.dark .btn-secondary {
    background: #374151;
    color: #e5e7eb;
    border-color: #4b5563;
}

body.dark .btn-secondary:hover {
    background: #4b5563;
}

body.dark .assigned-chip {
    background: #374151;
    color: #f1f5f9;
}

body.dark .assigned-chip.is-owner {
    background: linear-gradient(135deg, #422006 0%, #78350f 100%);
}

body.dark .titular-info {
    background: linear-gradient(135deg, #422006 0%, #78350f 100%);
}

body.dark .titular-name {
    color: #fde68a;
}

body.dark .titular-hint {
    color: #fcd34d;
}
</style>
