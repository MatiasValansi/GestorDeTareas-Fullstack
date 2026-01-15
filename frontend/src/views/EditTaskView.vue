<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { getTaskById, updateTask, getTaskOwnerId, canEditTask } from "@/services/tasks";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const tarea = ref(null);
const loading = ref(false);
const errorMsg = ref("");
const successMsg = ref("");

// Helper para obtener ID del usuario actual
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

onMounted(async () => {
    try {
        const data = await getTaskById(route.params.id);
        if (data) {
            tarea.value = {
                ...data,
                date: toDatetimeLocal(data.date),
                deadline: toDatetimeLocal(data.deadline),
            };
        }
        
        // Debug
        const userId = getCurrentUserId();
        const ownerId = getTaskOwnerId(tarea.value);
        console.log("Usuario actual:", userId);
        console.log("Titular tarea:", ownerId);
        console.log("¿Puede editar?:", canEditTask(tarea.value, userId));
    } catch (e) {
        errorMsg.value = e?.response?.data?.message || "Error al cargar la tarea";
    }
});

// Computed properties para permisos
const isOwner = computed(() => {
    return getTaskOwnerId(tarea.value) === getCurrentUserId();
});

const isExpired = computed(() => {
    if (!tarea.value?.deadline) return false;
    // Comparar con la fecha original, no la formateada
    const deadline = new Date(tarea.value.deadline);
    return deadline < new Date();
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

async function editarTarea() {
    errorMsg.value = "";
    successMsg.value = "";

    if (!canEdit.value) {
        errorMsg.value = editBlockReason.value;
        return;
    }

    try {
        loading.value = true;

        const payload = {
            title: tarea.value.title,
            description: tarea.value.description,
            status: tarea.value.status,
            completed: tarea.value.completed,
            date: tarea.value.date,
            deadline: tarea.value.deadline,
        };

        await updateTask(route.params.id, payload);
        successMsg.value = "Tarea actualizada correctamente";
        
        setTimeout(() => router.push("/tasks"), 1500);
    } catch (e) {
        errorMsg.value = e?.response?.data?.message || e?.message || "Error al actualizar";
        console.error("Error al editar:", e);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="max-w-xl mx-auto p-6">
        <h1 class="text-2xl font-bold mb-4">Editar Tarea</h1>

        <router-link to="/tasks" class="text-teal-500 hover:underline mb-4 inline-block">
            ← Volver al listado
        </router-link>

        <!-- Mensajes -->
        <div v-if="errorMsg" class="bg-red-100 text-red-700 p-3 rounded mb-4">
            {{ errorMsg }}
        </div>
        <div v-if="successMsg" class="bg-green-100 text-green-700 p-3 rounded mb-4">
            {{ successMsg }}
        </div>

        <!-- Aviso de bloqueo -->
        <div v-if="!canEdit && tarea" class="bg-yellow-100 text-yellow-800 p-3 rounded mb-4">
            <strong>No puedes editar esta tarea:</strong> {{ editBlockReason }}
        </div>

        <!-- Formulario -->
        <form v-if="tarea" @submit.prevent="editarTarea" class="space-y-4">
            <div>
                <label class="block font-medium mb-1">Título</label>
                <input
                    v-model="tarea.title"
                    type="text"
                    class="w-full border rounded p-2"
                    :disabled="!canEdit"
                />
            </div>

            <div>
                <label class="block font-medium mb-1">Descripción</label>
                <textarea
                    v-model="tarea.description"
                    class="w-full border rounded p-2"
                    rows="3"
                    :disabled="!canEdit"
                ></textarea>
            </div>

            <div>
                <label class="block font-medium mb-1">Estado</label>
                <select
                    v-model="tarea.status"
                    class="w-full border rounded p-2"
                    :disabled="!canEdit"
                >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="EN_PROGRESO">En progreso</option>
                    <option value="COMPLETADA">Completada</option>
                </select>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block font-medium mb-1">Fecha</label>
                    <input
                        v-model="tarea.date"
                        type="datetime-local"
                        class="w-full border rounded p-2"
                        :disabled="!canEdit"
                    />
                </div>
                <div>
                    <label class="block font-medium mb-1">Vencimiento</label>
                    <input
                        v-model="tarea.deadline"
                        type="datetime-local"
                        class="w-full border rounded p-2"
                        :disabled="!canEdit"
                    />
                </div>
            </div>

            <button
                type="submit"
                :disabled="!canEdit || loading"
                class="w-full bg-teal-500 hover:bg-teal-600 text-white py-2 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {{ loading ? "Guardando..." : "Guardar cambios" }}
            </button>
        </form>

        <div v-else class="text-gray-500">Cargando tarea...</div>
    </div>
</template>
