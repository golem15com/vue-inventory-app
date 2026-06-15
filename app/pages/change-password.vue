<script setup lang="ts">
/**
 * Forced change-password screen (Phase 12).
 *
 * Where an admin provisioned the account with a temporary password, the user is
 * routed here by the global `force-password-change` guard and cannot reach the
 * app until they set their own password. Confirms the current (temporary) one,
 * sets a new one, and the backend clears `must_change_password` — releasing the
 * guard. Uses the `public` layout so the authed top-bar chrome stays hidden while
 * the account is still gated.
 *
 * SECURITY: never render or log the JWT/passwords beyond the bound inputs. The
 * backend POST /change-password verifies the current password and is the real
 * state change; this page is the UX surface.
 */
import { ref, reactive } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'public' })

const { t } = useI18n()
const authStore = useAuthStore()

// A logged-out visitor has nothing to change — send them to login.
if (!authStore.isLoggedIn) {
  await navigateTo('/login')
}

const form = reactive({
  current_password: '',
  password: '',
  password_confirmation: '',
})

const submitting = ref(false)

async function onSubmit() {
  submitting.value = true
  const ok = await authStore.changePassword({
    current_password: form.current_password,
    password: form.password,
    password_confirmation: form.password_confirmation,
  })
  submitting.value = false

  if (ok) {
    toast.success(t('auth.changePassword.success'))
    // The flag is now cleared (store applied the refreshed user) — proceed.
    await navigateTo('/dashboard')
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
      <div class="mb-8 flex flex-col items-center gap-3 text-center">
        <img
          src="/brand/logo.png"
          alt="whereiput.it"
          class="h-14 w-auto"
          width="56"
          height="56"
        >
        <div class="space-y-1">
          <h1 class="text-base font-semibold tracking-tight">{{ t('auth.changePassword.heading') }}</h1>
          <p class="text-sm text-muted-foreground">{{ t('auth.changePassword.subtitle') }}</p>
        </div>
      </div>

      <div class="rounded-none border bg-card p-6 shadow-sm">
        <form class="space-y-5" @submit.prevent="onSubmit">
          <div class="space-y-1.5">
            <label for="current_password" class="text-sm font-medium">{{ t('auth.changePassword.currentLabel') }}</label>
            <Input
              id="current_password"
              v-model="form.current_password"
              type="password"
              autocomplete="current-password"
              required
              class="min-h-11"
              data-testid="current-password"
            />
            <p v-if="authStore.fieldErrors.current_password?.length" class="text-sm text-destructive">
              {{ authStore.fieldErrors.current_password[0] }}
            </p>
          </div>

          <div class="space-y-1.5">
            <label for="password" class="text-sm font-medium">{{ t('auth.changePassword.newLabel') }}</label>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              required
              class="min-h-11"
              data-testid="new-password"
            />
            <p v-if="authStore.fieldErrors.password?.length" class="text-sm text-destructive">
              {{ authStore.fieldErrors.password[0] }}
            </p>
          </div>

          <div class="space-y-1.5">
            <label for="password_confirmation" class="text-sm font-medium">{{ t('auth.changePassword.confirmLabel') }}</label>
            <Input
              id="password_confirmation"
              v-model="form.password_confirmation"
              type="password"
              autocomplete="new-password"
              required
              class="min-h-11"
              data-testid="confirm-password"
            />
          </div>

          <p v-if="authStore.error" class="text-sm text-destructive" role="alert">
            {{ authStore.error }}
          </p>

          <Button type="submit" class="min-h-11 w-full" :disabled="submitting || authStore.isLoading" data-testid="change-password-submit">
            {{ submitting || authStore.isLoading ? t('auth.changePassword.submitting') : t('auth.changePassword.submit') }}
          </Button>
        </form>
      </div>
    </div>
  </div>
</template>
