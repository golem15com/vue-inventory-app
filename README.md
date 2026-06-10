# vue-starter-app

A reusable **headless-WinterCMS Nuxt 4 frontend starter**, distilled from six
production Golem15 Vue apps. It boots into a working demo that exercises every
integration (JWT auth, Centrifugo realtime, i18n, SEO, and a Journal/blog read
API) against the pinned LTS WinterCMS backend. Client projects gut the demo
pages and keep the wiring.

> This README is the single starter artifact. It carries the **VUE-01
> cross-app analysis** (below), the integration baseline, the testing harness,
> and the scaffolding guide — everything you need to stand up a new client
> frontend from this starter.

---

## VUE-01 — Library-frequency analysis & architecture recommendation

Tabulated from all six production `package.json` files (deps + devDeps).
"Count" = number of apps shipping the package. Frameworks: horoskopia
(Nuxt 4), golem15com (Nuxt 3), drzewo (Vite SPA), queststream (Nuxt 3),
wavepath (Vite SPA), golemxv (Nuxt 4).

| Library | horoskopia | golem15com | drzewo | queststream | wavepath | golemxv | Count | Starter baseline? |
|---------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **vue 3.5** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **6/6** | ✓ core |
| **pinia 3** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **6/6** | ✓ core |
| **tailwindcss v4** (`@tailwindcss/vite`) | ✓ | ✓ | ✓ | v3¹ | ✓ | ✓ | **5/6 v4** | ✓ core (v4) |
| **typescript (strict)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **6/6** | ✓ core |
| **@playwright/test** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓² | **6/6** | ✓ core |
| **@vueuse/\* (~14)** | ✓ | – | ✓ | ✓ | ✓ | ✓ | **5/6** | ✓ core |
| **centrifuge 5.5+** | ✓ | – | ✓ | ✓ | ✓ | ✓ | **5/6** | ✓ core |
| **nuxt** | 4 | 3 | – | 3 | – | 4 | 4/6 | ✓ (Nuxt 4, D-04) |
| **@pinia/nuxt** | ✓ | ✓ | – | ✓ | – | ✓ | 4/4 Nuxt | ✓ (Nuxt path) |
| **@nuxtjs/i18n** | – | ✓ | – | ✓ | – | – | 2/4 Nuxt | ✓ (D-12 mandates) |
| **@nuxtjs/seo** | – | ✓ | – | ✓ | – | – | 2/4 Nuxt | ✓ (D-12 mandates) |
| **@nuxtjs/color-mode** | ✓ | – | – | ✓ | – | – | 2/6 | ✓ (shadcn dark mode) |
| **reka-ui** (shadcn primitive) | – | – | – | – | ✓ | – | 1/6 | ✓ (D-07 head-start) |
| **class-variance-authority** | – | – | – | – | ✓ | – | 1/6 | ✓ (shadcn) |
| **vue-sonner** (toast) | – | – | – | – | ✓ | – | 1/6 | ✓ (shadcn toast, D-07) |
| **lucide** icons | – | – | – | – | ✓ | ✓ | 2/6 | ✓ (shadcn icons) |
| **axios** | – | – | ✓ | – | ✓ | – | 2/6 | ✗ (use Nuxt `$fetch`) |

¹ queststream uses the legacy `@nuxtjs/tailwindcss` (Tailwind v3). The Nuxt 4
apps use Tailwind v4 via `@tailwindcss/vite`. **Starter uses v4.**
² golemxv's `package.json` does not list Playwright, but it is locked into the
starter; all other five apps ship it.

### Architecture recommendation: **Nuxt 4** (not Vite SPA)

The six apps converge on one tight, modern library baseline regardless of app
shell. The recommended architecture is **Nuxt 4** with the `app/` directory
convention, because:

1. **4 of 6** apps are Nuxt, and the **two newest** production apps
   (horoskopia, golemxv) are both **Nuxt 4**.
2. **SSR is load-bearing** for the SEO + blog integrations — a Vite SPA cannot
   server-render blog posts for crawlers without extra infrastructure.
3. The library baseline is framework-agnostic; only the app shell differs
   between the Nuxt and Vite-SPA apps, so picking Nuxt loses nothing at the
   library level while gaining SSR.

