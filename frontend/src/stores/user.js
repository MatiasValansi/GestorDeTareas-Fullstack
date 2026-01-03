import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user')) || null
  }),
  getters: {
    isLoggedIn: (state) => !!state.user,
    // Compatibilidad: tratamos isAdmin como alias de isSupervisor
    isAdmin: (state) => state.user?.isSupervisor === true,
    isSupervisor: (state) => state.user?.isSupervisor === true
  },
  actions: {
    login(user) {
      this.user = user
      localStorage.setItem('user', JSON.stringify(user))
    },
    logout() {
      this.user = null
      localStorage.removeItem('user')
    }
  }
})