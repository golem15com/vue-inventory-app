/**
 * Silent JWT token refresh with a mutex to prevent concurrent refresh calls.
 *
 * Called by the api plugin (plugins/api.ts) when a 401 is received, and by the
 * proactive timer (plugins/token-refresh.client.ts) before the token expires.
 * Uses $fetch directly (not $api) to avoid recursion.
 *
 * Backend contract: POST {userApiBase}/refresh (bearer) → 200 { token }.
 * Cookie helpers write via document.cookie directly so they work OUTSIDE Vue
 * setup scope (both plugins call them). The auth_token cookie is the single
 * source of truth (SSR-friendly default A4 — NOT localStorage).
 */

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

let refreshPromise: Promise<string | null> | null = null

export function refreshToken(userApiBase: string): Promise<string | null> {
  // Single in-flight refresh (mutex): concurrent 401s share one refresh so the
  // backend never invalidates a freshly-issued token via a refresh storm.
  if (refreshPromise) return refreshPromise

  refreshPromise = attemptRefresh(userApiBase).finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

async function attemptRefresh(userApiBase: string): Promise<string | null> {
  const currentToken = getTokenFromCookie()
  if (!currentToken) return null

  try {
    const response = await $fetch<{ token: string }>(
      `${userApiBase}/refresh`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      },
    )

    const newToken = response.token
    if (!newToken) return null

    setTokenCookie(newToken)
    return newToken
  }
  catch {
    return null
  }
}

export function getTokenFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function setTokenCookie(token: string): void {
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

export function clearTokenCookie(): void {
  document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax'
}
