// src/services/users.js
import api from "@/utils/api";

// Obtener todos los usuarios
export const getAllUsers = async () => {
  const { data } = await api.get("/users/allUsers");
  return data;
};

// Obtener usuario por ID
export const getUserById = async (id) => {
  const { data } = await api.get(`/users/user/${id}`);
  return data;
};

// Crear usuario
export const createUser = async (user) => {
  const { data } = await api.post("/users/user", user);
  return data;
};

// Actualizar usuario por ID
export const updateUser = async (id, user) => {
  const { data } = await api.put(`/users/user/${id}`, user);
  return data;
};

// Eliminar usuario por ID
export const deleteUser = async (id) => {
  const { data } = await api.delete(`/users/user/${id}`);
  return data;
};
