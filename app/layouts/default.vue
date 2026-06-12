<script setup lang="ts">
import { Toaster } from '~/components/ui/sonner'
import { Button } from '~/components/ui/button'

// Locale switcher. @nuxtjs/i18n writes the `i18n_locale` cookie
// (detectBrowserLanguage.useCookie) when `setLocale` is called.
const { locale, locales, setLocale, t } = useI18n()

// Auth store — surface the existing logout action (do NOT reimplement auth).
const auth = useAuthStore()

async function onLogout() {
  await auth.logout()
  await navigateTo('/login')
}

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
  <div class="flex min-h-screen flex-col bg-background text-foreground font-body">
    <header class="border-b">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <nav class="flex items-center gap-4 text-sm">
          <NuxtLink to="/" class="font-semibold">Inventory</NuxtLink>
        </nav>

        <div class="flex items-center gap-3 text-sm">
          <!-- Categories — neutral chrome (ghost), never accent-filled (D-03). -->
          <NuxtLink to="/categories" class="text-muted-foreground hover:text-foreground">
            {{ t('inventory.nav.categories') }}
          </NuxtLink>

          <!-- Logout — surfaces the existing auth store action (no reimplement). -->
          <Button variant="ghost" size="sm" @click="onLogout">
            {{ t('inventory.nav.logout') }}
          </Button>

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

    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <slot />
    </main>

    <!--
      Golem15 Stack attribution. Intentionally subtle — the header/main are the
      client project's space; this footer badge marks the starter as part of the
      Golem15 Stack without competing with project branding. Safe to remove or
      replace per project.
    -->
    <footer class="border-t">
      <div class="mx-auto flex max-w-5xl items-center justify-center gap-2 px-4 py-6 text-xs text-muted-foreground">
        <span>{{ t('footer.poweredBy') }}</span>
        <a
          href="https://www.golem15.com"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center opacity-60 transition-opacity hover:opacity-100"
          aria-label="Golem15 Stack"
        >
          <img src="/brand/golem15.svg" alt="Golem15" class="h-4 w-auto" width="150" height="16" >
        </a>
      </div>
    </footer>

    <!-- Global toast outlet (vue-sonner via shadcn). -->
    <Toaster />
  </div>
</template>
