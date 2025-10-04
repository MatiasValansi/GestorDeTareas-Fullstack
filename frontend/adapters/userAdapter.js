/**
 Mapea los datos del usuario desde la API al formato utilizado en el Front.
 */

export const userAdapter = (u = {}) => ({
  id: u._id ?? u.id ?? u.userId ?? u.uuid ?? null,
  nombre: u.name ?? u.nombre ?? u.fullname ?? '',
  email: u.email ?? ''
});
