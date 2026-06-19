# vue-inventory-app — whereiput.it

The **Vue SPA front-end** for [whereiput.it](https://whereiput.it) — a personal/household
inventory catalog for physical things scattered across many places. You record **what** you own,
**which category** it belongs to, and **where** it physically lives (a Location inside an Area), then
find it instantly by searching instead of hunting through drawers and boxes.

> **Core value:** type the name of a thing and immediately see where it is — across every Area you
> have access to.

It is a **Nuxt 4** app that talks to a `Golem15\Inventory` WinterCMS backend over a permission-scoped
JSON API. It is the primary UI of the [Inventory superproject](https://github.com/golem15com/wn-inventory-app)
and is consumed there as a git submodule; it can also be cloned and run on its own against any
whereiput.it backend.

---

## What's in the app

| Area | Pages | Notes |
|------|-------|-------|
| **Dashboard** | `dashboard`, `index` | Area/Location/Item overview + search on-ramp; logged-out `/` redirects to onboarding/login |
| **Browse & edit** | `areas/[id]`, `locations/[id]`, `items/[id]` (+ `…/edit`), `items/new`, `categories` | Full Area → Location → Item CRUD with photo galleries |
| **Search** | `search` | Permission-scoped search-to-location (Typesense-backed, server-enforced) |
| **AI photo-assist** | `ai-assist` | Snap a photo → recognize items → bulk-save into a Location (gated by `ai-gate` middleware) |
| **Account & org** | `settings`, `organisation`, `onboarding`, `change-password` | BYOK AI credentials, API tokens / MCP install, organisation shared-AI + members |
| **Auth** | `login` | JWT login; first-run zero-user deploys route into `onboarding` |
| **Static** | `help`, `privacy`, `terms` | `public.vue` layout |

The domain model is **Area → Location → Item** (an Item has an `ItemCategory` and many `Tag`s, and
lives in a Location inside an Area). All access is permission-scoped **per-Area, server-side** — the
SPA never filters for security; the backend is the authority.

## Stack

- **Nuxt 4** (`app/` dir, file routing, auto-imports) — **SSR by default**; static **SPA mode** for
  self-host (`NUXT_SPA_MODE=1`, see below)
- **Vue 3.5 · Pinia 3 · VueUse 14**
- **Tailwind v4** — CSS-first (`@import "tailwindcss"` + `@tailwindcss/vite`); **no
  `tailwind.config.ts`, no `@nuxtjs/tailwindcss`**
- **shadcn-vue** (reka-ui primitives) — components in `app/components/ui/`: `button`, `card`, `input`,
  `label`, `dialog`, `sheet`, `popover`, `command`, `combobox`, `select`, `tags-input`, `sonner`
- **@nuxtjs/i18n** (en + pl, cookie-detected, lazy, `no_prefix`)
- **@nuxtjs/seo** (site config, sitemap, OG)
- **@nuxtjs/color-mode** (dark mode for the shadcn theme)
- **@vite-pwa/nuxt** (installable PWA, offline app shell, autoUpdate)
- **centrifuge** (optional realtime) · **Playwright** (E2E)

## Quick start

```bash
pnpm install
cp .env.example .env       # set NUXT_DEV_BACKEND_ORIGIN to your backend
pnpm dev                   # Nuxt dev server on http://localhost:3118
pnpm build                 # SSR production build
pnpm generate              # static build (set NUXT_SPA_MODE=1 for the SPA shell)
pnpm typecheck             # strict TS check
pnpm test:e2e              # Playwright E2E
```

A running WinterCMS Inventory backend is required (auth, inventory CRUD, search, AI). In dev, the
backend routes are **proxied** to `NUXT_DEV_BACKEND_ORIGIN` — see **Dev proxy** below.

> **Backend port:** the `nuxt.config.ts` default is `http://localhost:8000`, but the Inventory
> backend's `php artisan serve` runs on **:8421** here, so the committed `.env` sets
> `NUXT_DEV_BACKEND_ORIGIN=http://localhost:8421`. Point it at wherever your backend actually runs.

## Runtime config / environment

The app addresses the backend with **same-origin relative paths** (`/_user/api`, `/_inventory/api`,
`/api/realtime`, `/storage`), so there is **no cross-origin request and no CORS** in dev or prod. In
dev those paths are proxied to `NUXT_DEV_BACKEND_ORIGIN`; in prod the app is served same-origin with
the backend. All `runtimeConfig.public` keys are non-secret (they ship to the browser) and override
via the matching `NUXT_PUBLIC_*` env var.

| Key | Env override | Default | Purpose |
|-----|--------------|---------|---------|
| `apiBase` | `NUXT_PUBLIC_API_BASE` | `` (same-origin) | Backend origin; empty = relative URLs |
| `userApiBase` | `NUXT_PUBLIC_USER_API_BASE` | `/_user/api/v1` | Golem15.User JWT auth API |
| `inventoryApiBase` | — | `/_inventory/api/v1` | Golem15.Inventory read/write API |
| `journalApiBase` | `NUXT_PUBLIC_JOURNAL_API_BASE` | `/_journal/api/v1` | Blog read API (optional) |
| `centrifugoWsUrl` | `NUXT_PUBLIC_CENTRIFUGO_WS_URL` | `` (empty) | Realtime WS; empty = graceful no-op |
| `siteUrl` | `NUXT_PUBLIC_SITE_URL` | `https://whereiput.it` | Canonical/sitemap/OG |
| `mcpInstallUrl` | `NUXT_PUBLIC_MCP_INSTALL_URL` | `https://mcp.whereiput.it` | MCP server origin shown in the token-mint reveal |
| `mcpInstallCommand` | `NUXT_PUBLIC_MCP_INSTALL_COMMAND` | `curl -fsSL https://mcp.whereiput.it \| bash` | MCP install one-liner shown in Settings → Integrations |

Server-only (not in `public`):

| Key | Env override | Default | Purpose |
|-----|--------------|---------|---------|
| `internalApiOrigin` | `NUXT_INTERNAL_API_ORIGIN` | dev: `NUXT_DEV_BACKEND_ORIGIN` → else `siteUrl` | Absolute origin SSR uses to reach the PHP backend (Nitro can't serve relative paths against itself) |

> **Self-hosting the MCP integration:** the `mcpInstall*` defaults point at the hosted
> `mcp.whereiput.it`. The MCP server is now self-hostable (see `inventory-mcp` in the superproject) and
> the project ships no hosted SaaS — set `NUXT_PUBLIC_MCP_INSTALL_URL` /
> `NUXT_PUBLIC_MCP_INSTALL_COMMAND` to **your own** MCP host so the Integrations tab shows the right
> install command for your deployment.

### SSR vs SPA build

- **Dev (`:3118`) and the SSR production server** run with `ssr: true` (the default).
- The self-host **static build** (`docker/spa.Dockerfile` in the superproject sets `NUXT_SPA_MODE=1`)
  renders as a **pure client-rendered SPA** (`ssr: false`). This app is client-auth-gated (JWT in a
  JS-readable cookie); prerendering protected routes with `nuxt generate` + `ssr: true` would bake a
  redirect-to-`/login` into the static HTML (no session exists at build time) and meta-refresh
  logged-in users to `/login` on reload. The SPA shell defers auth to the browser, where the cookie
  exists (paired with `plugins/auth-init.client.ts`).

### Dev proxy (dev-only)

In dev, `/_user/api/**`, `/_inventory/api/**`, `/_journal/api/**`, `/api/realtime/**`, and
`/storage/**` are proxied to `NUXT_DEV_BACKEND_ORIGIN` via **both** the Nitro SSR path (`routeRules`
`proxy` + `nitro.devProxy`) and the Vite client path (`vite.server.proxy`) — Nuxt has two request
paths in dev and both must be proxied or server-rendered (Nitro) or client (Vite) fetches silently
miss the backend. The proxy is **dev-only**; production is same-origin and emits no proxy into the
build output.

## Integration baseline

Every integration reads its base URL from a `runtimeConfig.public` key, so no backend origin is
hard-coded in feature code.

### Auth — JWT over `/_user/api/v1`

- **Endpoints:** `POST /login`, `POST /register`, `GET /fetch`, `POST /refresh`, `POST /logout`,
  `POST /change-password` (under `userApiBase`).
- **Wired files:** `app/plugins/api.ts` (`$api` `$fetch` wrapper — attaches the bearer SSR-side via
  `useCookie` and client-side via `document.cookie`, with a transparent client-only 401 → refresh →
  retry), `app/stores/auth.ts` (Pinia: `login/register/fetchUser/logout`, `isLoggedIn` + `can_use_ai`
  / org flags from `/me/areas`), `app/plugins/token-refresh.client.ts` (proactive refresh before JWT
  expiry), `app/plugins/auth-init.{client,server}.ts` (session hydrate before first paint),
  `app/middleware/auth.ts` (UX-only route guard — **not** a security boundary),
  `app/middleware/force-password-change.global.ts` (org members on a temp password are forced to
  `change-password`).
- **Token storage:** a `SameSite=Lax`, JS-readable cookie (`auth_token`) — SSR-friendly so the bearer
  attaches on the server during first paint. The bearer is sent in the `Authorization` header only,
  never a query string, never logged.

### Inventory — `useInventory` + inventory store over `/_inventory/api/v1`

- **Reads** are keyed `useFetch` (`useInventory.ts`); **writes** go through the inventory store's
  `$api` calls (Pinia, `refreshNuxtData` per key).
- **Endpoints:**
  - Areas: `GET/POST /areas`, `GET/PUT/DELETE /areas/{id}`, `GET /areas/{id}/locations`,
    `POST/DELETE /areas/{id}/photos[/{fileId}]`, `GET /me/areas` (accessible Areas + capability flags)
  - Locations: `GET/PUT/DELETE /locations/{id}`, `POST /locations/{id}/items`,
    `POST /locations/{id}/items/bulk`, `POST/DELETE /locations/{id}/photos[/{fileId}]`
  - Items: `GET/PUT/DELETE /items/{id}`, `POST/DELETE /items/{id}/photos[/{fileId}]`,
    `GET /items/search`, `POST /items/recognize` (AI photo-assist)
  - Taxonomy: `GET/POST /categories`, `GET/POST /tags` (global, create-only)
  - Tokens: `GET/POST /tokens`, `DELETE /tokens/{id}` (per-user API tokens for the JSON API / MCP)
  - BYOK AI: `GET/POST /ai-credential` + `POST /ai-credential/test`; org equivalents
    `/org-ai-credential[/test]`; org members `GET/POST /org/members`, `PATCH/DELETE /org/members/{id}`
- **Search-to-location** is the core value and is permission-scoped **server-side** — the SPA renders
  whatever the API returns and never filters for access.
- **Uploaded media** is served from `/storage/...` (same-origin relative; dev-proxied to the backend).

### Realtime — Centrifugo over `/api/realtime/token` (optional)

- **Wired files:** `app/composables/useCentrifugo.ts` (module-level singleton:
  `connect/disconnect/onEvent`, `isConnected`).
- **Flow:** `connect()` → `$api('/api/realtime/token')` → `{ token }` →
  `new Centrifuge(centrifugoWsUrl, { token })` → subscribe `user:{auth.user.id}`. Auth-gated,
  client-only, idempotent.
- **Graceful degrade:** when `centrifugoWsUrl` is empty, `connect()` warns and no-ops (no socket, no
  network call) and the app boots/builds/tests green. The token is never logged. The WS connection is
  a **direct cross-origin socket** (not proxied) — set the URL and add the app origin to Centrifugo's
  `client.allowed_origins`.

### PWA

`@vite-pwa/nuxt` generates a Workbox service worker that precaches the app shell (installable +
offline). `registerType: 'autoUpdate'` activates new versions on next navigation. **Disabled in dev**
— test via `pnpm build && pnpm preview`. Install state is exposed via `app/composables/usePwa.ts`.

### i18n / SEO / branding

- **i18n:** `@nuxtjs/i18n`, en + pl, cookie-detected (`i18n_locale`), `no_prefix`, lazy; messages in
  `i18n/locales/{en,pl}.json`; switcher in `app/layouts/default.vue`.
- **SEO:** `site` config in `nuxt.config.ts` (canonical URL, name, description) → sitemap + OG; the
  default `siteUrl` is `https://whereiput.it` — override per deployment via `NUXT_PUBLIC_SITE_URL`.
- **Brand:** royal-blue / kraft-amber theme (oklch tokens in `app/assets/css/main.css`); favicons +
  PWA icons in `public/`.

## Testing (Playwright E2E)

```bash
pnpm test:e2e
```

- **Config:** `playwright.config.ts` — an `auth.setup.ts` project (storageState login) + `chromium`,
  with a `pnpm dev` `webServer` (port from `E2E_FRONTEND_URL`). It `dotenv`-loads
  `tests/e2e/.env.local` then `.env`.
- **Specs:** `smoke` (always-green boot/build baseline), `login` + `i18n`, the inventory suite
  (`inventory-access`, `inventory-area`, `inventory-location`, `inventory-item`, `inventory-category`,
  `inventory-search`, `inventory-ai-assist`), `organisation`, `realtime`, and `responsive`.
- **Backend-gated specs skip (not fail)** when their dependency (a seeded user, a reachable Inventory
  API, live Centrifugo, or a vision model) is absent — CI stays green without a full backend.
- **Seed contract:** copy `tests/e2e/.env.example` → `tests/e2e/.env.local` and set `E2E_EMAIL` /
  `E2E_PASSWORD`, `E2E_BACKEND_URL`, `E2E_FRONTEND_URL` (and `E2E_CENTRIFUGO=1` for live realtime).
  `tests/e2e/helpers/runTinker.ts` seeds fixtures via `php artisan tinker` against a running backend
  (no-ops + warns when the backend is down).

## Running inside the superproject

This app is a git submodule of the [Inventory superproject](https://github.com/golem15com/wn-inventory-app)
at `vue-inventory-app/`. Self-hosting (the full Docker topology that serves this SPA same-origin with
the backend behind an edge proxy) is documented in the superproject's `docs/SELF-HOSTING.md`. To work
on the app:

```bash
# in the submodule: commit + push to this repo, then bump the superproject gitlink
cd vue-inventory-app
git checkout master && git pull
# ...changes, commit, push...
cd ..
git add vue-inventory-app && git commit -m "Update vue-inventory-app submodule reference"
```

## Security notes

- All per-Area access is enforced **server-side**, including in search results — the SPA never filters
  for security.
- Token storage is a `SameSite=Lax` cookie (SSR-friendly). The JWT bearer is sent in the
  `Authorization` header only — never a query string, never logged. The realtime connection token is
  likewise never logged.
- `.env.example` carries **placeholders only**; no real secrets are committed.
- The dev proxy never ships to production (same-origin in the build output).
