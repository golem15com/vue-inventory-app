<script setup lang="ts">
/**
 * AiSettings (Phase 11) — the BYOK AI-settings tab surface (D-05/D-06/D-08).
 *
 * Mirrors TokenManager.vue's card/header/load-error shell and MintTokenDialog.vue's
 * secret discipline. The provider picker is ui/select's first consumer.
 *
 * Reads the credential STATUS via useInventory().fetchAiCredential() (keyed
 * `inv:ai-credential`, JWT/cookie group, SECRET-FREE: only `{ configured }` +
 * non-secret provider/model/base_url). The stored key is NEVER round-tripped —
 * the key input only ever holds a value the user just typed, and is cleared after
 * a successful save (T-11-15). The masked placeholder ("a key is saved …") is the
 * only signal that a key exists when `configured`.
 *
 * Save is a plain persist (D-06) — one success toast from the store, then the
 * store refreshes `inv:me` (recompute can_use_ai, D-04) + `inv:ai-credential`.
 * Test connection is a SEPARATE, decoupled action whose result renders INLINE
 * (UI-SPEC) — success band or destructive band carrying the verbatim provider
 * message (D-08), never a toast.
 *
 * Every visible string goes through t(); every icon-only control carries an
 * explicit localized aria-label; errored inputs set :aria-invalid.
 */
import { computed, reactive, ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Check, Eye, EyeOff } from '@lucide/vue'
import { useInventoryStore } from '~/stores/inventory'
import { useAuthStore } from '~/stores/auth'
import type { AiProvider, TestConnectionResult } from '~~/shared/types/inventory'

const { t } = useI18n()
const store = useInventoryStore()
const auth = useAuthStore()
const { fetchAiCredential } = useInventory()

const { data, status } = await fetchAiCredential()

const loadFailed = computed(() => status.value === 'error')
const configured = computed(() => data.value?.configured === true)

// The form. `provider` and the advanced overrides hydrate from the secret-free
// read; `api_key` is ALWAYS empty on load (the stored key is never round-tripped).
const form = reactive({
  provider: (data.value?.provider ?? 'claude') as AiProvider,
  api_key: '',
  model: data.value?.model ?? '',
  base_url: data.value?.base_url ?? '',
})

const providerError = ref(false)
const keyError = ref(false)
const submitting = ref(false)
const testing = ref(false)
const revealed = ref(false)
const showAdvanced = ref(false)

// Inline test-connection result (NOT a toast). null = not yet run.
const testResult = ref<TestConnectionResult | null>(null)

const keyInputType = computed(() => (revealed.value ? 'text' : 'password'))
const keyPlaceholder = computed(() =>
  configured.value
    ? t('inventory.settings.ai.apiKeyConfigured')
    : t('inventory.settings.ai.apiKeyPlaceholder'),
)

/** Trim + drop the optional overrides when blank so the backend default applies. */
function buildPayload() {
  return {
    provider: form.provider,
    api_key: form.api_key,
    ...(form.model.trim() ? { model: form.model.trim() } : {}),
    ...(form.base_url.trim() ? { base_url: form.base_url.trim() } : {}),
  }
}

/** Client-side gate (UX only — the server is the real boundary, T-11-17). */
function validate(): boolean {
  providerError.value = !form.provider
  keyError.value = !form.api_key.trim()
  return !providerError.value && !keyError.value
}

async function onSave() {
  if (!validate()) return
  submitting.value = true
  try {
    await store.saveAiCredential(buildPayload())
    // Clear the key field after a successful save (secret hygiene, T-11-15).
    form.api_key = ''
    revealed.value = false
  }
  catch {
    // The store surfaced the failure toast + error.value.
  }
  finally {
    submitting.value = false
  }
}

