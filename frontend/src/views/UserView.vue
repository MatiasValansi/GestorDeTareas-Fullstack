<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

import { getAllUsers, deleteUser } from '@/services/users'
import { getAllTasks } from '@/services/tasks'

const router = useRouter()

const usuarios = ref([])
const cargando = ref(false)
const error = ref("")
const store = useUserStore()
const searchQuery = ref('')

const mostrarUsuariosYTareas = async () => {
  cargando.value = true
  error.value = ""
  try {
    const [resUsuarios, resTareas] = await Promise.all([
      getAllUsers(),
      getAllTasks()
    ])

    usuarios.value = resUsuarios.map(usuario => {
      const tareasDelUsuario = resTareas.filter(t => t.userId == usuario.id)
      const completadas = tareasDelUsuario.filter(t => t.completada).length
      return {
        ...usuario,
        cantTareas: tareasDelUsuario.length,
        cantCompletadas: completadas
      }
    })
  } catch (err) {
    error.value = 'Error al cargar usuarios y tareas.'
    console.error(err)
  } finally {
    cargando.value = false
  }
}

// Usuarios filtrados: excluye al usuario logueado, ordena alfabéticamente y filtra por búsqueda
const usuariosFiltrados = computed(() => {
  const currentUserId = store.user?.id || store.user?._id
  
  // Excluir al usuario logueado y ordenar alfabéticamente
  let resultado = usuarios.value
    .filter(u => {
      const userId = u.id || u._id
      return userId !== currentUserId
    })
    .sort((a, b) => {
      const nombreA = (a.nombre || a.name || '').toLowerCase()
      const nombreB = (b.nombre || b.name || '').toLowerCase()
      return nombreA.localeCompare(nombreB, 'es')
    })
  
  // Aplicar filtro de búsqueda si existe
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    resultado = resultado.filter(u => {
      const nombre = (u.nombre || u.name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      return nombre.includes(query) || email.includes(query)
    })
  }
  
  return resultado
})

const clearSearch = () => {
  searchQuery.value = ''
}

onMounted(async () => {
  await mostrarUsuariosYTareas()
})

const irANuevaVistaUsuario = () => {
  router.push('/newUser')
}

const eliminarUsuario = async (id, nombre) => {
  if (!confirm(`¿Eliminar a "${nombre}"?`)) return
  try {
    await deleteUser(id)
    alert(`Usuario "${nombre}" eliminado.`)
    await mostrarUsuariosYTareas()
  } catch (err) {
    console.error('Error al eliminar usuario', err)
  }
}

const editarUsuario = (id) => {
  router.push(`/editUser/${id}`)
}

const verDetalleUsuario = (id) => {
  router.push(`/userDetail/${id}`)
}

const verTareasUsuario = (id) => {
  router.push(`/userDetail/${id}`)
}
</script>

<template>
  <div class="app-container">
    <main class="main-content">
      <div class="tasks-content">
        <!-- Header de la vista -->
        <div class="recurrent-tasks-header">
          <h1 class="page-title">Usuarios</h1>
          <p class="page-subtitle">Apartado de usuarios pertenecientes a tu sector</p>
        </div>

       <!-- Buscador -->
      <div class="search-container">
        <div class="search-input-wrapper">
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="Buscar usuario por nombre o email..."
            class="search-input"
          />
          <button 
            v-if="searchQuery" 
            class="clear-search-btn"
            @click="clearSearch"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Contador -->
      <div class="users-count">
        <span class="count-badge">{{ usuariosFiltrados.length }} usuario{{ usuariosFiltrados.length !== 1 ? 's' : '' }}</span>
      </div>
    
              <!-- Botón agregar usuario (solo supervisores) -->
        <button
          v-if="store.isSupervisor"
          class="add-user-btn"
          @click="irANuevaVistaUsuario"
        >
          + Nuevo Usuario
        </button>

            <!-- Loading state -->
        <div v-if="cargando" class="loading-state">
          <div class="spinner"></div>
          <span>Cargando usuarios...</span>
        </div>

        <!-- Error state -->
        <p v-else-if="error" class="error-state">{{ error }}</p>

        <!-- Lista de usuarios -->
    <div v-else-if="usuariosFiltrados.length" class="user-list-modern">
      <div 
        v-for="usuario in usuariosFiltrados" 
        :key="usuario.id || usuario._id" 
        class="user-item"
        @click="verDetalleUsuario(usuario.id || usuario._id)"
      >
        <!-- Avatar -->
        <div>
          <span class="avatar-icon">{{ usuario.nombre.charAt(0).toUpperCase() }}</span>
        </div>
        
        <!-- Contenido principal -->
        <div class="user-content">
          <h3 class="user-name">{{ usuario.nombre || usuario.name || 'Sin nombre' }}</h3>
          <p class="user-email">{{ usuario.email || 'Sin email' }}</p>
        </div>

        <!-- Acciones -->
        <div class="user-actions" @click.stop>
          <button class="btn-action btn-tasks" @click="verTareasUsuario(usuario.id || usuario._id)">
            Ver Tareas
          </button>
          <template v-if="store.isSupervisor">
            <button class="btn-action btn-edit" @click="editarUsuario(usuario.id || usuario._id)">
              Editar
            </button>
            <button class="btn-action btn-delete" @click="eliminarUsuario(usuario.id || usuario._id, usuario.nombre || usuario.name)">
              Eliminar
            </button>
          </template>
        </div>
      </div>
    </div>

        <!-- Estado vacío -->
    <div v-else class="empty-state">
      <div class="empty-icon">{{ searchQuery ? '🔍' : '👥' }}</div>
      <p class="empty-text" v-if="searchQuery">No se encontraron usuarios que coincidan con "{{ searchQuery }}"</p>
      <p v-else>No hay usuarios registrados</p>
      <button v-if="searchQuery" class="btn-clear-filters" @click="clearSearch">Limpiar búsqueda</button>
    </div>
      </div>
    </main>
  </div>
