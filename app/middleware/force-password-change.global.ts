/**
 * Global guard (Phase 12) — forces an admin-provisioned member with a temporary
 * password through the change-password screen before reaching any app route.
 *
 * SECURITY: this is a UX gate, not a boundary. The real protection is that the
 * temporary password is known to the provisioning admin; the member is nudged to
 * replace it on first login. The backend POST /change-password is the actual
 * state change (it clears must_change_password); this guard merely keeps the user
 * on /change-password until the flag is cleared.
 *
 * Runs on EVERY route (`.global`). It only acts for a logged-in user whose
 * `must_change_password` flag is set, and never traps the change-password page
 * itself or the public auth/onboarding routes (which a logged-in user won't see
 * anyway). The auth store is hydrated SSR-first (plugins/auth-init.server.ts) so
 * the flag is present before the first guard run.
 */
import { useAuthStore } from '~/stores/auth'

const ALLOWED = new Set(['/change-password', '/login', '/onboarding'])

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (!auth.isLoggedIn || !auth.mustChangePassword) return
  if (ALLOWED.has(to.path)) return

  return navigateTo('/change-password')
})
