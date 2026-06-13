/**
 * Resolve a same-origin relative API path to an absolute URL during SSR.
 *
 * In the browser, relative paths work (nginx routes /_user|/_inventory to the
 * PHP backend) — so we return the path UNCHANGED, keeping client requests
 * byte-for-byte identical. During SSR, Nuxt's $fetch would resolve a relative
 * path against the Nitro server itself (502), so we prefix the configured
 * absolute backend origin (runtimeConfig.internalApiOrigin).
 *
 * Degrades gracefully: if internalApiOrigin is unset for any reason, it returns
 * the relative path (current behavior) rather than throwing. Must be called
 * inside Vue/Nuxt setup scope (it uses useRuntimeConfig).
 */
export function resolveApiUrl(path: string): string {
  if (import.meta.client) return path
  const origin = useRuntimeConfig().internalApiOrigin as string
  if (!origin) return path
  // Trim a trailing slash on origin / ensure a single join slash.
  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
}
