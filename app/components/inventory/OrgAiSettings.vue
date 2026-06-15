<script setup lang="ts">
/**
 * OrgAiSettings (Phase 12, D-09/D-13) — the SHARED organisation BYOK AI-settings
 * card. An org-scoped clone of AiSettings.vue: the card shell, provider Select,
 * masked never-round-tripped key input with reveal toggle, collapsible advanced
 * model/base_url, Save (accent CTA) + decoupled Test (neutral) with inline
 * success / failure bands are byte-faithful to the per-user surface — only the
 * store/composable calls are swapped to the org variants.
 *
 * Reads the credential STATUS via useInventory().fetchOrgAiCredential() (keyed
 * `inv:org-ai-credential`, JWT/cookie group, SECRET-FREE: only `{ configured }` +
 * non-secret provider/model/base_url). The stored key is NEVER round-tripped —
 * the key input only ever holds a value the user just typed, and is cleared after
 * a successful save (T-12-cred-leak).
 *
 * Save → store.saveOrgAiCredential (one success toast + me/org-cred refresh).
 * Test connection → store.testOrgAiConnection, result rendered INLINE (UI-SPEC):
 * a muted success band or a destructive band carrying the verbatim provider
 * message (D-08), never a toast.
 *
 * Org-locked notice band (UI-SPEC copy) renders when `auth.aiOrgLock` is set.
 * Every visible string goes through t(); every icon-only control carries a
 * localized aria-label; errored inputs set :aria-invalid.
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
import type { AiProvider, OrgAiCredentialForm, OrgAiCredentialTestForm, TestConnectionResult } from '~~/shared/types/inventory'

const { t } = useI18n()
const store = useInventoryStore()
const auth = useAuthStore()
const { fetchOrgAiCredential } = useInventory()

const { data, status } = await fetchOrgAiCredential()

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

/** The non-secret overrides, dropped when blank so the backend default applies. */
function buildOverrides() {
  return {
    provider: form.provider,
    ...(form.model.trim() ? { model: form.model.trim() } : {}),
    ...(form.base_url.trim() ? { base_url: form.base_url.trim() } : {}),
  }
}

/** Save body — the typed api_key is always present (a save needs a key). */
function buildSavePayload(): OrgAiCredentialForm {
  return { ...buildOverrides(), api_key: form.api_key }
}

/**
 * Test body. When the input holds a typed key it is sent for an inline pre-save
 * test; when it is empty the api_key is OMITTED entirely (not sent as "") so the
 * server tests against the STORED org credential (OrgAiConfig::fromOrg).
 */
function buildTestPayload(): OrgAiCredentialTestForm {
  const overrides = buildOverrides()
  return form.api_key.trim()
    ? { ...overrides, api_key: form.api_key }
    : overrides
}

/** Save gate (UX only — the server D-09 guard is the real boundary): a save
 * always needs a key, since the stored secret is never round-tripped. */
function validate(): boolean {
  providerError.value = !form.provider
  keyError.value = !form.api_key.trim()
  return !providerError.value && !keyError.value
}

/**
 * Test gate. A test may run WITHOUT a typed key when a credential is already
 * saved (the server falls back to the stored org key). Only block — and show the
 * key-required error — when the input is empty AND nothing is configured yet.
 */
function validateTest(): boolean {
  providerError.value = !form.provider
  keyError.value = !form.api_key.trim() && !configured.value
  return !providerError.value && !keyError.value
}

