<script setup lang="ts">
import { Button } from '~/components/ui/button'

/**
 * Demo home (D-11) — the starter's gut. Wires every integration visibly:
 *   - auth state (login/logout) from the Pinia auth store (17-02)
 *   - realtime status badge + a live-event feed from useCentrifugo (this plan)
 *   - i18n via useI18n() (the locale switcher lives in the default layout)
 *
 * NOTE: minimal placeholder dashboard — Plan 05-05 rewrites this into the real
 * Inventory dashboard (totals strip, Area cards, Recent items). The blog demo
 * link was removed when the blog scaffold was stripped (Plan 05-02).
 *
 * Realtime is gated on `centrifugoWsUrl`: when it is unset the composable warns
 * and no-ops (graceful-degrade), and this page surfaces an honest "realtime not
 * configured" note instead of a perpetually-disconnected badge. So the demo is
 * truthful — and the app boots green — without a running Centrifugo.
 */
const { t } = useI18n()
const auth = useAuthStore()
const { isConnected, connect, onEvent } = useCentrifugo()

// True when realtime is actually wired (WS URL present). Drives the
// connect-vs-degrade-note branch so the demo never lies about its state.
const realtimeConfigured = computed(
  () => !!(useRuntimeConfig().public.centrifugoWsUrl as string),
)

// Live event feed — newest first. Fed by the composable's publication hook.
const events = ref<Array<{ at: string, data: Record<string, unknown> }>>([])
onEvent((data) => {
  events.value.unshift({ at: new Date().toLocaleTimeString(), data })
})

// Connect client-side on mount. connect() is itself SSR-/auth-/WS-guarded and
// idempotent (module singleton), so this is safe to call unconditionally.
onMounted(() => {
  connect()
})

async function onLogout() {
  await auth.logout()
}

useSeoMeta({
  title: () => t('demo.welcome'),
})
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight">
        {{ t('demo.welcome') }}
      </h1>
      <p class="text-muted-foreground">
        Headless WinterCMS Nuxt 4 starter — auth, realtime, i18n, SEO and blog
        wiring assembled on a single opinionated baseline.
      </p>
    </header>

    <!-- Auth state (17-02 auth store) -->
    <div class="rounded-lg border p-4 space-y-3">
      <h2 class="text-sm font-medium text-muted-foreground">
        {{ t('demo.authState') }}
      </h2>
      <div v-if="auth.isLoggedIn" class="flex items-center gap-3">
        <span data-testid="auth-status">
          {{ t('demo.loggedInAs', { email: auth.user?.email ?? auth.user?.id }) }}
        </span>
        <Button variant="outline" size="sm" @click="onLogout">
          {{ t('demo.logout') }}
        </Button>
      </div>
      <div v-else class="flex items-center gap-3">
        <span data-testid="auth-status">{{ t('demo.loggedOut') }}</span>
        <NuxtLink to="/login" class="text-sm underline">
          {{ t('nav.login') }}
        </NuxtLink>
      </div>
    </div>

    <!-- Realtime demo (this plan — useCentrifugo) -->
    <div class="rounded-lg border p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-muted-foreground">
          {{ t('demo.realtime') }}
        </h2>
        <!-- Status badge bound to isConnected -->
        <span
          data-testid="realtime-status"
          class="rounded-full px-2 py-0.5 text-xs font-medium"
          :class="isConnected
            ? 'bg-green-100 text-green-800'
            : 'bg-zinc-100 text-zinc-600'"
        >
          {{ isConnected ? t('demo.connected') : t('demo.disconnected') }}
        </span>
      </div>

      <!-- Graceful-degrade note — mirrors the composable's no-op when WS unset. -->
      <p
        v-if="!realtimeConfigured"
        data-testid="realtime-degraded"
        class="text-sm text-muted-foreground"
      >
        {{ t('demo.realtimeOff') }}
      </p>

      <!-- Live event feed (onEvent → events) -->
      <ul v-else-if="events.length" class="space-y-1 text-sm">
        <li
          v-for="(evt, i) in events"
          :key="i"
          class="flex gap-2 font-mono text-xs"
        >
          <span class="text-muted-foreground">{{ evt.at }}</span>
          <span class="truncate">{{ JSON.stringify(evt.data) }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted-foreground">
        {{ t('demo.noEvents') }}
      </p>
    </div>
  </section>
</template>
