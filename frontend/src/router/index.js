import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/task',
    name: 'task',
    component: () => import('../views/TaskView.vue')
  },
  {
    path: '/newTask',
    name: 'newTask',
    component: () => import('../views/NewTaskView.vue')
  },
  {
    path: '/editTask/:id',
    name: 'editTask',
    component: () => import('../views/EditTaskView.vue')
  },
  {
    path: '/users',
    name: 'userView',
    component: () => import('../views/UserView.vue')
  },
  {
    path: '/newUser',
    name: 'userAdministration',
    component: () => import('../views/NewUserView.vue')
  },
  {
    path: '/editUser/:id',
    name: 'editUser',
    component: () => import('../views/EditUserView.vue')
  },
  {
  path: '/taskDetail/:id',
  name: 'taskDetail',
  component: () => import('../views/TaskDetailView.vue')
},
{
  path: '/userDetail/:id',
  name: 'userDetail',
  component: () => import('../views/UserDetailView.vue')
},
{
  path: '/email-send',
  name: 'emailSender',
  component: () => import('../views/EmailSenderView.vue')
},
{
    path: '/TestLogin',
    name: 'testlogin',
    component: () => import('../components/TestLogin.vue')
  }

]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const store = useUserStore()
  if (!store.isLoggedIn && to.path !== '/login') {
    return next('/login')
  }

  // Si ya está logueado, evitar volver a /login
  if (store.isLoggedIn && to.path === '/login') {
    return next('/')
  }

  // Rutas solo para supervisores
  const supervisorOnlyPaths = ['/users', '/newUser']
  const isSupervisorRoute =
    supervisorOnlyPaths.includes(to.path) ||
    to.path.startsWith('/editUser') ||
    to.path.startsWith('/userDetail')

  if (isSupervisorRoute && !store.isSupervisor) {
    return next('/task')
  }
  next()
})

export default router
