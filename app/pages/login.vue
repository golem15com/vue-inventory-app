<script setup lang="ts">
/**
 * Demo login page (D-11) — wires the shadcn Input + Button to the auth store's
 * login() action. Clients gut the markup; keep the wiring.
 *
 * SECURITY: never render or log the JWT. The token lives only in the
 * auth_token cookie (set by the store) — this page reads isLoggedIn/error/
 * fieldErrors, never the token itself.
 */
import { ref, reactive } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()

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
  <div class="mx-auto max-w-sm py-12">
    <h1 class="mb-1 text-2xl font-semibold">Sign in</h1>
    <p class="mb-6 text-sm text-muted-foreground">
      Demo login against <code>/_user/api/v1/login</code>.
    </p>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <div class="space-y-1.5">
        <label for="email" class="text-sm font-medium">Email</label>
        <Input
          id="email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          required
          placeholder="you@example.com"
        />
        <p v-if="authStore.fieldErrors.email?.length" class="text-sm text-destructive">
          {{ authStore.fieldErrors.email[0] }}
        </p>
      </div>

      <div class="space-y-1.5">
        <label for="password" class="text-sm font-medium">Password</label>
        <Input
          id="password"
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          required
          placeholder="••••••••"
        />
        <p v-if="authStore.fieldErrors.password?.length" class="text-sm text-destructive">
          {{ authStore.fieldErrors.password[0] }}
        </p>
      </div>

      <p v-if="authStore.error" class="text-sm text-destructive" role="alert">
        {{ authStore.error }}
      </p>

      <Button type="submit" class="w-full" :disabled="submitting || authStore.isLoading">
        {{ submitting || authStore.isLoading ? 'Signing in…' : 'Sign in' }}
      </Button>
    </form>

    <p v-if="authStore.isLoggedIn" class="mt-4 text-sm text-muted-foreground">
      Signed in as {{ authStore.user?.email }}.
    </p>
  </div>
</template>
