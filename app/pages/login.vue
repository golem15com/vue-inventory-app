<script setup lang="ts">
/**
 * Sign-in page. Public (unauthenticated) — uses the `public` layout so a
 * logged-out visitor never sees the authed top-bar chrome (search, avatar).
 * Wires the shadcn Input + Button to the auth store's login() action.
 *
 * SECURITY: never render or log the JWT. The token lives only in the
 * auth_token cookie (set by the store, 30-day persistence). This page reads
 * isLoggedIn / error / fieldErrors, never the token itself.
 */
import { ref, reactive } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useAuthStore } from '~/stores/auth'
import { useInventoryStore } from '~/stores/inventory'

definePageMeta({ layout: 'public' })

const { t } = useI18n()
const authStore = useAuthStore()
const store = useInventoryStore()
const route = useRoute()

// First-run gate (D-10): if no frontend user exists yet, there is nothing to log
// in to — send the visitor to the owner onboarding card instead. The landing
// page redirects here too; this guard also catches a direct /login deep-link on a
// fresh deploy. The server's onboarding/status is the boundary; /onboarding
// self-redirects back to /login the moment any user exists.
if (!authStore.isLoggedIn) {
  const { data: needsOnboarding } = await useAsyncData('inv:onboarding-status', () =>
    store.fetchOnboardingStatus(),
  )
  if (needsOnboarding.value === true) {
    await navigateTo('/onboarding')
  }
}

const form = reactive({
  email: '',
  password: '',
})

const submitting = ref(false)

async function onSubmit() {
  submitting.value = true
  await authStore.login({ email: form.email, password: form.password })
  submitting.value = false

  if (authStore.isLoggedIn) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await navigateTo(redirect)
    return
  }

  if (authStore.error) {
    toast.error(authStore.error)
  }
}
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center py-12">
    <div class="w-full max-w-sm">
      <!-- Brand focal — the whereiput.it mark anchors the sign-in. -->
      <div class="mb-8 flex flex-col items-center gap-3 text-center">
        <img
          src="/brand/logo.png"
          alt="whereiput.it"
          class="h-14 w-auto"
          width="56"
          height="56"
        >
        <div class="space-y-1">
          <h1 class="text-base font-semibold tracking-tight">{{ t('auth.heading') }}</h1>
          <p class="text-sm text-muted-foreground">{{ t('auth.subtitle') }}</p>
        </div>
      </div>

      <!-- Sign-in card -->
      <div class="rounded-none border bg-card p-6 shadow-sm">
        <form class="space-y-5" @submit.prevent="onSubmit">
          <div class="space-y-1.5">
            <label for="email" class="text-sm font-medium">{{ t('auth.emailLabel') }}</label>
            <Input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              required
              :placeholder="t('auth.emailPlaceholder')"
              class="min-h-11"
            />
            <p v-if="authStore.fieldErrors.email?.length" class="text-sm text-destructive">
              {{ authStore.fieldErrors.email[0] }}
            </p>
          </div>

          <div class="space-y-1.5">
            <label for="password" class="text-sm font-medium">{{ t('auth.passwordLabel') }}</label>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
              placeholder="••••••••"
              class="min-h-11"
            />
            <p v-if="authStore.fieldErrors.password?.length" class="text-sm text-destructive">
              {{ authStore.fieldErrors.password[0] }}
            </p>
          </div>

          <p v-if="authStore.error" class="text-sm text-destructive" role="alert">
            {{ authStore.error }}
          </p>

          <Button type="submit" class="min-h-11 w-full" :disabled="submitting || authStore.isLoading">
            {{ submitting || authStore.isLoading ? t('auth.submitting') : t('auth.submit') }}
          </Button>
        </form>
      </div>

      <!-- Accounts are admin-provisioned (no public self-signup, D-06). -->
      <p class="mt-6 text-center text-sm text-muted-foreground">
        {{ t('auth.noAccount') }}
      </p>
    </div>
  </div>
</template>