The two Vite SPA apps (drzewo, wavepath) are **not** a supported starter path.

---

## Stack

- **Nuxt 4** (`app/` dir, SSR, file routing, auto-imports)
- **Vue 3.5 · Pinia 3 · VueUse 14**
- **Tailwind v4** — CSS-first (`@import "tailwindcss"` + `@tailwindcss/vite`);
  **no `tailwind.config.ts`, no `@nuxtjs/tailwindcss`**
- **shadcn-vue** via `shadcn-nuxt` (new-york / zinc, cssVariables) — base set:
  `button`, `input`, `dialog`, `sonner`
- **@nuxtjs/i18n** (en + pl, cookie-detected, lazy, `no_prefix`)
- **@nuxtjs/seo** (site config, sitemap, OG)
- **@nuxtjs/color-mode** (dark mode for the shadcn theme)
- **centrifuge** (realtime) · **Playwright** (E2E smoke)

## Quick start

```bash
pnpm install
cp .env.example .env      # adjust NUXT_PUBLIC_* if needed
pnpm dev                  # Nuxt dev server on http://localhost:3118
pnpm build                # production build
pnpm typecheck            # strict TS check
```

A running WinterCMS backend on `http://localhost:8000` is required for the auth
and blog demos (dev requests are proxied there — see **Dev proxy** below).
**Centrifugo is optional:** realtime degrades gracefully (warn + no-op) when
`centrifugoWsUrl` is unset, so the starter boots, builds, and tests green
without it. The home page (`/`) exercises every integration; client projects gut
the demo pages and keep the wiring.

## Runtime config / environment

All `runtimeConfig.public` keys default to the local backend and can be
overridden with the matching `NUXT_PUBLIC_*` env var (see `.env.example`):

| Key | Env override | Default | Purpose |
|-----|--------------|---------|---------|
| `apiBase` | `NUXT_PUBLIC_API_BASE` | `http://localhost:8000` | Backend origin |
| `userApiBase` | `NUXT_PUBLIC_USER_API_BASE` | `…/_user/api/v1` | JWT auth API |
| `journalApiBase` | `NUXT_PUBLIC_JOURNAL_API_BASE` | `…/_journal/api/v1` | Blog read API |
| `centrifugoWsUrl` | `NUXT_PUBLIC_CENTRIFUGO_WS_URL` | `` (empty) | Realtime WS; empty = graceful no-op |
| `siteUrl` | `NUXT_PUBLIC_SITE_URL` | `http://localhost:3118` | Canonical/sitemap/OG |

### Dev proxy (dev-only)

In dev, `/_user/api/**`, `/_journal/api/**`, and `/api/realtime/**` are proxied
to `http://localhost:8000` via **both** the Nitro SSR path (`routeRules` +
`nitro.devProxy`) and the Vite client path (`vite.server.proxy`). This proxy is
**dev-only** — production is same-origin and emits no proxy into the build
output.

## Integration baseline

This is the documented contract the starter wires out of the box. Every
integration reads its base URL from a `runtimeConfig.public` key (overridable
via the matching `NUXT_PUBLIC_*` env var — see the table above), so no backend
origin is hard-coded in feature code.

### Auth — JWT over `/_user/api/v1`

- **Endpoints:** `POST /login`, `POST /register`, `GET /fetch`, `POST /refresh`,
  `POST /logout` (all under `userApiBase` = `…/_user/api/v1`).
- **Wired files:** `app/plugins/api.ts` (`$api` `$fetch` wrapper — attaches the
  bearer SSR-side via `useCookie` and client-side via `document.cookie`, with a
  transparent client-only 401 → refresh → retry), `app/utils/tokenRefresh.ts`
  (single in-flight refresh mutex), `app/stores/auth.ts` (Pinia store:
  `login/register/fetchUser/logout`, `isLoggedIn`), `app/plugins/
  token-refresh.client.ts` (proactive refresh ~5 min before JWT expiry),
  `app/plugins/auth-init.server.ts` (SSR session hydrate before first paint),
  `app/middleware/auth.ts` (UX-only route guard — **not** a security boundary),
  `app/pages/login.vue` (demo login).
