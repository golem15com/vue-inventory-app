/**
 * PWA Composable (install-only)
 *
 * Wraps @vite-pwa/nuxt's $pwa for a minimal install affordance. Trimmed to what
 * an install-only prompt needs — registerType:'autoUpdate' means new service
 * worker versions activate on next navigation, so there is NO update prompt and
 * none of queststream's needRefresh/offlineReady/updateServiceWorker plumbing.
 *
 * The $pwa object from @vite-pwa/nuxt provides:
 * - isInstalled: ref<boolean>      - true when already installed
 * - isPWAInstalled: ref<boolean>   - true when running as PWA
 * - showInstallPrompt: ref<boolean>- true when the browser can show the prompt
 *                                    (set after the 'beforeinstallprompt' event)
 * - install(): Promise<{ outcome }> - triggers the browser install prompt
 * - cancelInstall(): void           - dismisses and persists dismissal
 *
 * All window/navigator access is guarded by import.meta.client (SSR-safe).
 */

export const usePwa = () => {
  const { $pwa } = useNuxtApp()

  // Local reactive state mirrors.
  const canInstall = ref(false)

  // Platform detection.
  const isIos = ref(false)
  const isInstalled = ref(false)

  /**
   * Detect standalone (already-installed) mode + iOS (no beforeinstallprompt).
   */
  function checkInstallState() {
    if (import.meta.client) {
      const standaloneMedia = window.matchMedia('(display-mode: standalone)')
      isInstalled.value =
        standaloneMedia.matches || (window.navigator as any).standalone === true

      isIos.value =
        /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    }
  }

  /**
   * Trigger the native install prompt (Android/Chrome).
   * Returns the user's choice, or undefined when unavailable.
   */
  async function installApp(): Promise<
    { outcome: 'accepted' | 'dismissed' } | undefined
  > {
    if ($pwa?.install) {
      return await $pwa.install()
    }
    return undefined
  }

  /**
   * Cancel/dismiss the install prompt (persists the browser-side dismissal).
   */
  function cancelInstall() {
    if ($pwa?.cancelInstall) {
      $pwa.cancelInstall()
    }
  }

  // Initialize on the client and wire the $pwa reactive watchers.
  onMounted(() => {
    checkInstallState()

    if ($pwa) {
      // showInstallPrompt flips true after 'beforeinstallprompt' fires.
      watch(
        () => $pwa.showInstallPrompt,
        (available) => {
          canInstall.value = available && !isIos.value
        },
        { immediate: true },
      )

      // Reflect an already-installed app.
      watch(
        () => $pwa.isInstalled || $pwa.isPWAInstalled,
        (installed) => {
          if (installed) {
            isInstalled.value = true
          }
        },
        { immediate: true },
      )
    }
  })

  return {
    // State (readonly).
    canInstall: readonly(canInstall),
    isInstalled: readonly(isInstalled),
    isIos: readonly(isIos),

    // Actions.
    installApp,
    cancelInstall,
    checkInstallState,
  }
}
