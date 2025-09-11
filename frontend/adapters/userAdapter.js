/**
 Mapea los datos del usuario desde la API al formato utilizado en el Front.
 */

 export const userAdapter = (u) => ({
  id: u._id,
  nombre: u.name,
  email: u.email,
  cantTareas: 0,        
  cantCompletadas: 0    
});