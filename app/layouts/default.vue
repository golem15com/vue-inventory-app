<script setup lang="ts">
import { Toaster } from '~/components/ui/sonner'

// Locale switcher. @nuxtjs/i18n writes the `i18n_locale` cookie
// (detectBrowserLanguage.useCookie) when `setLocale` is called.
const { locale, locales, setLocale, t } = useI18n()

const availableLocales = computed(() =>
  (locales.value as Array<{ code: string; name?: string }>).map(l => ({
    code: l.code,
    name: l.name ?? l.code.toUpperCase(),
  })),
)

function onLocaleChange(event: Event) {
  const code = (event.target as HTMLSelectElement).value
  setLocale(code as typeof locale.value)
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-body">
    <header class="border-b">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <nav class="flex items-center gap-4 text-sm">
          <NuxtLink to="/" class="font-semibold">{{ t('nav.home') }}</NuxtLink>
          <NuxtLink to="/blog">{{ t('nav.blog') }}</NuxtLink>
        </nav>

        <div class="flex items-center gap-3">
          <!-- auth slot — filled by 17-02 (auth store + login state) -->
          <!-- <AuthState /> -->

          <!-- Locale switcher (writes the i18n_locale cookie). -->
          <select
            :value="locale"
            aria-label="Language"
            class="rounded-md border bg-background px-2 py-1 text-sm"
            @change="onLocaleChange"
          >
            <option v-for="l in availableLocales" :key="l.code" :value="l.code">
              {{ l.name }}
            </option>
          </select>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-8">
      <slot />
    </main>

    <!-- Global toast outlet (vue-sonner via shadcn). -->
    <Toaster />
  </div>
</template>