</template>

<style scoped>


.main-content {
  padding: 0;
}

.tasks-content {
  min-height: 800px;
}

.recurrent-tasks-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #e8dff5 0%, #d4c4f0 100%);
  border-radius: 0 0 20px 20px;
  margin-bottom: 0;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #6b21a8;
  margin: 0 0 0.5rem 0;
}

.page-subtitle {
  font-size: 0.95rem;
  color: #7c3aed;
  margin: 0;
}

/* Loading y Error states */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  color: #dc2626;
}

.search-container {
  margin: 1rem 0;
  width: 100%;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  margin-top: 32px;
}

.search-input-wrapper {
  display: flex;
  align-items: center; /* 🔥 esto sí centra vertical */
  position: relative;
}

.search-input {
  width: 100%;
  font-size: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 25px;
  background: #f9fafb;
  color: #1f2937;
  transition: all 0.2s ease;
  outline: none;
  text-align: left;
  height: 48px;
  padding: 0 2.5rem 0 0.75rem 1rem;
  line-height: 48px;
}

.search-input:focus {
  border-color: #4f83cc;
  background: white;
  box-shadow: 0 0 0 3px rgba(79, 131, 204, 0.15);
}

.search-input::placeholder {
  color: #9ca3af;
}

.clear-search-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-75%);

  width: 24px;
  height: 24px;

  background: #e5e7eb;
  border: none;
  border-radius: 50%;
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 0.75rem;
}

.clear-search-btn:hover {
  background: #d1d5db;
  color: #374151;
}

/* Dark mode */
body.dark .recurrent-tasks-header {
  background: linear-gradient(135deg, #4c1d95 0%, #5b21b6 100%);
}

body.dark .recurrent-tasks-header .page-title {
  color: white;
}

body.dark .recurrent-tasks-header .page-subtitle {
  color: rgba(255, 255, 255, 0.85);
}

body.dark .loading-state {
  color: #9ca3af;
}

body.dark .loading-state .spinner {
  border-color: #374151;
  border-top-color: #8b5cf6;
}

.users-count {
  text-align: center;
  margin-top: 0.5rem;
}

.count-badge {
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 500;
}

.add-user-btn {
  display: block;
  width: calc(100% - 2rem);
  margin: 1rem;
  padding: 0.9rem;
  background: #4f83cc;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.add-user-btn:hover {
  background: #3d6db5;
}

/* === LOADING STATE === */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #6b7280;
}

.loading-state .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #4f83cc;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* === ERROR STATE === */
.error-state {
  text-align: center;
  padding: 2rem;
  color: #dc2626;
  font-weight: 500;
}

/* === LISTA DE USUARIOS MODERNA === */
.user-list-modern {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: white;
  margin: 0;
}

/* === ITEM DE USUARIO === */
.user-item {
  display: flex;
  align-items: center;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background 0.15s ease;
  min-height: 72px;
  padding: 0.75rem 1rem;
  gap: 1rem;
}

.user-item:hover {
  background: #f9fafb;
}

.user-item:active {
  background: #f3f4f6;
}

