import tailwindcss from '@tailwindcss/vite'

// NOTE: This is the Task-1 minimal config. Task 2 replaces it with the full
// composite (modules, runtimeConfig, dual dev-proxy, i18n, SEO).
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['./app/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },
})