- **runtimeConfig keys:** `apiBase`, `userApiBase`.
- **Token storage (default):** a `SameSite=Lax`, JS-readable cookie
  (`auth_token`) — SSR-friendly so the bearer attaches on the server during
  first paint. The bearer is sent in the `Authorization` header only, never a
  query string, never logged.
- **Hardening upgrade (optional, A4 / T-17-04):** for stricter XSS posture, move
  to an **httpOnly** cookie set by the backend on login/refresh (the browser
  never reads the token). That requires a same-origin (or proxied) deployment
  and a backend that sets `Set-Cookie: httpOnly; Secure; SameSite=Lax` — at
  which point the client-side `document.cookie` bearer-attach is dropped in
  favour of the cookie riding along automatically. The SameSite=Lax default
  ships working everywhere; the httpOnly path is the production hardening step.
- **`auth:session-expired`** is a `window` event dispatched when a refresh
  fails; the store clears the session and the refresh timer stops.

### Realtime — Centrifugo over `/api/realtime/token`

- **Endpoint:** `GET /api/realtime/token` → `{ token }` (read directly).
- **Wired files:** `app/composables/useCentrifugo.ts` (module-level singleton:
  `connect/disconnect/onEvent`, `isConnected`), demoed in `app/pages/index.vue`.
- **runtimeConfig keys:** `centrifugoWsUrl` (+ `apiBase` for the token fetch).
- **Flow:** `connect()` → `$api('/api/realtime/token')` → `{ token }` →
  `new Centrifuge(centrifugoWsUrl, { token })` → subscribe `user:{auth.user.id}`
  → publications routed through `onEvent`. Auth-gated, client-only, idempotent.
- **Graceful degrade:** when `centrifugoWsUrl` is empty, `connect()` warns and
  no-ops (no `Centrifuge` instance, no network call) and the home page shows an
  honest "realtime not configured" note. The token is never logged (T-17-15).

### Realtime note (Centrifugo must run for live events)

For the **live** realtime demo, run a Centrifugo server and set the dev WS URL:

```bash
NUXT_PUBLIC_CENTRIFUGO_WS_URL=ws://localhost:8000/connection/websocket
```

With Centrifugo up + a logged-in user, the home page badge reaches **Connected**
and the live-event feed fills from the `user:{id}` channel. Without it, the
starter still boots/builds/tests green via the graceful-degrade path above.

### i18n — `@nuxtjs/i18n` (en + pl)

- **Wired files:** locale switcher in `app/layouts/default.vue`; messages in
  `i18n/locales/{en,pl}.json`. Cookie-detected (`i18n_locale`), `no_prefix`
  strategy, lazy-loaded. The active `locale` feeds the Journal `locale` query.

### SEO — `@nuxtjs/seo`

- **Wired files:** `site` config in `nuxt.config.ts` (canonical URL, name,
  description, `defaultLocale`) → sitemap + OG defaults; per-post `useSeoMeta`
  on the blog detail page (title/description/OG/article times).
- **runtimeConfig / env:** `siteUrl` / `NUXT_PUBLIC_SITE_URL` (canonical, sitemap,
  OG). The default `http://localhost:3118` emits a site-config "should not be
  localhost" warning — expected for the starter; real projects override it.

### Branding — Golem15 Stack badge

- **Wired files:** a muted "Built in [Golem15]" footer badge in
  `app/layouts/default.vue`, logo at `public/brand/golem15.svg`, `footer.poweredBy`
  i18n key in `i18n/locales/{en,pl}.json`.
- Intentionally subtle (`opacity-60`, footer-only) so the header/main stay the
  client project's branding space. Keep it to signal membership of the Golem15
  Stack, or remove the `<footer>` block + logo asset per project — nothing else
  depends on it.

### Blog — `useBlog` over `/_journal/api/v1`

- **Endpoints (under `journalApiBase` = `…/_journal/api/v1`):** `GET /posts`
  (`?page&per_page(≤30)&category&search(≥3 chars)&locale`), `GET /posts/{slug}`
  (returns the post + `previous_post`/`next_post`/`related_posts`),
  `GET /categories`.