async function onSave() {
  if (!validate()) return
  submitting.value = true
  try {
    await store.saveOrgAiCredential(buildSavePayload())
    // Clear the key field after a successful save (secret hygiene, T-12-cred-leak).
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
  if (!validateTest()) return
  testing.value = true
  testResult.value = null
  try {
    // Typed a key → test it. Left empty but a credential is saved → test the
    // STORED org key (buildTestPayload omits api_key so the server uses
    // OrgAiConfig::fromOrg).
    testResult.value = await store.testOrgAiConnection(buildTestPayload())
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
        {{ t('inventory.organisation.ai.heading') }}
      </h2>
      <p class="text-sm text-muted-foreground">
        {{ t('inventory.organisation.ai.description') }}
      </p>
    </header>

    <p v-if="loadFailed" class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('inventory.organisation.loadError') }}
    </p>

    <template v-else>
      <!-- Org-locked notice band (D-04): shared credentials are enforced for this
           deployment — members can't add their own key. Non-accent muted band. -->
      <div
        v-if="auth.aiOrgLock"
        class="bg-muted p-4 text-sm text-foreground"
        data-testid="org-ai-locked-band"
      >
        {{ t('inventory.organisation.ai.lockedNotice') }}
      </div>

      <!-- Unconfigured explainer — the form stays visible below. -->
      <div
        v-if="!configured"
        class="rounded-md border bg-muted p-4"
        data-testid="org-ai-empty"
      >
        <p class="text-base">{{ t('inventory.organisation.ai.emptyTitle') }}</p>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('inventory.organisation.ai.emptyBody') }}</p>
      </div>

      <Card class="space-y-4 p-4">
        <form class="space-y-4" @submit.prevent="onSave">
          <!-- Provider (ui/select). -->
          <div class="space-y-1.5">
            <Label for="org-ai-provider">{{ t('inventory.settings.ai.provider') }}</Label>
            <Select v-model="form.provider">
              <SelectTrigger
                id="org-ai-provider"
                class="min-h-11 w-full"
                :aria-invalid="providerError"
                data-testid="org-ai-provider"
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
            <Label for="org-ai-key">{{ t('inventory.settings.ai.apiKey') }}</Label>
            <div class="flex items-center gap-2">
              <Input
                id="org-ai-key"
                v-model="form.api_key"
                :type="keyInputType"
                :placeholder="keyPlaceholder"
                :aria-invalid="keyError"
                autocomplete="off"
                class="min-h-11 font-mono"
                data-testid="org-ai-key"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-11 shrink-0"
                :aria-label="revealed ? t('inventory.settings.ai.hideKey') : t('inventory.settings.ai.showKey')"
                data-testid="org-ai-key-reveal"
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
              class="text-sm text-muted-foreground hover:text-foreground"
              :aria-expanded="showAdvanced"
              data-testid="org-ai-advanced-toggle"
              @click="showAdvanced = !showAdvanced"
            >
              {{ t('inventory.settings.ai.advanced') }}
            </button>
            <div v-if="showAdvanced" class="space-y-4">
              <div class="space-y-1.5">
                <Label for="org-ai-model">{{ t('inventory.settings.ai.model') }}</Label>
                <Input
                  id="org-ai-model"
                  v-model="form.model"
                  autocomplete="off"
                  class="min-h-11"
                  data-testid="org-ai-model"
                />
                <p class="text-sm text-muted-foreground">{{ t('inventory.settings.ai.modelHint') }}</p>
              </div>
              <div class="space-y-1.5">
                <Label for="org-ai-base-url">{{ t('inventory.settings.ai.baseUrl') }}</Label>
                <Input
                  id="org-ai-base-url"
                  v-model="form.base_url"
                  autocomplete="off"
                  class="min-h-11"
                  data-testid="org-ai-base-url"
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
              data-testid="org-ai-save"
            >
              {{ t('inventory.organisation.ai.save') }}
            </Button>
            <Button
              type="button"
              variant="outline"
              class="min-h-11"
              :disabled="testing"
              data-testid="org-ai-test"
              @click="onTest"
            >
              {{ testing ? t('inventory.settings.ai.testing') : t('inventory.organisation.ai.test') }}
            </Button>
          </div>
        </form>

        <!-- Inline test-connection result (NOT a toast). -->
        <div
          v-if="testResult?.ok"
          class="flex items-center gap-2 bg-muted p-4 text-sm text-foreground"
          data-testid="org-ai-test-success"
        >
          <Check class="size-4 shrink-0 text-primary" />
          <span>{{ t('inventory.settings.ai.testSuccess') }}</span>
        </div>
        <div
          v-else-if="testResult && !testResult.ok"
          class="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
          data-testid="org-ai-test-failure"
        >
          {{ t('inventory.settings.ai.testFailure', { message: testResult.error ?? '' }) }}
        </div>
      </Card>
    </template>
  </section>
</template>
