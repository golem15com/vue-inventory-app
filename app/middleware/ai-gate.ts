/**
 * UX-only route guard — redirects users without AI access off /ai-assist.
 *
 * SECURITY: this is NOT a security boundary (D-13). The REAL gate is the
 * backend: RecognizeApiController returns 403 (via AiGate::allows) regardless of
 * client routing (Plan 01). This guard only improves UX by sending non-AI users
 * back to /dashboard instead of letting them reach a page whose only action 403s.
 *
 * `auth.canUseAi` is READ from the me/areas `can_use_ai` boolean (D-14) — never
 * inferred from a 403. Pair it after `auth` so the user is hydrated first:
 *   definePageMeta({ middleware: ['auth', 'ai-gate'] })
 */
import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(() => {
  // UX-only redirect (NOT a boundary — server returns 403 regardless, D-13).
  const auth = useAuthStore()
  if (!auth.canUseAi) {
    return navigateTo('/dashboard')
  }
})
