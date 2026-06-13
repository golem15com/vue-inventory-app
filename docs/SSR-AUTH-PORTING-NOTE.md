# Port note: SSR session-wipe-on-reload fix → vue-starter-app

**Copy this fix upstream into `vue-starter-app` so freshly-scaffolded apps don't ship the bug.**

Origin: whereiput.it / vue-inventory-app, submodule commit `3cfcd28`
("fix(auth): stop SSR wiping valid session on reload"), 2026-06-13.

---

## The bug (symptom)

A full page reload (F5 / Ctrl+R) logs the user out **immediately** — even one
second after a successful login. SPA navigation is fine; only a hard reload
(which goes through Nuxt SSR) drops the session. Easy to misread as a short
token TTL — it is **not** token expiry.

## Root cause (two compounding bugs)

1. **Relative API base is unreachable during SSR.** `runtimeConfig.public.userApiBase`
   is a relative path (`/_user/api/v1`). In the browser, nginx routes `/_user|/_inventory`
   to the PHP backend — fine. But during SSR, Nuxt's `$fetch` resolves a relative
   URL **against the Nitro server itself** (`127.0.0.1:<port>`), which does not serve
   the PHP backend → **HTTP 502**. So every SSR-time auth call fails.

2. **`fetchUser()` destroys the session on _any_ error.** Its `catch` ran
   `clearSession()`, which sets `token.value = null`. Because `token` is a
   `useCookie('auth_token')` ref, nulling it emits a `Set-Cookie` that **deletes
   the cookie** in the SSR response. So bug (1)'s 502 wipes a perfectly valid
   session on every reload.

Either alone is survivable; together they guarantee a logout on reload.

## The fix (two parts)

- **(a) Give SSR an absolute, server-reachable API origin** and use it only on the
  server. Client request URLs stay byte-for-byte identical (still relative).
- **(b) Make `fetchUser()` non-destructive** — only `clearSession()` on a genuine
  `401`. On network errors / 5xx (e.g. SSR backend unreachable, transient 502),
  keep the cookie so the client can hydrate and retry.

---

## Changes to apply (4 files)

### 1. `nuxt.config.ts` — add a server-only `internalApiOrigin`

Add to `runtimeConfig` **at the top level** (NOT under `public` — it must never
reach the client):

```ts
runtimeConfig: {
  // Server-only: absolute origin SSR uses to reach the backend (Nitro can't
  // serve relative /_user|/_inventory paths against itself — they 502).
  // Override per deployment with NUXT_INTERNAL_API_ORIGIN.
  internalApiOrigin: process.env.NUXT_INTERNAL_API_ORIGIN
    || process.env.NUXT_PUBLIC_SITE_URL
    || 'http://localhost', // ← set the starter default to your canonical prod origin
  public: {
    apiBase: '',
    userApiBase: '/_user/api/v1',
    // ...unchanged
  },
},
```

> In the starter, default it to `process.env.NUXT_PUBLIC_SITE_URL` and leave the
> hard-coded fallback generic (or empty) — each scaffold sets the real origin via
> `NUXT_INTERNAL_API_ORIGIN` / `NUXT_PUBLIC_SITE_URL`.

### 2. `app/utils/apiOrigin.ts` — NEW: single source of truth

```ts
/**
 * Resolve a same-origin relative API path to an absolute URL during SSR.
 * Browser: returns the path UNCHANGED (client requests stay identical).
 * SSR: prefixes runtimeConfig.internalApiOrigin so $fetch reaches the real
 * backend instead of resolving against Nitro itself (502).
 * Degrades gracefully if internalApiOrigin is unset. Call inside Nuxt setup scope.
 */
export function resolveApiUrl(path: string): string {
  if (import.meta.client) return path
  const origin = useRuntimeConfig().internalApiOrigin as string
  if (!origin) return path
  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
}
```

### 3. `app/plugins/api.ts` — SSR `baseURL` uses the absolute origin

```ts
// SSR resolves relative paths against the Nitro server itself (502). Use the
// server-only absolute backend origin during SSR; keep the client baseURL
// exactly as before (empty/relative → same-origin, nginx-routed).
const baseURL = import.meta.server
  ? (config.internalApiOrigin as string) || (config.public.apiBase as string)
  : (config.public.apiBase as string)

const rawApi = $fetch.create({
  baseURL,
  // ...rest unchanged
})
```

### 4. `app/stores/auth.ts` — wrap SSR calls + clear only on 401

Wrap every call that can run during SSR (login/register are client-only and can
stay as-is, but `fetchUser` and `fetchCanUseAi` run in the SSR hydrate plugin):

```ts
import { resolveApiUrl } from '~/utils/apiOrigin'

// fetchUser():
const response = await $fetch<{ user: AuthUser }>(
  resolveApiUrl(`${userApiBase()}/fetch`),
  { headers: { Authorization: `Bearer ${token.value}` } },
)
// ...
catch (err: unknown) {
  // Only a real 401 means the token is invalid. Network errors / 5xx (SSR
  // backend unreachable, transient 502) must NOT delete a valid session.
  const status = (err && typeof err === 'object' && 'status' in err)
    ? (err as { status: number }).status
    : (err && typeof err === 'object' && 'statusCode' in err)
        ? (err as { statusCode: number }).statusCode
        : undefined
  if (status === 401) {
    clearSession()
  }
  // else: keep token + session intact (client will hydrate/retry).
}

// fetchCanUseAi(): same wrap on the /me/areas call
const response = await $fetch(resolveApiUrl(`${base}/me/areas`), { /* ... */ })
```

---

## Verify after porting

1. `npm run build` (nuxt build) succeeds.
2. Client request URLs are unchanged (relative) — only SSR gets the absolute prefix.
3. `internalApiOrigin` is NOT present in `public` (server-only).
4. Manual: log in → hard-reload (Ctrl+R) → you stay logged in.

## Deploy reminder (per-project)

The deployed app is a built Nitro server under supervisor. A code change needs a
rebuild + restart to take effect (on whereiput.it: `npm run build` then
`supervisorctl restart whereiput-vue`).