- **Wired files:** `app/composables/useBlog.ts` (`fetchPosts/fetchPost/
  fetchCategories`, locale-keyed + `watch:[locale]`) + demo pages
  `app/pages/blog/` (index, category, detail). Post `content_html` is rendered
  via `v-html` from the **trusted backend field only** (T-17-10).
- **runtimeConfig keys:** `journalApiBase`.

## Testing (Playwright E2E)

The starter ships its own green E2E baseline — run it with:

```bash
pnpm test:e2e
```

- **Config:** `playwright.config.ts` — a `setup` project (storageState login) +
  `chromium`, with a `pnpm dev` `webServer` (port derived from
  `E2E_FRONTEND_URL`). It `dotenv`-loads `tests/e2e/.env.local` then `.env`.
- **Specs & gates:**
  | Spec | Requirement | Backend-gated? |
  |------|-------------|----------------|
  | `smoke.spec.ts` | VUE-02 boot/build | no — always-green baseline |
  | `login.spec.ts` | VUE-04 auth | **yes** — `test.skip` unless `E2E_EMAIL` + `E2E_PASSWORD` |
  | `blog.spec.ts` | VUE-04 blog | **yes** — `test.skip` if the Journal API is unreachable / 0 posts |
  | `i18n.spec.ts` | VUE-04 i18n | no — local messages (cookie + SSR locale render) |
  | `realtime.spec.ts` | VUE-03 realtime | **yes** — live path gated on `E2E_CENTRIFUGO`; else asserts graceful-degrade |
- **`E2E_*` seed contract:** copy `tests/e2e/.env.example` → `tests/e2e/.env.local`
  and set `E2E_EMAIL` / `E2E_PASSWORD` (auth), `E2E_BACKEND_URL`
  (default `http://localhost:8000`), `E2E_FRONTEND_URL`, and `E2E_CENTRIFUGO=1`
  (live realtime). Backend-gated specs **skip, not fail**, when their
  dependency is absent — CI stays green without a backend.
- **Seeding:** `tests/e2e/helpers/runTinker.ts` exports `seedE2EFixtures()`
  (`firstOrNew` an activated user matching `E2E_EMAIL`/`E2E_PASSWORD` +
  `updateOrCreate` a published Journal post) — runs `php artisan tinker` against
  a running WinterCMS backend; no-ops + warns when the backend is down.

## Scaffolding a new client frontend (the default path)

`frontend-init.sh` (in the **parent inventory repo root**, alongside this
submodule) is the documented, default way to start a new client frontend from
this starter. It renames the app identifiers, re-points the `vue-starter-app/`
submodule git origin at the client's repo, and syncs the superproject
`.gitmodules`:

```bash
# from the inventory superproject root:
./frontend-init.sh --name=<client> --repo=git@github.com:org/<client>.git

# preview every mutation, change nothing:
./frontend-init.sh --name=<client> --repo=git@github.com:org/<client>.git --dry-run
```

**What it does**

1. **Renames identifiers** — `package.json` `name`, this README title,
   `nuxt.config.ts` `site.name` + head title, the i18n `welcome` strings, and
   the `.env.example` header — from `vue-starter-app` / `Vue Starter App` to the
   client name (it also greps for any remaining string sprawl and reports it).
2. **Re-points the submodule origin** — `git -C vue-starter-app remote set-url
   origin <--repo>`.
3. **Syncs `.gitmodules`** — rewrites the `vue-starter-app` submodule `url`, then
   `git submodule sync --recursive`.

**Guards** (run first, even under `--dry-run`): it refuses if `--name` or
`--repo` is missing, if `vue-starter-app/` has uncommitted changes, if `--repo`
is the canonical starter origin (so the starter is never clobbered), or if it is
not being run from the starter superproject. `--dry-run` routes every mutation
through a `run()` wrapper and is a true no-op (clean `git status` after).
After it runs, commit inside the submodule, push to the client repo, then
advance the superproject gitlink (the script prints the exact next-step
commands).

## Security notes

- Token storage is a `SameSite=Lax` cookie (SSR-friendly). Bearer is sent in
  the `Authorization` header only — never a query string, never logged.
- `.env.example` carries **placeholders only**; no real secrets are committed.
- The dev proxy never ships to production (same-origin in build output).
