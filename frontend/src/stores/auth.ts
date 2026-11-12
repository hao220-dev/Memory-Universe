import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchMe, login as loginApi } from '@/api/auth'
import { TOKEN_KEY } from '@/api/http'
import type { LoginResponse, UserSummary } from '@/types/domain'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) ?? '')
  const user = ref<UserSummary | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value))
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  function applySession(result: LoginResponse) {
    token.value = result.token
    user.value = result.user
    localStorage.setItem(TOKEN_KEY, result.token)
    return result
  }

  async function login(username: string, password: string) {
    return applySession(await loginApi({ username, password }))
  }

  async function loadMe() {
    if (!token.value) {
      return null
    }
    user.value = await fetchMe()
    return user.value
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, user, isAuthenticated, isAdmin, login, applySession, loadMe, logout }
})
