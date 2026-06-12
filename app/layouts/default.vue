<script setup lang="ts">
import { ref } from 'vue'
import { Menu, Search } from '@lucide/vue'
import { Toaster } from '~/components/ui/sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '~/components/ui/sheet'

// Locale switcher. @nuxtjs/i18n writes the `i18n_locale` cookie
// (detectBrowserLanguage.useCookie) when `setLocale` is called.
const { locale, locales, setLocale, t } = useI18n()

// Auth store — surface the existing logout action (do NOT reimplement auth).
const auth = useAuthStore()

// Top-bar search on-ramp (D-02) — visible everywhere EXCEPT /search, where the
// page hosts its own live debounced query box (a second box there is redundant
// and confusing: this on-ramp navigates on Enter, it does not live-search). The
// typed query is handed to router.push as a structured `query: { q }` object
// (Nuxt encodes it); never concatenated into a URL string (T-06-09).
const router = useRouter()
const route = useRoute()
const topbarQ = ref('')
const showTopbarSearch = computed(() => route.path !== '/search')

function goSearch() {
  router.push({ path: '/search', query: topbarQ.value ? { q: topbarQ.value } : {} })
}

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
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:gap-4">
        <!-- App name — always visible. Points at /dashboard (the authed home);
             `/` is now the public landing. -->
        <NuxtLink to="/dashboard" class="shrink-0 font-semibold">Inventory</NuxtLink>

        <!-- Top-bar search on-ramp (D-02) — visible everywhere except /search,
             where the page hosts its own live debounced box. The flex-1 wrapper
             is ALWAYS rendered (stable hydration: no v-if/v-else sibling pairing,
             no interleaved comment node) so chrome stays right-aligned and the
             server/client vnode shape never diverges. -->
        <div class="min-w-0 flex-1 sm:max-w-sm">
          <form v-if="showTopbarSearch" @submit.prevent="goSearch">
            <div class="relative">
              <Search class="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="topbarQ"
                :placeholder="t('inventory.search.placeholder')"
                :aria-label="t('inventory.search.label')"
                class="min-h-11 pl-8"
                data-testid="topbar-search-input"
              />
            </div>
          </form>
        </div>

        <!-- Desktop chrome — inline only at lg: and above (D-10). -->
        <div class="hidden items-center gap-3 text-sm lg:flex">
          <!-- Categories — neutral chrome (ghost), never accent-filled (D-03). -->
          <NuxtLink to="/categories" class="text-muted-foreground hover:text-foreground">
            {{ t('inventory.nav.categories') }}
          </NuxtLink>

          <!-- Settings (Integrations / API tokens) — neutral chrome (D-03). -->
          <NuxtLink to="/settings" class="text-muted-foreground hover:text-foreground">
            {{ t('inventory.nav.settings') }}
          </NuxtLink>

          <!-- Logout — surfaces the existing auth store action (no reimplement). -->
          <Button variant="ghost" size="sm" @click="onLogout">
            {{ t('inventory.nav.logout') }}
          </Button>

          <!-- Locale switcher (writes the i18n_locale cookie). -->
          <select
            :value="locale"
            aria-label="Language"
            class="min-h-11 rounded-md border bg-background px-2 py-1 text-sm"
            @change="onLocaleChange"
          >
            <option v-for="l in availableLocales" :key="l.code" :value="l.code">
              {{ l.name }}
            </option>
          </select>
        </div>

        <!-- Phone chrome — hamburger → right-side sheet below lg: (D-10).
             Relocates the SAME Categories/logout/locale controls; no new data. -->
        <Sheet>
          <SheetTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-11 shrink-0 lg:hidden"
              data-testid="nav-menu"
              :aria-label="t('inventory.nav.menu')"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" class="w-72">
            <nav class="mt-6 flex flex-col gap-2 text-sm">
              <SheetClose as-child>
                <NuxtLink
                  to="/categories"
                  class="flex min-h-11 items-center rounded-md px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {{ t('inventory.nav.categories') }}
                </NuxtLink>
              </SheetClose>

              <SheetClose as-child>
                <NuxtLink
                  to="/settings"
                  class="flex min-h-11 items-center rounded-md px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {{ t('inventory.nav.settings') }}
                </NuxtLink>
              </SheetClose>

              <Button
                variant="ghost"
                class="min-h-11 justify-start px-3 text-muted-foreground hover:text-foreground"
                @click="onLogout"
              >
                {{ t('inventory.nav.logout') }}
              </Button>

              <select
                :value="locale"
                aria-label="Language"
                class="min-h-11 rounded-md border bg-background px-3 text-sm"
                @change="onLocaleChange"
              >
                <option v-for="l in availableLocales" :key="l.code" :value="l.code">
                  {{ l.name }}
                </option>
              </select>
            </nav>
          </SheetContent>
        </Sheet>
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
        <span class="inline-flex items-center gap-2 opacity-80">
          <img src="/brand/logo.png" alt="whereiput.it" class="h-5 w-auto" width="20" height="20" >
          <span class="font-semibold tracking-tight">whereiput.it</span>
        </span>
      </div>
    </footer>

    <!-- Global toast outlet (vue-sonner via shadcn). -->
    <Toaster />
  </div>
</template>
