/**
 * Client-side auth hydration on boot.
 *
 * The SSR counterpart (plugins/auth-init.server.ts) restores the session during
 * server rendering — but a STATIC `nuxt generate` deployment (the self-host SPA
 * container, Phase 11-07) has NO server runtime, so that plugin never runs in the
 * browser. Without this, a fresh load / F5 boots with an empty store and the user
 * appears logged out even though the auth_token cookie is present (login only set
 * the in-memory state, which a reload wipes).
 *
 * Guarded so it is a no-op in SSR mode: if the server plugin already hydrated the
 * user (present in the Pinia payload), isLoggedIn is true and we skip the extra
 * round-trip. fetchUser() itself no-ops without a cookie and only clears the
 * session on a real 401, so this is safe to call unconditionally on a cold load.
 */
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  if (authStore.isLoggedIn) return
  await authStore.fetchUser()
})
