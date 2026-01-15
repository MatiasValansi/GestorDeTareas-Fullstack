// src/services/tasks.js
import api from "@/utils/api";

/**
 Será el encargado de hacer las peticiones al backend de la entidad Task.
 Es el nexo entre el frontend y el backend.
 */

// Obtener todas las tareas
export const getAllTasks = async () => {
  const { data } = await api.get("/tasks/allTasks");
  return data.payload || [];
};

// Obtener tareas para el calendario (filtradas según rol del usuario)
// TAMBIÉN genera las tareas recurrentes y marca las vencidas automáticamente
export const getCalendarTasks = async (month, year) => {
  const { data } = await api.get(`/tasks/calendar?month=${month}&year=${year}`);
  return data.payload || [];
};

// Crear una nueva tarea
export const createTask = async (task) => {
  // 👇 el backend espera { task: {...} }
  const { data } = await api.post("/tasks/task", { task });
  return data;
};

/**
 * Obtiene una tarea por ID
 * @param {string} taskId - ID de la tarea
 * @returns {Promise<Object>} - La tarea encontrada
 */
export async function getTaskById(taskId) {
    const { data } = await api.get(`/tasks/task/${taskId}`);
    // El backend devuelve: { payload: { taskFoundById: {...} }, ok, message }
    return data?.payload?.taskFoundById ?? data?.payload ?? data;
}

/**
 * Extrae el ID del titular (posición 0 de assignedTo)
 * Soporta: string, ObjectId, objeto populado con _id/id
 * @param {Object} task - La tarea
 * @returns {string|null} - ID del titular o null
 */
export function getTaskOwnerId(task) {
    if (!task?.assignedTo?.length) return null;
    
    const firstAssigned = task.assignedTo[0];
    
    // Si es string directo (ID)
    if (typeof firstAssigned === "string") return firstAssigned;
    
    // Si es objeto populado con _id
    if (firstAssigned?._id) return String(firstAssigned._id);
    
    // Si es objeto con id
    if (firstAssigned?.id) return String(firstAssigned.id);
    
    // Fallback: intentar convertir a string
    return firstAssigned ? String(firstAssigned) : null;
}

// Actualizar tarea por ID
export const updateTask = async (id, task) => {
  const { data } = await api.put(`/tasks/task/${id}`, task);
  return data;
};

// Eliminar tarea por ID
export const deleteTask = async (id) => {
  const { data } = await api.delete(`/tasks/task/${id}`);
  return data;
};

// (Opcional) Eliminar todas las tareas (si en el back lo habilitás)
export const deleteAllTasks = async () => {
  const { data } = await api.delete("/tasks/allTasks");
  return data;
};
