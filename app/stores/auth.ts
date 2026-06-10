/**
 * Pinia auth store (setup-store shape) — cookie-based JWT auth against the
 * Golem15.User headless API at runtimeConfig.public.userApiBase.
 *
 * The auth_token cookie (SameSite=Lax, 30-day, JS-readable) is the single
 * source of truth, shared with plugins/api.ts and utils/tokenRefresh.ts. This
 * is the SSR-friendly default (A4) — NOT localStorage, which SSR can't read.
 *
 * Backend contract (verified):
 *   POST /login    {email,password} → 200 {token,user} · 401 {error} · 2FA {two_factor_required,...}
 *   POST /register → 200 {token,user} · 422 {error,errors}
 *   GET  /fetch    (bearer) → 200 {user}
 *   POST /logout   (bearer) → 200 {message}
 *
 * Scope (starter): login/register/fetch/logout only. A typed two_factor_required
 * branch is surfaced but has no UI — 2FA/OAuth are per-project (clients add them).
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser } from '~~/shared/types/auth'

interface LoginResponse {
  token?: string
  user?: AuthUser
  two_factor_required?: boolean
  challenge_token?: string
}

interface RegisterResponse {
  token?: string
  user?: AuthUser
  message?: string
}

interface FetchError {
  data?: {
    error?: unknown
    message?: string
    errors?: Record<string, string[]>
  }
}

export const useAuthStore = defineStore('auth', () => {
  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  const user = ref<AuthUser | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]>>({})
  /** Set when the backend demands a second factor — no starter UI (per-project). */
  const twoFactorRequired = ref(false)

  // ---------------------------------------------------------------
  // Token (cookie-based, shared with plugins/api.ts + utils/tokenRefresh.ts)
  // ---------------------------------------------------------------
  const token = useCookie('auth_token', {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })

  // ---------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------
  const isLoggedIn = computed(() => !!user.value)

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function userApiBase(): string {
    return useRuntimeConfig().public.userApiBase as string
  }

  function applySession(newToken: string, newUser: AuthUser) {
    token.value = newToken
    // Also write via document.cookie so the api plugin's independent cookie
    // read (which doesn't sync with this useCookie ref in-tab) sees the token
    // immediately after login, without a page reload.
    if (import.meta.client) {
      document.cookie = `auth_token=${encodeURIComponent(newToken)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    }
    user.value = newUser
    twoFactorRequired.value = false
  }

  function clearSession() {
    token.value = null
    user.value = null
    fieldErrors.value = {}
    twoFactorRequired.value = false
  }

  // ---------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------
  async function login(credentials: { email: string, password: string }) {
    isLoading.value = true
    error.value = null
    fieldErrors.value = {}
    twoFactorRequired.value = false

    try {
      const response = await $fetch<LoginResponse>(
        `${userApiBase()}/login`,
        { method: 'POST', body: credentials },
      )

      // Typed 2FA branch — surfaced, no starter UI (per-project).
      if (response.two_factor_required) {
        twoFactorRequired.value = true
        error.value = 'Two-factor authentication is required (not implemented in the starter).'
        return
      }

      if (response.token && response.user) {
        applySession(response.token, response.user)
      }
    }
    catch (err: unknown) {
      const fetchError = err as FetchError
      const errField = fetchError.data?.error
      error.value = (typeof errField === 'string' ? errField : null)
        ?? fetchError.data?.message
        ?? 'Invalid email or password'
    }
    finally {
      isLoading.value = false
    }
  }

  async function register(data: {
    email: string
    password: string
    password_confirmation: string
    [key: string]: unknown
  }) {
    isLoading.value = true
    error.value = null
    fieldErrors.value = {}

    try {
      const response = await $fetch<RegisterResponse>(
        `${userApiBase()}/register`,
        { method: 'POST', body: data },
      )

      if (response.token && response.user) {
        applySession(response.token, response.user)
      }
    }
    catch (err: unknown) {
      const fetchError = err as FetchError
      if (fetchError.data?.errors) {
        fieldErrors.value = fetchError.data.errors
        const firstError = Object.values(fieldErrors.value)[0]
        error.value = firstError?.[0] ?? 'Validation failed'
      }
      else {
        const errField = fetchError.data?.error
        error.value = (typeof errField === 'string' ? errField : null)
          ?? fetchError.data?.message
          ?? 'Registration failed'
      }
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Hydrate the current user from the auth_token cookie. Called by the SSR
   * hydrate plugin (plugins/auth-init.server.ts) and after a manual refresh.
   */
  async function fetchUser() {
    if (!token.value) return

    try {
      const response = await $fetch<{ user: AuthUser }>(
        `${userApiBase()}/fetch`,
        { headers: { Authorization: `Bearer ${token.value}` } },
      )
      user.value = response.user
    }
    catch {
      // Token invalid or expired — clear it.
      clearSession()
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await $fetch(`${userApiBase()}/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.value}` },
        })
      }
    }
    catch {
      // Ignore logout errors — clear local state regardless.
    }
    finally {
      if (import.meta.client) {
        document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax'
      }
      clearSession()
    }
  }

  // ---------------------------------------------------------------
  // Session expiry handler (fired by plugins/api.ts when refresh fails)
  // ---------------------------------------------------------------
  if (import.meta.client) {
    window.addEventListener('auth:session-expired', () => {
      clearSession()
      error.value = 'Your session has expired. Please sign in again.'
    })
  }

  return {
    // State
    user,
    isLoading,
    error,
    fieldErrors,
    twoFactorRequired,
    // Computed
    isLoggedIn,
    // Actions
    login,
    register,
    fetchUser,
    logout,
  }
})
