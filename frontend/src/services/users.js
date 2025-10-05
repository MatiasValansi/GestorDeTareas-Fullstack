// src/services/users.js
import api from "@/utils/api";
import { userAdapter } from "../../adapters/userAdapter.js";

/**
 Será el encargado de hacer las peticiones al backend de la entidad User.
 Es el nexo entre el frontend y el backend.
 */

;
  /**
   * OBS: ASÍ COMO MAPEE EL RETURN CON userAdapter,
   * PUEDE QUE DEBA HACERLO CON EL RESTO DE LOS MÉTODOS,
   * EJ:
    * 
    // ✅ Obtener un usuario por id
    export const getUserById = async (id) => {
    const res = await axios.get(`${API}/users/user/${id}`);
    return userAdapter(res.data.payload);
    };

    // ✅ Crear usuario
    export const createUser = async (user) => {
    const res = await axios.post(`${API}/users/user`, user);
    return userAdapter(res.data.payload);
    };

    // ✅ Actualizar usuario
    export const updateUser = async (id, user) => {
    const res = await axios.put(`${API}/users/user/${id}`, user);
    return userAdapter(res.data.payload);
    };

    // ✅ Eliminar usuario
    export const deleteUser = async (id) => {
    await axios.delete(`${API}/users/user/${id}`);
   */


// Obtener usuario por ID
export const getUserById = async (id) => {
  const { data } = await api.get(`/users/user/${id}`);

  const doc = data?.payload?.userFoundById ?? data?.payload ?? data;

  return userAdapter(doc);
};

export const getAllUsers = async () => {
  const { data } = await api.get('/users/allUsers');
  return data.payload.map(userAdapter);
};

// Crear usuario
export const createUser = async (user) => {
  const { data } = await api.post("/users/user", { user });
  return data;
};

// Actualizar usuario por ID
export const updateUser = async (id, body) => {
  // body: { name, email }
  const { data } = await api.put(`/users/user/${id}`, body);
  return data;
};

// Eliminar usuario por ID
export const deleteUser = async (id) => {
  const { data } = await api.delete(`/users/user/${id}`);  
  return data;
};