async function onTest() {
  if (!validate()) return
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await store.testAiConnection(buildPayload())
  }
  catch {
    // A thrown error (network/5xx) — surface it inline like a failed connection,
    // never silently swallowed (D-08).
    testResult.value = { ok: false, error: t('inventory.error.saveFailed') }
  }
  finally {
    testing.value = false
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="min-w-0">
      <h2 class="text-xl font-semibold tracking-tight">
        {{ t('inventory.settings.ai.heading') }}
      </h2>
      <p class="text-sm text-muted-foreground">
        {{ t('inventory.settings.ai.description') }}
      </p>
    </header>

    <p v-if="loadFailed" class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('inventory.settings.loadError') }}
    </p>

    <template v-else>
      <!-- Org-locked fallback band (D-04). The whole AI tab is normally hidden
           from the strip when the .env org-lock flag is set; this only renders if
           the route is hit directly. Non-accent muted band — a steady state. -->
      <div
        v-if="auth.aiOrgLock"
        class="bg-muted p-4 text-sm text-foreground"
        data-testid="ai-org-locked-band"
      >
        {{ t('inventory.aiInherited.locked') }}
      </div>

      <!-- Inherited-org info band (D-13): an org credential is present, the caller
           has no per-user key, and the lock flag is unset. Non-accent muted band —
           it is informational, NOT a call to action. -->
      <div
        v-else-if="auth.aiInherited"
        class="bg-muted p-4 text-sm text-foreground"
        data-testid="ai-inherited-band"
      >
        {{ t('inventory.aiInherited.band') }}
      </div>

      <!-- Unconfigured explainer — the form stays visible below in both states. -->
      <div
        v-if="!configured"
        class="rounded-md border bg-muted p-4"
        data-testid="ai-empty"
      >
        <p class="text-base font-medium">{{ t('inventory.settings.ai.emptyTitle') }}</p>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('inventory.settings.ai.emptyBody') }}</p>
      </div>

      <Card class="space-y-4 p-4">
        <form class="space-y-4" @submit.prevent="onSave">
          <!-- Provider (ui/select — first consumer). -->
          <div class="space-y-1.5">
            <Label for="ai-provider">{{ t('inventory.settings.ai.provider') }}</Label>
            <Select v-model="form.provider">
              <SelectTrigger
                id="ai-provider"
                class="min-h-11 w-full"
                :aria-invalid="providerError"
                data-testid="ai-provider"
              >
                <SelectValue :placeholder="t('inventory.settings.ai.provider')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">{{ t('inventory.settings.ai.providerClaude') }}</SelectItem>
                <SelectItem value="openai">{{ t('inventory.settings.ai.providerOpenai') }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="providerError" class="text-sm text-destructive">
              {{ t('inventory.settings.ai.providerRequired') }}
            </p>
          </div>

          <!-- API key — masked, secret-disciplined, never round-tripped. -->
          <div class="space-y-1.5">
            <Label for="ai-key">{{ t('inventory.settings.ai.apiKey') }}</Label>
            <div class="flex items-center gap-2">
              <Input
                id="ai-key"
                v-model="form.api_key"
                :type="keyInputType"
                :placeholder="keyPlaceholder"
                :aria-invalid="keyError"
                autocomplete="off"
                class="min-h-11 font-mono"
                data-testid="ai-key"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-11 shrink-0"
                :aria-label="revealed ? t('inventory.settings.ai.hideKey') : t('inventory.settings.ai.showKey')"
                data-testid="ai-key-reveal"
                @click="revealed = !revealed"
              >
                <EyeOff v-if="revealed" />
                <Eye v-else />
              </Button>
            </div>
            <p v-if="keyError" class="text-sm text-destructive">
              {{ t('inventory.settings.ai.keyRequired') }}
            </p>
          </div>

          <!-- Advanced overrides (collapsed by default). -->
          <div class="space-y-3">
            <button
              type="button"
              class="text-sm font-medium text-muted-foreground hover:text-foreground"
              :aria-expanded="showAdvanced"
              data-testid="ai-advanced-toggle"
              @click="showAdvanced = !showAdvanced"
            >
              {{ t('inventory.settings.ai.advanced') }}
            </button>
            <div v-if="showAdvanced" class="space-y-4">
              <div class="space-y-1.5">
                <Label for="ai-model">{{ t('inventory.settings.ai.model') }}</Label>
                <Input
                  id="ai-model"
                  v-model="form.model"
                  autocomplete="off"
                  class="min-h-11"
                  data-testid="ai-model"
                />
                <p class="text-sm text-muted-foreground">{{ t('inventory.settings.ai.modelHint') }}</p>
              </div>
              <div class="space-y-1.5">
                <Label for="ai-base-url">{{ t('inventory.settings.ai.baseUrl') }}</Label>
                <Input
                  id="ai-base-url"
                  v-model="form.base_url"
                  autocomplete="off"
                  class="min-h-11"
                  data-testid="ai-base-url"
                />
                <p class="text-sm text-muted-foreground">{{ t('inventory.settings.ai.baseUrlHint') }}</p>
              </div>
            </div>
          </div>

          <!-- Actions: Save (accent CTA) + Test connection (neutral). -->
          <div class="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              class="min-h-11"
              :disabled="submitting || store.isLoading"
              data-testid="ai-save"
            >
              {{ t('inventory.settings.ai.save') }}
            </Button>
            <Button
              type="button"
              variant="outline"
              class="min-h-11"
              :disabled="testing"
              data-testid="ai-test"
              @click="onTest"
            >
              {{ testing ? t('inventory.settings.ai.testing') : t('inventory.settings.ai.test') }}
            </Button>
          </div>
        </form>

        <!-- Inline test-connection result (NOT a toast). -->
        <div
          v-if="testResult?.ok"
          class="flex items-center gap-2 bg-muted p-4 text-sm text-foreground"
          data-testid="ai-test-success"
        >
          <Check class="size-4 shrink-0 text-primary" />
          <span>{{ t('inventory.settings.ai.testSuccess') }}</span>
        </div>
        <div
          v-else-if="testResult && !testResult.ok"
          class="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
          data-testid="ai-test-failure"
        >
          {{ t('inventory.settings.ai.testFailure', { message: testResult.error ?? '' }) }}
        </div>
      </Card>
    </template>
  </section>
</template>