/* === AVATAR === */
.user-avatar {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #4f83cc 0%, #3d6db5 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f83cc, #6366f1);
  color: rgb(255, 255, 255);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
  flex-shrink: 0;
}

/* === CONTENIDO DEL USUARIO === */
.user-content {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* === ACCIONES === */
.user-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn-action {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s ease;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.btn-action:active {
  transform: translateY(0);
}

.btn-tasks {
  background: linear-gradient(135deg, #6956ca);
  color: white;
}

.btn-tasks:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(111, 62, 139, 0.4);
}

.btn-edit {
  background: linear-gradient(135deg, #4cad73);
  color: white;
}

.btn-edit:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(60, 189, 129, 0.4);
} 

.btn-delete {
  background: linear-gradient(135deg, #dd4c4c);
  color: white;
}

.btn-delete:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(185, 55, 55, 0.4);
}

/* === DARK MODE === */
body.dark .users-container {
  background-color: #111827;
}

body.dark .users-header {
  background: #1f2937;
  border-bottom-color: #374151;
}

body.dark .page-title {
  color: #f1f5f9;
}

body.dark .search-input {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

body.dark .search-input:focus {
  border-color: #3b82f6;
  background: #1f2937;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

body.dark .search-input::placeholder {
  color: #9ca3af;
}

body.dark .clear-search-btn {
  background: #4b5563;
  color: #d1d5db;
}

body.dark .clear-search-btn:hover {
  background: #6b7280;
  color: #f9fafb;
}

body.dark .count-badge {
  color: #9ca3af;
}

body.dark .add-user-btn {
  background: #3b82f6;
}

body.dark .add-user-btn:hover {
  background: #2563eb;
}

body.dark .user-list-modern {
  background: #1f2937;
}

body.dark .user-item {
  background: #1f2937;
  border-bottom-color: #374151;
}

body.dark .user-item:hover {
  background: #293548;
}

body.dark .user-item:active {
  background: #374151;
}

body.dark .user-avatar {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

body.dark .user-name {
  color: #f9fafb;
}

body.dark .user-email {
  color: #9ca3af;
}

body.dark .btn-tasks {
  background: linear-gradient(135deg, #6d4de0, #4f46e5);
}

body.dark .btn-tasks:hover {
  background: linear-gradient(135deg, #5c3cc4, #4338ca);
}

body.dark .btn-edit {
  background: linear-gradient(135deg, #3c965f, #059669);
}

body.dark .btn-edit:hover {
  background: linear-gradient(135deg, #2d7a4a, #047857);
}

body.dark .btn-delete {
  background: linear-gradient(135deg, #c84c4c, #dc2626);
}

body.dark .btn-delete:hover {
  background: linear-gradient(135deg, #b33939, #b91c1c);
}

body.dark .btn-action {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

body.dark .btn-action:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}

body.dark .loading-state {
  color: #9ca3af;
}

body.dark .loading-state .spinner {
  border-color: #374151;
  border-top-color: #3b82f6;
}

body.dark .empty-state {
  color: #6b7280;
}

body.dark .btn-clear-filters {
  background: #3b82f6;
}

body.dark .btn-clear-filters:hover {
  background: #2563eb;
}

/* === RESPONSIVE === */
@media (max-width: 768px) {
  .user-item {
    flex-wrap: wrap;
    padding: 1rem;
    gap: 0.75rem;
  }
  
  .user-content {
    flex: 1 1 calc(100% - 60px);
    min-width: 150px;
  }
  
  .user-actions {
    flex: 1 1 100%;
    justify-content: flex-start;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
  }
}

@media (max-width: 480px) {
  .users-header {
    padding: 0.75rem 1rem;
  }
  
  .page-title {
    font-size: 1.2rem;
  }
  
  .user-item {
    padding: 0.75rem;
  }
  
  .avatar-icon {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
  }
  
  .user-name {
    font-size: 0.95rem;
  }
  
  .user-email {
    font-size: 0.8rem;
  }
  
  .btn-action {
    padding: 0.4rem 0.75rem;
    font-size: 0.75rem;
    border-radius: 16px;
  }
  
  .user-actions {
    gap: 0.4rem;
  }
}

/* Dark mode responsive border */
body.dark .user-actions {
  border-top-color: #374151;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #9ca3af;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  font-size: 1.1rem;
  margin: 0;
}

.btn-clear-filters {
  margin-top: 1rem;
  padding: 0.6rem 1.2rem;
  background: #4f83cc;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.btn-clear-filters:hover {
  background: #3d6db5;
}

</style>
