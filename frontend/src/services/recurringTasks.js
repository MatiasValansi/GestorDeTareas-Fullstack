// src/services/recurringTasks.js
import api from "@/utils/api";

/**
 * Servicio para manejar tareas recurrentes (RecurringTask)
 * Las tareas recurrentes son "moldes" que generan tareas individuales
 * a medida que se consultan los meses en el calendario.
 */

// Crear una nueva tarea recurrente (solo supervisores)
export const createRecurringTask = async (recurringTask) => {
  const { data } = await api.post("/recurringTask/recurring-tasks", recurringTask);
  return data;
};

// Obtener todas las tareas recurrentes (solo supervisores)
export const getAllRecurringTasks = async () => {
  const { data } = await api.get("/recurringTask/recurring-tasks");
  return data.payload || [];
};

// Obtener tarea recurrente por ID (solo supervisores)
export const getRecurringTaskById = async (id) => {
  const { data } = await api.get(`/recurringTask/recurring-tasks/${id}`);
  return data.payload;
};

// Actualizar tarea recurrente (solo supervisores)
export const updateRecurringTask = async (id, recurringTask) => {
  const { data } = await api.put(`/recurringTask/recurring-tasks/${id}`, recurringTask);
  return data;
};

// Eliminar tarea recurrente (solo supervisores)
export const deleteRecurringTask = async (id) => {
  const { data } = await api.delete(`/recurringTask/recurring-tasks/${id}`);
  return data;
};

// Generar tareas individuales para un mes específico
// Este endpoint se llama automáticamente cuando se carga el calendario
export const generateTasksForMonth = async (year, month) => {
  const { data } = await api.post(`/recurringTask/recurring-tasks/generate/${year}/${month}`);
  return data;
};
