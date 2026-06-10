/**
 * UX-only route guard — redirects unauthenticated visitors to /login.
 *
 * SECURITY: this is NOT a security boundary (Security Domain V4 / threat
 * T-17-08). It only improves UX by sending logged-out users to the login page.
 * The REAL authorization boundary is the backend (`jwt.auth` on the WinterCMS
 * API). Never rely on this guard to protect data — every protected response
 * must be enforced server-side regardless of client routing.
 *
 * Usage (opt-in per page):
 *   definePageMeta({ middleware: 'auth' })
 */
import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  if (!authStore.isLoggedIn) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
