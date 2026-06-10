# vue-starter-app

A reusable **headless-WinterCMS Nuxt 4 frontend starter**, distilled from six
production Golem15 Vue apps. It boots into a working demo that exercises every
integration (JWT auth, Centrifugo realtime, i18n, SEO, and a Journal/blog read
API) against the pinned LTS WinterCMS backend. Client projects gut the demo
pages and keep the wiring.

> This README is the single starter artifact. It carries the **VUE-01
> cross-app analysis** (below), the integration baseline, and the scaffolding
> guide. Sections marked _(stub — filled in a later plan)_ are completed by
> downstream plans 17-05 / 17-06.

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
pnpm dev                  # Nuxt dev server on http://localhost:3000
pnpm build                # production build
```

A running WinterCMS backend on `http://localhost:8000` is required for the auth
and blog demos (dev requests are proxied there).

## Runtime config / environment

All `runtimeConfig.public` keys default to the local backend and can be
overridden with the matching `NUXT_PUBLIC_*` env var (see `.env.example`):

| Key | Env override | Default | Purpose |
|-----|--------------|---------|---------|
| `apiBase` | `NUXT_PUBLIC_API_BASE` | `http://localhost:8000` | Backend origin |
| `userApiBase` | `NUXT_PUBLIC_USER_API_BASE` | `…/_user/api/v1` | JWT auth API |
| `journalApiBase` | `NUXT_PUBLIC_JOURNAL_API_BASE` | `…/_journal/api/v1` | Blog read API |
| `centrifugoWsUrl` | `NUXT_PUBLIC_CENTRIFUGO_WS_URL` | `` (empty) | Realtime WS; empty = graceful no-op |
| `siteUrl` | `NUXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical/sitemap/OG |

### Dev proxy (dev-only)

In dev, `/_user/api/**`, `/_journal/api/**`, and `/api/realtime/**` are proxied
to `http://localhost:8000` via **both** the Nitro SSR path (`routeRules` +
`nitro.devProxy`) and the Vite client path (`vite.server.proxy`). This proxy is
**dev-only** — production is same-origin and emits no proxy into the build
output.

## Integration baseline _(stub — finalized in 17-05 / 17-06)_

The starter wires these against the documented backend contract:

- **Auth** — JWT via `/_user/api/v1` (login, register, fetch, refresh, logout),
  cookie-based token, transparent 401 → refresh → retry. _(17-02)_
- **Realtime** — `useCentrifugo` fetches `/api/realtime/token`, connects
  `centrifuge`, subscribes to `user:{id}`; degrades gracefully when the WS URL
  is unset. _(17-03)_
- **i18n** — `@nuxtjs/i18n` with a locale switcher (en + pl) wired in
  `app/layouts/default.vue`.
- **SEO** — `@nuxtjs/seo` (`site` config, sitemap, OG defaults).
- **Blog** — `useBlog` against `/_journal/api/v1` (posts, post detail,
  categories) + demo blog pages. _(17-04)_

## Scaffolding a new client frontend _(stub — filled by 17-06)_

`./frontend-init.sh --name=<name> --repo=git@…` (lives in the parent inventory
repo) renames the app identifiers, re-points the submodule git origin, and
updates the superproject `.gitmodules`. Full usage documented when the script
ships in 17-06.

## Security notes

- Token storage is a `SameSite=Lax` cookie (SSR-friendly). Bearer is sent in
  the `Authorization` header only — never a query string, never logged.
- `.env.example` carries **placeholders only**; no real secrets are committed.
- The dev proxy never ships to production (same-origin in build output).
