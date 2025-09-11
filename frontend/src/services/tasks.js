// src/services/tasks.js
import api from "@/utils/api";

/**
 Será el encargado de hacer las peticiones al backend de la entidad Task.
 Es el nexo entre el frontend y el backend.
 */

// Obtener todas las tareas
export const getAllTasks = async () => {
  const { data } = await api.get("/tasks/allTasks");  
  return data.payload; //.payload retorna directamente el array de tareas, tal como se ve en la estructura del Backend.
};

// Obtener tarea por ID
export const getTaskById = async (id) => {
  const { data } = await api.get(`/tasks/task/${id}`);
  return data;
};

// Crear nueva tarea
export const createTask = async (task) => {
  const { data } = await api.post("/tasks/task", task);
  return data;
};

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
