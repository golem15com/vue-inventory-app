<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Menu, Search, CircleUser } from '@lucide/vue'
import { Toaster } from '~/components/ui/sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '~/components/ui/sheet'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import LanguageSwitcher from '~/components/common/LanguageSwitcher.vue'
import PwaInstallPrompt from '~/components/pwa/PwaInstallPrompt.vue'

const { t } = useI18n()

// Auth store — surface the existing logout action + the user for avatar initials
// (do NOT reimplement auth).
const auth = useAuthStore()

// Avatar initials from the user's first/last name (falls back to a CircleUser
// icon when neither is set). E.g. "Jakub Zych" → "JZ". Whitespace-only or empty
// names yield no initials so the icon shows instead.
const initials = computed(() => {
  const u = auth.user
  if (!u) return ''
  const first = (u.first_name ?? '').trim()
  const last = (u.last_name ?? '').trim()
  const joined = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  return joined.trim()
})

// Top-bar search on-ramp (D-02) — visible everywhere EXCEPT /search, where the
// page hosts its own live debounced query box (a second box there is redundant
// and confusing: this on-ramp navigates on Enter, it does not live-search). The
// typed query is handed to router.push as a structured `query: { q }` object
// (Nuxt encodes it); never concatenated into a URL string (T-06-09).
const router = useRouter()
const route = useRoute()
const topbarQ = ref('')
const showTopbarSearch = computed(() => route.path !== '/search' && route.path !== '/dashboard')

// One reading column for the whole app shell — every page renders at max-w-5xl so
// container width is consistent across dashboard, search, areas, locations, items
// (view/new/edit) and settings. Wide content (e.g. the item view/form) lays out in
// a multi-column grid INSIDE this column rather than widening the shell.
const mainWidth = 'max-w-5xl'

// Responsive top-bar placeholder — the narrow mobile input truncates the full
// "Search your things…" to "Search your th…", so use a short "Search…" below lg.
// Defaults to the short form during SSR + first client paint (mobile-first) so
// there is no hydration mismatch; widens to the full text after mount on lg+.
const isLgViewport = ref(false)
onMounted(() => {
  const mq = window.matchMedia('(min-width: 1024px)')
  isLgViewport.value = mq.matches
  mq.addEventListener('change', (e) => { isLgViewport.value = e.matches })
})
const searchPlaceholder = computed(() =>
  isLgViewport.value
    ? t('inventory.search.placeholder')
    : t('inventory.search.placeholderShort'),
)

// Avatar Popover open state (desktop). Closes on a menu selection.
const accountOpen = ref(false)

function goSearch() {
  router.push({ path: '/search', query: topbarQ.value ? { q: topbarQ.value } : {} })
}

async function onLogout() {
  accountOpen.value = false
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground font-body">
    <!-- Authed top-bar aligned to the same max-w-5xl px-4 reading column as
         <main> and the footer — brand lines up with the content's left edge,
         the avatar menu (ml-auto) with its right edge. -->
    <header class="border-b">
      <div class="mx-auto flex w-full items-center gap-4 px-4 py-3" :class="mainWidth">
        <!-- Brand lockup — mark + lowercase wordmark, paired with gap-2 (mirrors
             the public header so authed pages never degrade to a bare wordmark).
             Points at /dashboard (the authed home); `/` is the public landing. -->
        <NuxtLink to="/dashboard" class="flex shrink-0 items-center gap-2">
          <img
            src="/brand/logo.png"
            alt="whereiput.it"
            class="h-7 w-auto"
            width="28"
            height="28"
          >
          <span class="text-base font-semibold tracking-tight">whereiput.it</span>
        </NuxtLink>

        <!-- Top-bar search on-ramp (D-02) — visible everywhere except /search,
             where the page hosts its own live debounced box. The flex-1 wrapper
             is ALWAYS rendered (stable hydration: no v-if/v-else sibling pairing,
             no interleaved comment node) so chrome stays right-aligned and the
             server/client vnode shape never diverges. -->
        <div class="min-w-0 w-full max-w-sm">
          <form v-if="showTopbarSearch" @submit.prevent="goSearch">
            <div class="relative">
              <Search class="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="topbarQ"
                :placeholder="searchPlaceholder"
                :aria-label="t('inventory.search.label')"
                class="min-h-11 pl-8"
                data-testid="topbar-search-input"
              />
            </div>
          </form>
        </div>

        <!-- Desktop chrome — inline only at lg: and above (D-10). Pinned to the
             far right via ml-auto so the avatar menu reaches the screen edge. -->
        <div class="ml-auto hidden items-center gap-2 text-sm lg:flex">
          <!-- Categories — top-level neutral chrome (ghost), never accent-filled (D-03). -->
          <NuxtLink to="/categories" class="px-2 text-muted-foreground hover:text-foreground">
            {{ t('inventory.nav.categories') }}
          </NuxtLink>

          <!-- Reusable language switcher popover (writes the i18n_locale cookie). -->
          <LanguageSwitcher />

          <!-- User avatar menu — initials (or CircleUser icon) opening a Popover
               with Settings + Logout. Neutral chrome; semantic tokens only. -->
          <Popover v-model:open="accountOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                :aria-label="t('inventory.nav.account')"
                class="inline-flex size-11 items-center justify-center rounded-none border bg-muted text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span v-if="initials">{{ initials }}</span>
                <CircleUser v-else class="size-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-48 p-1">
              <NuxtLink
                to="/settings"
                class="flex min-h-11 items-center rounded-md px-3 text-sm text-foreground transition-colors hover:bg-muted"
                @click="accountOpen = false"
              >
                {{ t('inventory.nav.settings') }}
              </NuxtLink>
              <button
                type="button"
                class="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-foreground transition-colors hover:bg-muted"
                @click="onLogout"
              >
                {{ t('inventory.nav.logout') }}
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <!-- Phone chrome — hamburger → right-side sheet below lg: (D-10).
             Relocates the SAME Categories / language / account controls. -->
        <Sheet>
          <SheetTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="ml-auto size-11 shrink-0 lg:hidden"
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

              <!-- Language switcher (same reusable popover as desktop). -->
              <div class="px-1">
                <LanguageSwitcher />
              </div>

              <!-- Account group — Settings + Logout. -->
              <p class="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {{ t('inventory.nav.account') }}
              </p>
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
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>

    <main class="mx-auto w-full flex-1 px-4 py-8" :class="mainWidth">
      <slot />
    </main>

    <!--
      Maker attribution. Intentionally subtle — the header/main are the primary
      brand space; this footer marks who built it without competing with the page
      content. Semantic tokens only.
    -->
    <footer class="border-t">
      <div class="mx-auto flex max-w-5xl items-center justify-center gap-1 px-4 py-6 text-xs text-muted-foreground">
        <span>{{ t('footer.madeBy') }}</span>
        <a
          href="https://www.golem15.com"
          target="_blank"
          rel="noopener noreferrer"
          class="font-semibold tracking-tight hover:text-foreground"
        >
          Golem15
        </a>
      </div>
    </footer>

    <!-- PWA install affordance — floating overlay, hidden unless installable. -->
    <PwaInstallPrompt />

    <!-- Global toast outlet (vue-sonner via shadcn). -->
    <Toaster />
  </div>
</template>
