<script setup lang="ts">
/**
 * PWA Install Prompt
 *
 * Minimal, dismissible bottom-anchored affordance. Shows a native install
 * button for Android/Chrome, or Add-to-Home-Screen instructions for iOS Safari
 * (which has no beforeinstallprompt). Hidden when already installed or when not
 * installable, and remembers a manual dismissal for 7 days (localStorage).
 *
 * shadcn Card/Button + semantic tokens only (no hex / gray literals); all copy
 * comes from i18n (pwa.install.*).
 */
import { Card } from '~/components/ui/card'
import { Button } from '~/components/ui/button'

const { t } = useI18n()
const { canInstall, isIos, isInstalled, installApp, cancelInstall } = usePwa()

// Dismissal state with localStorage persistence (client-guarded).
const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

const dismissed = ref(true) // Start hidden; resolve real state on mount.

function isDismissed(): boolean {
  if (!import.meta.client) return true
  const dismissedAt = localStorage.getItem(DISMISS_KEY)
  if (!dismissedAt) return false
  const dismissedTime = parseInt(dismissedAt, 10)
  return Date.now() - dismissedTime < DISMISS_DURATION
}

function dismiss() {
  if (import.meta.client) {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }
  dismissed.value = true
  cancelInstall()
}

async function handleInstall() {
  const result = await installApp()
  if (result?.outcome === 'accepted') {
    dismissed.value = true
  }
}

// Show only when installable (Android/Chrome) or on iOS, and not yet
// installed/dismissed.
const showPrompt = computed(() => {
  if (isInstalled.value) return false
  if (dismissed.value) return false
  return canInstall.value || isIos.value
})

onMounted(() => {
  dismissed.value = isDismissed()
})
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="showPrompt"
      class="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-4 md:max-w-sm"
    >
      <Card class="gap-3 p-4 shadow-xl">
        <!-- Android/Chrome install -->
        <template v-if="canInstall && !isIos">
          <div>
            <h3 class="text-base font-semibold text-card-foreground">
              {{ t('pwa.install.title') }}
            </h3>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t('pwa.install.androidBody') }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              variant="ghost"
              class="flex-1"
              type="button"
              @click="dismiss"
            >
              {{ t('pwa.install.notNow') }}
            </Button>
            <Button
              class="flex-1"
              type="button"
              @click="handleInstall"
            >
              {{ t('pwa.install.installCta') }}
            </Button>
          </div>
        </template>

        <!-- iOS Safari — Add to Home Screen instructions -->
        <template v-else-if="isIos">
          <div>
            <h3 class="text-base font-semibold text-card-foreground">
              {{ t('pwa.install.iosTitle') }}
            </h3>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t('pwa.install.iosBody') }}
            </p>
            <ol
              class="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground"
            >
              <li>{{ t('pwa.install.iosStep1') }}</li>
              <li>{{ t('pwa.install.iosStep2') }}</li>
            </ol>
          </div>
          <Button
            class="w-full"
            type="button"
            @click="dismiss"
          >
            {{ t('pwa.install.gotIt') }}
          </Button>
        </template>
      </Card>
    </div>
  </Transition>
</template>
