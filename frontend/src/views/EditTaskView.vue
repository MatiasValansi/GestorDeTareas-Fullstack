<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "../stores/user";
import { getTaskById, updateTask, getTaskOwnerId } from "../services/tasks";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const tarea = ref(null);
const loading = ref(false);
const errorMsg = ref("");

// Helper para normalizar ID de usuario logueado
function getCurrentUserId() {
    const user = userStore.user;
    if (!user) return null;
    return String(user._id ?? user.id);
}

onMounted(async () => {
    try {
        const data = await getTaskById(route.params.id);
        tarea.value = data;
        
    } catch (e) {
        errorMsg.value = e?.response?.data?.message || "Error al cargar la tarea";
        console.error("Error al cargar tarea:", e);
    }
});

// Verifica si el usuario actual es el titular (posición 0)
const isOwner = computed(() => {
    const currentUserId = getCurrentUserId();
    const ownerId = getTaskOwnerId(tarea.value);
    return currentUserId && ownerId && currentUserId === ownerId;
});

const isExpired = computed(() => {
    if (!tarea.value?.deadline) return false;
    return new Date(tarea.value.deadline) < new Date();
});

const isRecurring = computed(() => !!tarea.value?.recurringTaskId);

const canEdit = computed(() => isOwner.value && !isExpired.value && !isRecurring.value);

async function editarTarea() {
    errorMsg.value = "";
    
    if (!canEdit.value) {
        errorMsg.value = "No tienes permisos para editar esta tarea";
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
        router.push("/tasks");
    } catch (e) {
        errorMsg.value = e?.response?.data?.message || e?.message || "Error al actualizar";
        console.error("Error al editar tarea", e);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="max-w-lg mx-auto p-6">
        <h2 class="text-2xl font-bold mb-4">Editar Tarea</h2>

        <router-link to="/tasks" class="text-teal-500 hover:underline">← Volver al Menú</router-link>

        <div v-if="errorMsg" class="bg-red-100 text-red-700 p-3 rounded mt-4">{{ errorMsg }}</div>

        <div v-if="!canEdit && tarea" class="bg-yellow-100 text-yellow-800 p-3 rounded mt-4">
            <span v-if="!isOwner">No eres el titular de esta tarea.</span>
            <span v-else-if="isExpired">Esta tarea está vencida.</span>
            <span v-else-if="isRecurring">Las tareas recurrentes no se pueden editar.</span>
        </div>

        <form v-if="tarea" @submit.prevent="editarTarea" class="mt-6 space-y-4">
            <div>
                <label class="block font-medium">Título</label>
                <input v-model="tarea.title" class="w-full border rounded p-2" :disabled="!canEdit" />
            </div>

            <div>
                <label class="block font-medium">Descripción</label>
                <textarea v-model="tarea.description" class="w-full border rounded p-2" rows="3" :disabled="!canEdit"></textarea>
            </div>

            <div>
                <label class="block font-medium">Completada</label>
                <select v-model="tarea.completed" class="w-full border rounded p-2" :disabled="!canEdit">
                    <option :value="false">No</option>
                    <option :value="true">Sí</option>
                </select>
            </div>

            <div>
                <label class="block font-medium">Fecha de la tarea</label>
                <input v-model="tarea.date" type="datetime-local" class="w-full border rounded p-2" :disabled="!canEdit" />
            </div>

            <div>
                <label class="block font-medium">Fecha de vencimiento</label>
                <input v-model="tarea.deadline" type="datetime-local" class="w-full border rounded p-2" :disabled="!canEdit" />
            </div>

            <button
                type="submit"
                :disabled="!canEdit || loading"
                class="w-full bg-teal-500 text-white py-2 rounded disabled:bg-gray-400"
            >
                {{ loading ? "Guardando..." : "Guardar tarea editada" }}
            </button>
        </form>
    </div>
</template>