<script setup lang="ts">
/**
 * Public (unauthenticated) layout (D-04 / D-07).
 *
 * Mirrors default.vue's shell (outer flex column, bordered header/footer, the
 * max-w-5xl reading container, the locale switcher) but strips ALL authed chrome:
 * no top-bar search, no Categories/Settings/logout nav, no hamburger sheet, no
 * Golem15 "powered by" badge. Public pages select it via
 * `definePageMeta({ layout: 'public' })` and opt OUT of the auth middleware, so
 * they stay reachable unauthenticated (SC-1 / SC-2).
 *
 * Header: whereiput.it mark + wordmark (left) · locale switcher + Log in CTA (right).
 * Footer: Privacy / Terms / Help links + © {year} whereiput.it.
 * Semantic tokens only — no hex (D-20).
 */
import { Button } from '~/components/ui/button'

// Locale switcher — reuse the EXACT pattern from default.vue (writes the
// i18n_locale cookie via setLocale; public copy is localized en + pl, D-10).
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
  <div class="flex min-h-screen flex-col bg-background text-foreground font-body">
    <header class="border-b">
      <div class="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4">
        <!-- Brand lockup — mark + lowercase wordmark, paired with gap-2 (D-21). -->
        <NuxtLink to="/" class="flex shrink-0 items-center gap-2">
          <img
            src="/brand/logo.png"
            :alt="t('public.header.brandAlt')"
            class="h-7 w-auto"
            width="28"
            height="28"
          >
          <span class="text-base font-semibold tracking-tight">whereiput.it</span>
        </NuxtLink>

        <div class="ml-auto flex items-center gap-4">
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

          <!-- Log in — the single public CTA, --primary filled (UI-SPEC §Color). -->
          <NuxtLink to="/login">
            <Button class="min-h-11">{{ t('public.header.login') }}</Button>
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <slot />
    </main>

    <footer class="border-t">
      <div class="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <nav class="flex gap-4">
          <NuxtLink to="/privacy" class="flex min-h-11 items-center hover:text-foreground">
            {{ t('public.footer.privacy') }}
          </NuxtLink>
          <NuxtLink to="/terms" class="flex min-h-11 items-center hover:text-foreground">
            {{ t('public.footer.terms') }}
          </NuxtLink>
          <NuxtLink to="/help" class="flex min-h-11 items-center hover:text-foreground">
            {{ t('public.footer.help') }}
          </NuxtLink>
        </nav>
        <span>© {{ new Date().getFullYear() }} whereiput.it</span>
      </div>
    </footer>
  </div>
</template>
