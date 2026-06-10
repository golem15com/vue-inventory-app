/**
 * Nuxt plugin providing a configured $fetch instance ($api) for the headless
 * WinterCMS backend.
 *
 * - Base URL from runtimeConfig.public.apiBase (dev-proxied to localhost:8000)
 * - Automatic JWT Bearer header from the auth_token cookie (SSR + client)
 * - Rate-limit (429) warning
 * - Transparent 401 → token refresh → retry (client-side only, mutex-guarded)
 *
 * Provided as useNuxtApp().$api — consumed by stores/composables and 17-05's
 * useCentrifugo (GET /api/realtime/token).
 *
 * Security: the bearer is attached in the Authorization HEADER only — never a
 * query string, never console.log'd (T-17-05).
 */
import { refreshToken, clearTokenCookie } from '~/utils/tokenRefresh'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // SSR: useCookie reads from request headers
  const ssrToken = import.meta.server ? useCookie('auth_token') : null
  const userApiBase = config.public.userApiBase as string

  const rawApi = $fetch.create({
    baseURL: config.public.apiBase as string,

    onRequest({ options }) {
      // Client: read directly from document.cookie on every request.
      // Each useCookie() call creates an independent ref — the auth store's
      // ref and this plugin's ref don't sync within the same tab, so after a
      // login the plugin's ref would otherwise stay stale until page reload.
      let token: string | null = null
      if (import.meta.server) {
        token = ssrToken!.value as string | null
      }
      else {
        const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/)
        token = match?.[1] ? decodeURIComponent(match[1]) : null
      }

      if (token) {
        options.headers = options.headers
          ? new Headers(options.headers as HeadersInit)
          : new Headers()
        ;(options.headers as Headers).set(
          'Authorization',
          `Bearer ${token}`,
        )
      }
    },

    onResponseError({ response }) {
      if (response.status === 429) {
        console.warn(
          '[API] Rate limit exceeded. Retry after:',
          response.headers.get('Retry-After') ?? 'unknown',
        )
      }
    },
  })

  // On the server, use rawApi directly (no refresh logic — SSR has no event
  // loop to re-schedule against, and the refresh mutex uses document.cookie).
  // On the client, wrap with 401 intercept → refresh → retry.
  const api: typeof rawApi = import.meta.server
    ? rawApi
    : ((async (request: any, opts?: any) => {
        try {
          return await (rawApi as any)(request, opts)
        }
        catch (err: unknown) {
          // Exclude auth endpoints from the refresh-retry to avoid a loop:
          // a 401 on /login or /refresh must surface, not trigger a refresh.
          if (!is401Error(err) || isAuthEndpoint(request)) throw err

          const newToken = await refreshToken(userApiBase)
          if (newToken) {
            const retryHeaders = new Headers(opts?.headers || {})
            retryHeaders.set('Authorization', `Bearer ${newToken}`)
            return await (rawApi as any)(request, { ...opts, headers: retryHeaders })
          }

          // Refresh failed — force session expiry.
          handleSessionExpired()
          throw err
        }
      }) as typeof rawApi)

  return {
    provide: { api },
  }
})

function is401Error(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'status' in err
    && (err as { status: number }).status === 401
}

function isAuthEndpoint(request: unknown): boolean {
  const url = typeof request === 'string' ? request : ''
  return /\/(refresh|login|register|logout)(\/|$|\?)/.test(url)
}

function handleSessionExpired(): void {
  clearTokenCookie()
  window.dispatchEvent(new CustomEvent('auth:session-expired'))
}
