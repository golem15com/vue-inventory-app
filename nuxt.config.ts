import tailwindcss from '@tailwindcss/vite'

// Dev-proxy target for the backend. The app addresses the backend with
// SAME-ORIGIN relative paths (see runtimeConfig.public below), and in dev the
// proxies further down forward those paths here — so there is NO cross-origin
// request and NO CORS needed. In production the app is same-origin with the
// backend, so the relative paths resolve directly and no proxy is emitted
// (dev-only — T-17-01).
//
// Override the dev backend with NUXT_DEV_BACKEND_ORIGIN when your backend runs
// somewhere other than :8000 (e.g. `NUXT_DEV_BACKEND_ORIGIN=http://127.0.0.1:8421`).
const BACKEND_ORIGIN = process.env.NUXT_DEV_BACKEND_ORIGIN || 'http://localhost:8000'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Canonical dev/preview port for this app is 3118 (matches siteUrl + the
  // Centrifugo allowed-origin you whitelist). Override only via NUXT_PORT or
  // `nuxt dev --port`. NB: if 3118 is already taken, the Nuxt listener silently
  // falls back to another port (often :3000) — keep 3118 free, or pass NUXT_PORT.
  devServer: { port: Number(process.env.NUXT_PORT) || 3118 },

  // TypeScript strict mode (typeCheck off — run `pnpm typecheck` explicitly).
  typescript: {
    strict: true,
    typeCheck: false,
  },

  // Tailwind v4 CSS-first entry (PITFALL 4 — no tailwind.config.ts, no
  // @nuxtjs/tailwindcss module). The @tailwindcss/vite plugin (vite.plugins
  // below) is how v4 wires into Nuxt.
  css: ['./app/assets/css/main.css'],

  modules: [
    '@pinia/nuxt',
    '@vueuse/nuxt',
    'shadcn-nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/seo',
    '@nuxtjs/color-mode',
  ],

  // -------------------------------------------------------------------------
  // Runtime config — canonical public keys downstream plans + client projects
  // consume. The HTTP API bases default to SAME-ORIGIN relative paths so the
  // browser never makes a cross-origin call (no CORS): in dev they are proxied
  // to NUXT_DEV_BACKEND_ORIGIN, in production they resolve against the app's own
  // origin. Only override these (with NUXT_PUBLIC_*) if the backend is on a
  // genuinely different origin — in which case that backend must send CORS
  // headers for the app origin.
  // -------------------------------------------------------------------------
  runtimeConfig: {
    public: {
      // Backend base — same-origin (empty) so $api uses relative URLs.
      apiBase: '',
      // Golem15.User JWT auth API (relative → proxied in dev, same-origin in prod).
      userApiBase: '/_user/api/v1',
      // Golem15.Journal blog read API (relative → proxied in dev, same-origin in prod).
      journalApiBase: '/_journal/api/v1',
      // Centrifugo websocket URL. Empty = realtime gracefully degrades (no-op).
      // The WS connection is a direct cross-origin socket (not proxied) — set it
      // to your Centrifugo endpoint and add the app origin to Centrifugo's
      // `client.allowed_origins`. Dev example: ws://localhost:8787/connection/websocket
      centrifugoWsUrl: '',
      // Public site URL (canonical/sitemap/OG via @nuxtjs/seo).
      siteUrl: 'http://localhost:3118',
    },
  },

  // -------------------------------------------------------------------------
  // i18n — cookie-detected, lazy-loaded, no URL prefix. The locale switcher
  // lives in app/layouts/default.vue; `locale` feeds the Journal `locale` query.
  // -------------------------------------------------------------------------
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-US', file: 'en.json', name: 'English' },
      { code: 'pl', language: 'pl-PL', file: 'pl.json', name: 'Polski' },
    ],
    langDir: 'locales/',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root',
    },
  },

  // -------------------------------------------------------------------------
  // SEO (@nuxtjs/seo 5.2.1) — PITFALL 5 resolved: the `site` config in 5.x is
  // backed by nuxt-site-config 4.x / site-config-stack 4.0.8. Canonical keys
  // are `url`, `name`, `indexable`, `env`, `trailingSlash` plus an open index
  // signature, so `description`/`defaultLocale` remain valid passthrough keys
  // (consumed by schema-org / seo-utils; defaultLocale also resolved from i18n).
  // The 3.x reference shape still holds.
  // -------------------------------------------------------------------------
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3118',
    name: 'Vue Starter App',
    description: 'Headless WinterCMS Nuxt 4 starter (auth, realtime, i18n, SEO, blog).',
    defaultLocale: 'en',
  },

  // shadcn-nuxt UI module (components.json created in Task 3).
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  // Color mode (dark mode for shadcn cssVariables theme).
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
  },

  // -------------------------------------------------------------------------
  // Dev proxy — PITFALL 6: Nuxt has TWO request paths in dev (Nitro SSR +
  // Vite client). The same backend routes must be proxied in BOTH or
  // server-rendered fetches (Nitro) or client fetches (Vite) silently miss the
  // backend. Routes: /_user/api/**, /_journal/api/**, /api/realtime/**.
  // routeRules `proxy` also covers SSR; all three are dev-only (T-17-01).
  // -------------------------------------------------------------------------
  routeRules: {
    '/_user/api/**': { proxy: `${BACKEND_ORIGIN}/_user/api/**` },
    '/_journal/api/**': { proxy: `${BACKEND_ORIGIN}/_journal/api/**` },
    '/api/realtime/**': { proxy: `${BACKEND_ORIGIN}/api/realtime/**` },
  },

  nitro: {
    // Dev proxy for SSR (Nitro) requests — mirrors the Vite proxy below.
    devProxy: {
      '/_user/api': { target: `${BACKEND_ORIGIN}/_user/api`, changeOrigin: true },
      '/_journal/api': { target: `${BACKEND_ORIGIN}/_journal/api`, changeOrigin: true },
      '/api/realtime': { target: `${BACKEND_ORIGIN}/api/realtime`, changeOrigin: true },
    },
  },

  vite: {
    // Tailwind v4 vite plugin (PITFALL 4 — this is the v4 wiring).
    plugins: [tailwindcss()],
    // Pre-bundle deps Vite would otherwise discover at runtime (causing a one-off
    // dev page reload on first hit). Listing them here makes the first dev load
    // stable. Harmless if a dep is unused on a given route.
    optimizeDeps: {
      include: [
        '@unhead/schema-org/vue',
        'centrifuge',
        'class-variance-authority',
        'clsx',
        'reka-ui',
        'tailwind-merge',
      ],
    },
    // Dev proxy for client (Vite) requests — mirrors nitro.devProxy above.
    server: {
      proxy: {
        '/_user/api': { target: BACKEND_ORIGIN, changeOrigin: true },
        '/_journal/api': { target: BACKEND_ORIGIN, changeOrigin: true },
        '/api/realtime': { target: BACKEND_ORIGIN, changeOrigin: true },
      },
    },
  },

  app: {
    head: {
      title: 'Vue Starter App',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Headless WinterCMS Nuxt 4 starter.' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },
})
