<script setup lang="ts">
/**
 * Public landing page `/` (D-05).
 *
 * Selects the public layout and opts OUT of the auth middleware, so it is
 * reachable unauthenticated (SC-1). A logged-in visitor is redirected to
 * /dashboard via an early-return navigateTo (D-03) — NOT a watcher (Pitfall 3),
 * which avoids a landing flash / redirect loop.
 *
 * STATIC content only: ZERO Inventory API reads (T-09-09 — public pages must not
 * leak authed data). All copy via t() interpolation, never raw HTML (T-09-10).
 * Semantic tokens only, no hex; type scale is the approved 4-size set only.
 */
import { Search, Boxes, Sparkles, Users } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'public' })

const { t } = useI18n()
const auth = useAuthStore()

// Logged-in visitors belong on the dashboard (D-03). Early-return redirect.
if (auth.isLoggedIn) {
  await navigateTo('/dashboard')
}

// Feature highlights — kraft-amber chip icons (bg-accent), 4-card grid.
const features = [
  { key: 'search', icon: Search },
  { key: 'hierarchy', icon: Boxes },
  { key: 'ai', icon: Sparkles },
  { key: 'sharing', icon: Users },
] as const

useSeoMeta({
  title: () => t('public.landing.hero.title'),
  description: () => t('public.landing.hero.subhead'),
})
</script>

<template>
  <div class="space-y-16">
    <!-- Hero — the single display-size focal point. -->
    <section class="space-y-6 py-16 text-center">
      <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl font-display">
        {{ t('public.landing.hero.title') }}
      </h1>
      <p class="mx-auto max-w-2xl text-base text-muted-foreground">
        {{ t('public.landing.hero.subhead') }}
      </p>
      <div>
        <NuxtLink to="/login">
          <Button class="min-h-11">{{ t('public.landing.hero.cta') }}</Button>
        </NuxtLink>
      </div>
    </section>

    <!-- Feature highlights — 4 cards, kraft-amber icon chips. -->
    <section class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        v-for="feature in features"
        :key="feature.key"
        class="space-y-2 border bg-card p-4"
      >
        <div class="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <component :is="feature.icon" class="size-5" />
        </div>
        <h2 class="text-base font-semibold">
          {{ t(`public.landing.features.${feature.key}.title`) }}
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ t(`public.landing.features.${feature.key}.body`) }}
        </p>
      </Card>
    </section>
  </div>
</template>
