/**
 * Proactive JWT token refresh — refreshes the token before it expires.
 *
 * Parses the JWT exp claim to schedule a refresh ~5 minutes before expiry.
 * Runs only on the client side (.client.ts suffix) — SSR has no long-lived
 * timer to schedule against (per the Responsibility Map).
 */
import { refreshToken, getTokenFromCookie } from '~/utils/tokenRefresh'

const REFRESH_MARGIN_MS = 5 * 60 * 1000 // refresh 5 minutes before expiry
const MIN_DELAY_MS = 10_000 // never schedule sooner than 10 seconds

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const userApiBase = config.public.userApiBase as string

  let timer: ReturnType<typeof setTimeout> | null = null

  function scheduleRefresh() {
    clearTimer()

    const token = getTokenFromCookie()
    if (!token) return

    const expiresAt = getTokenExp(token)
    if (!expiresAt) return

    const now = Date.now()
    const delay = Math.max(expiresAt - now - REFRESH_MARGIN_MS, MIN_DELAY_MS)

    timer = setTimeout(async () => {
      const newToken = await refreshToken(userApiBase)
      if (newToken) {
        scheduleRefresh() // re-schedule for the new token
      }
      // If refresh failed, the next API call will trigger the 401 flow.
    }, delay)
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  // Start on load if a token exists.
  scheduleRefresh()

  // Stop the timer on session expiry.
  window.addEventListener('auth:session-expired', clearTimer)
})

/**
 * Decode the JWT exp claim without a library.
 * Returns expiry as epoch milliseconds, or null if unparseable.
 */
function getTokenExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  }
  catch {
    return null
  }
}
