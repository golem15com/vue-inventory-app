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
import { resolveApiUrl } from '~/utils/apiOrigin'

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
  /**
   * Whether the current user may use AI features (D-14). Read from the explicit
   * `can_use_ai` boolean on the me/areas envelope (single source of truth) — the
   * SPA NEVER infers AI access from a 403. Drives the dashboard AI `v-if` and the
   * `ai-gate` route guard; the server 403 (Plan 01) remains the real boundary.
   */
  const canUseAi = ref(false)
  /**
   * Whether this deployment enforces shared organisation AI credentials (D-04).
   * Read from the explicit `ai_org_lock` boolean on the me/areas envelope (the
   * server-side `.env` flag, Plan 04). When true the SPA drops the per-user AI
   * tab from settings — but this is COSMETIC: the server (Plan 04) is the real
   * org-lock boundary. Default false (Phase 11 per-user behaviour preserved).
   */
  const aiOrgLock = ref(false)
  /**
   * Whether the caller is currently using an INHERITED organisation credential
   * (D-13): an org credential is present, the caller has no per-user key, and the
   * lock flag is unset. Drives the non-accent "inherited from organisation" band
   * on the AI settings tab. Read from the me/areas envelope (Plan 04).
   */
  const aiInherited = ref(false)

  // ---------------------------------------------------------------
  // Token (cookie-based, shared with plugins/api.ts + utils/tokenRefresh.ts)
  // ---------------------------------------------------------------
  const token = useCookie('auth_token', {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })

  // Pre-resolve the me/areas URL at store-setup scope, where the Nuxt instance
  // is guaranteed present. fetchCanUseAi() runs NESTED after fetchUser()'s first
  // `await` during SSR (auth-init.server) — calling useRuntimeConfig()/
  // resolveApiUrl() there throws "Nuxt instance unavailable" (context is lost
  // across an await), which the catch swallowed → canUseAi silently false → the
  // AI affordances vanished on every hard reload. Resolving once here is
  // await-safe. resolveApiUrl is absolute on SSR (internalApiOrigin), relative
  // (nginx-routed) in the browser.
  const meAreasUrl = resolveApiUrl(
    `${useRuntimeConfig().public.inventoryApiBase as string}/me/areas`,
  )

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

  /**
   * Public session-set helper (D-10). The first-run onboarding flow (handled in
   * the inventory store, which cannot reach this private closure) calls this to
   * persist the bootstrap token + owner exactly the way login/register do, then
   * hydrates the AI flags. Keeps the cookie-write idiom in ONE place.
   */
  async function setSession(newToken: string, newUser: AuthUser) {
    applySession(newToken, newUser)
    await fetchCanUseAi()
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
    canUseAi.value = false
    aiOrgLock.value = false
    aiInherited.value = false
  }

  /**
   * Hydrate `canUseAi` from the me/areas envelope's explicit `can_use_ai`
   * boolean (D-14). Called after login/register and during SSR hydrate
   * (auth-init plugin). On any failure the flag stays false (fail-closed UX) —
   * the server 403 is the real boundary regardless.
   */
  async function fetchCanUseAi() {
    if (!token.value) {
      canUseAi.value = false
      aiOrgLock.value = false
      aiInherited.value = false
      return
    }
    try {
      // meAreasUrl is pre-resolved at store-setup scope — DO NOT call
      // useRuntimeConfig()/resolveApiUrl() here: this runs nested after an await
      // during SSR, where the Nuxt instance is gone and those composables throw.
      //
      // The envelope also carries the Plan 04 org flags: `ai_org_lock` (D-04 →
      // SPA drops the per-user AI tab) and `ai_inherited` (D-13 → the inherited
      // band). The 403 is the boundary — we NEVER infer access from a caught 403;
      // these are explicit reads, defaulting false on any failure (fail-closed).
      const response = await $fetch<{
        data: unknown[]
        can_use_ai?: boolean
        ai_org_lock?: boolean
        ai_inherited?: boolean
      }>(
        meAreasUrl,
        { headers: { Authorization: `Bearer ${token.value}` } },
      )
      canUseAi.value = response.can_use_ai === true
      aiOrgLock.value = response.ai_org_lock === true
      aiInherited.value = response.ai_inherited === true
    }
    catch {
      // Fail-closed: an unreachable/erroring envelope hides the AI affordances.
      canUseAi.value = false
      aiOrgLock.value = false
      aiInherited.value = false
    }
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
        // Hydrate the AI gate flag from me/areas (D-14) — read, never inferred.
        await fetchCanUseAi()
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
        // Hydrate the AI gate flag from me/areas (D-14) — read, never inferred.
        await fetchCanUseAi()
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
        resolveApiUrl(`${userApiBase()}/fetch`),
        { headers: { Authorization: `Bearer ${token.value}` } },
      )
      user.value = response.user
      // Hydrate the AI gate flag alongside the user (SSR + manual refresh) so the
      // dashboard v-if + ai-gate guard have it before first paint (D-14).
      await fetchCanUseAi()
    }
    catch (err: unknown) {
      // Only a real 401 means the token is invalid/expired — clear it.
      // Network errors / 5xx (e.g. SSR backend unreachable, transient 502)
      // must NOT delete a valid session cookie: leave it so the client can
      // hydrate and retry. ofetch/Nuxt error objects expose `statusCode`
      // (and a nested response.status); check both. If neither is present
      // (true network error), treat as non-401 and KEEP the session.
      const status = (err && typeof err === 'object' && 'status' in err)
        ? (err as { status: number }).status
        : (err && typeof err === 'object' && 'statusCode' in err)
            ? (err as { statusCode: number }).statusCode
            : undefined
      if (status === 401) {
        clearSession()
      }
      // else: keep token + session intact (client hydrate/retry).
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
    canUseAi,
    aiOrgLock,
    aiInherited,
    // Computed
    isLoggedIn,
    // Actions
    login,
    register,
    setSession,
    fetchUser,
    fetchCanUseAi,
    logout,
  }
})
