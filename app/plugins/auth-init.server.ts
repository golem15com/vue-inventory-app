/**
 * Server-side plugin to restore auth state from the auth_token cookie during
 * SSR, BEFORE route middleware runs and before first paint.
 *
 * Without this, isLoggedIn/user would be null during SSR even for an
 * authenticated visitor, so the UX route guard (middleware/auth.ts) would
 * wrongly redirect and the server-rendered markup would flash a logged-out
 * state before client hydration corrects it.
 */
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  // fetchUser() no-ops when the cookie is absent; when present it populates the
  // store from GET /fetch so SSR renders the authenticated state.
  await authStore.fetchUser()
})
