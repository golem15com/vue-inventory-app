<script setup lang="ts">
/**
 * First-run site-owner onboarding (Phase 12, D-10). Public (unauthenticated) —
 * uses the `public` layout, mirroring login.vue's centered max-w-sm card on a
 * py-12 viewport. Reachable ONLY on a zero-user deployment: on mount the page
 * asks the server's onboarding/status gate and redirects to /login the moment
 * any frontend user exists (onboarding disappears, D-10).
 *
 * Submitting creates the first owner + organisation #1 via the PUBLIC
 * onboarding/bootstrap endpoint (no auth header). On success the store persists
 * the returned session token (the same path login uses) and we land on
 * /organisation. The replay-safe 409 + zero-user gate are enforced server-side
 * (Plan 05) — this page's status check is convenience only.
 *
 * SECURITY: never render or log the JWT or the password. The token lives only in
 * the auth_token cookie (set by the store). The password is sent in the bootstrap
 * body and never echoed back.
 */
import { ref, reactive } from 'vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useInventoryStore } from '~/stores/inventory'

definePageMeta({ layout: 'public' })

const { t } = useI18n()
const store = useInventoryStore()

const form = reactive({
  org_name: '',
  email: '',
  password: '',
})

const submitting = ref(false)
const errorMessage = ref<string | null>(null)

// Gate (D-10): only show the onboarding card on a zero-user deploy. The server
// is the real boundary (409 on replay) — this is the convenience redirect so an
// already-provisioned deployment never lingers on the first-run screen.
const { data: needsOnboarding } = await useAsyncData('inv:onboarding-status', () =>
  store.fetchOnboardingStatus(),
)
if (needsOnboarding.value === false) {
  await navigateTo('/login')
}

/** Pull the verbatim server message off an ofetch error envelope (D-08). */
function serverMessage(err: unknown): string {
  const e = err as { data?: { error?: unknown, message?: string } }
  const errField = e?.data?.error
  return (typeof errField === 'string' ? errField : null)
    ?? e?.data?.message
    ?? ''
}

async function onSubmit() {
  submitting.value = true
  errorMessage.value = null
  try {
    await store.bootstrapOnboarding({
      org_name: form.org_name,
      email: form.email,
      password: form.password,
    })
    await navigateTo('/organisation')
  }
  catch (err: unknown) {
    errorMessage.value = t('inventory.onboarding.error', { message: serverMessage(err) })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center py-12">
    <div class="w-full max-w-sm">
      <!-- Brand focal — the whereiput.it mark anchors the first run. -->
      <div class="mb-8 flex flex-col items-center gap-3 text-center">
        <img
          src="/brand/logo.png"
          alt="whereiput.it"
          class="h-14 w-auto"
          width="56"
          height="56"
        >
        <div class="space-y-1">
          <h1 class="text-base font-semibold tracking-tight">{{ t('inventory.onboarding.heading') }}</h1>
          <p class="text-sm text-muted-foreground">{{ t('inventory.onboarding.body') }}</p>
        </div>
      </div>

      <!-- Onboarding card -->
      <div class="rounded-none border bg-card p-6 shadow-sm">
        <form class="space-y-5" @submit.prevent="onSubmit">
          <div class="space-y-1.5">
            <label for="org_name" class="text-sm">{{ t('inventory.onboarding.orgNameLabel') }}</label>
            <Input
              id="org_name"
              v-model="form.org_name"
              type="text"
              required
              :placeholder="t('inventory.onboarding.orgNamePlaceholder')"
              class="min-h-11"
              data-testid="onboarding-org-name"
            />
          </div>

          <div class="space-y-1.5">
            <label for="email" class="text-sm">{{ t('inventory.onboarding.emailLabel') }}</label>
            <Input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              required
              class="min-h-11"
              data-testid="onboarding-email"
            />
          </div>

          <div class="space-y-1.5">
            <label for="password" class="text-sm">{{ t('inventory.onboarding.passwordLabel') }}</label>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              required
              placeholder="••••••••"
              class="min-h-11"
              data-testid="onboarding-password"
            />
          </div>

          <p v-if="errorMessage" class="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            {{ errorMessage }}
          </p>

          <Button
            type="submit"
            class="min-h-11 w-full"
            :disabled="submitting || store.isLoading"
            data-testid="onboarding-submit"
          >
            {{ submitting || store.isLoading ? t('inventory.onboarding.submitting') : t('inventory.onboarding.submit') }}
          </Button>
        </form>
      </div>
    </div>
  </div>
</template>
