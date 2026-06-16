<script setup lang="ts">
/**
 * MintTokenDialog (Phase 8) — the two-phase token-mint modal.
 *
 * Phase A (form): a token name + a scope picker (read/write/ai, default ['read']).
 * On submit it calls useInventoryStore().mintToken(), which goes through `$api`
 * on the JWT/cookie group (D-02 — a token can never mint a token).
 *
 * Phase B (view-once reveal): on success the dialog body SWAPS to show the raw
 * `inv_…` secret ONCE in a readonly input with a copy button + a prominent
 * "you will not see this again" warning + the MCP install hint. The plaintext
 * secret is held ONLY in local component state (`secret`) — never persisted,
 * never re-fetched. Closing the dialog clears it and emits `minted` so the list
 * (inv:tokens) re-reads the secret-free meta.
 *
 * Names/secret render via {{ }} interpolation (auto-escaped), never v-html
 * (T-08-spa-xss). Every visible string goes through t().
 */
import { computed, reactive, ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Copy, Check } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useInventoryStore } from '~/stores/inventory'
import type { Area, TokenScope } from '~~/shared/types/inventory'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  minted: []
}>()

const { t } = useI18n()
const store = useInventoryStore()
const config = useRuntimeConfig()

/** The token-less MCP install one-liner (installer prompts for the token). */
const installCommand = computed(() => config.public.mcpInstallCommand)

const ALL_SCOPES: TokenScope[] = ['read', 'write', 'ai']

const form = reactive({ name: '', scopes: ['read'] as TokenScope[], area_ids: [] as number[] })
const nameError = ref(false)
const scopeError = ref(false)
const submitting = ref(false)

/** Areas the caller can bind the token to (empty selection = all areas). */
const areas = ref<Area[]>([])
const areasLoading = ref(false)

/** The raw secret — local-only, view-once, never persisted (T-08-spa-secret). */
const secret = ref<string | null>(null)
const copied = ref(false)

const revealed = computed(() => secret.value !== null)

/**
 * The one-paste install command with the freshly-minted secret embedded, so the
 * installer runs non-interactively. Convenience over the token-less form — at the
 * cost of the secret landing in shell history (surfaced via the history warning).
 * Empty until the secret exists (reveal phase only).
 */
const prefilledInstallCommand = computed(() =>
  secret.value
    ? `curl -fsSL ${config.public.mcpInstallUrl} | bash -s -- ${secret.value}`
    : '',
)

// Reset everything whenever the dialog (re)opens, and load the area pool for the
// optional restriction picker.
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    form.name = ''
    form.scopes = ['read']
    form.area_ids = []
    nameError.value = false
    scopeError.value = false
    secret.value = null
    copied.value = false

    areasLoading.value = true
    try {
      areas.value = await store.listAreas()
    }
    catch {
      // Non-fatal: without the list the user simply mints an all-areas token.
      areas.value = []
    }
    finally {
      areasLoading.value = false
    }
  },
)

function toggleScope(scope: TokenScope) {
  const idx = form.scopes.indexOf(scope)
  if (idx >= 0) form.scopes.splice(idx, 1)
  else form.scopes.push(scope)
  if (form.scopes.length) scopeError.value = false
}

function toggleArea(id: number) {
  const idx = form.area_ids.indexOf(id)
  if (idx >= 0) form.area_ids.splice(idx, 1)
  else form.area_ids.push(id)
}

function scopeHint(scope: TokenScope): string {
  return t(`inventory.settings.token.scope${scope.charAt(0).toUpperCase()}${scope.slice(1)}Hint`)
}

function close() {
  emit('update:open', false)
}

async function onSubmit() {
  nameError.value = !form.name.trim()
  scopeError.value = !form.scopes.length
  if (nameError.value || scopeError.value) return

  submitting.value = true
  try {
    const res = await store.mintToken({
      name: form.name.trim(),
      scopes: [...form.scopes],
      // Empty = unrestricted (all accessible areas); otherwise bind to the picks.
      area_ids: form.area_ids.length ? [...form.area_ids] : undefined,
    })
    // Hold the raw secret only here, in local state — swap to the reveal step.
    secret.value = res.token
    // The list now has a fresh row (store already refreshed inv:tokens).
    emit('minted')
  }
  catch {
    // Store surfaced the failure toast + error.value.
  }
  finally {
    submitting.value = false
  }
}

async function copySecret() {
  if (!secret.value) return
  try {
    await navigator.clipboard.writeText(secret.value)
    copied.value = true
    toast.success(t('inventory.settings.copied'))
    setTimeout(() => (copied.value = false), 2000)
  }
  catch {
    // Clipboard can be blocked (insecure context / permissions) — the readonly
    // input still lets the user select + copy manually.
  }
}

async function copyInstall() {
  try {
    await navigator.clipboard.writeText(installCommand.value)
    toast.success(t('inventory.settings.copied'))
  }
  catch {
    // No-op — the command text remains selectable.
  }
}

async function copyPrefilledInstall() {
  if (!prefilledInstallCommand.value) return
  try {
    await navigator.clipboard.writeText(prefilledInstallCommand.value)
    toast.success(t('inventory.settings.copied'))
  }
  catch {
    // No-op — the command text remains selectable.
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('inventory.settings.mintTitle') }}</DialogTitle>
        <DialogDescription>{{ t('inventory.settings.integrations.description') }}</DialogDescription>
      </DialogHeader>

      <!-- Phase A: the mint form. -->
      <form v-if="!revealed" class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="token-name">{{ t('inventory.settings.token.name') }}</Label>
          <Input
            id="token-name"
            v-model="form.name"
            :placeholder="t('inventory.settings.token.namePlaceholder')"
            :aria-invalid="nameError"
            autocomplete="off"
            data-testid="token-name"
          />
          <p v-if="nameError" class="text-sm text-destructive">
            {{ t('inventory.settings.nameRequired') }}
          </p>
        </div>

        <div class="space-y-2">
          <Label>{{ t('inventory.settings.token.scopes') }}</Label>
          <div class="space-y-2">
            <label
              v-for="scope in ALL_SCOPES"
              :key="scope"
              class="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted"
              :data-testid="`scope-${scope}`"
            >
              <input
                type="checkbox"
                class="mt-1 size-4 shrink-0"
                :checked="form.scopes.includes(scope)"
                @change="toggleScope(scope)"
              >
              <span class="min-w-0">
                <span class="block text-sm font-medium">{{ t(`inventory.settings.token.scope.${scope}`) }}</span>
                <span class="block text-xs text-muted-foreground">{{ scopeHint(scope) }}</span>
              </span>
            </label>
          </div>
          <p v-if="scopeError" class="text-sm text-destructive">
            {{ t('inventory.settings.scopeRequired') }}
          </p>
        </div>

        <!-- Optional per-Area restriction. Empty selection = all accessible areas. -->
        <div v-if="areas.length" class="space-y-2">
          <Label>{{ t('inventory.settings.token.areas') }}</Label>
          <div class="space-y-2">
            <label
              v-for="area in areas"
              :key="area.id"
              class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted"
              :data-testid="`area-${area.id}`"
            >
              <input
                type="checkbox"
                class="size-4 shrink-0"
                :checked="form.area_ids.includes(area.id)"
                @change="toggleArea(area.id)"
              >
              <span class="min-w-0 truncate text-sm font-medium">{{ area.name }}</span>
            </label>
          </div>
          <p class="text-xs text-muted-foreground">{{ t('inventory.settings.token.areasHint') }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="close">
            {{ t('inventory.action.cancel') }}
          </Button>
          <Button type="submit" :disabled="submitting || store.isLoading" data-testid="token-submit">
            {{ t('inventory.settings.mint') }}
          </Button>
        </DialogFooter>
      </form>

      <!-- Phase B: the view-once secret reveal. -->
      <div v-else class="space-y-4" data-testid="token-reveal">
        <div class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {{ t('inventory.settings.secretOnceWarning') }}
        </div>

        <div class="space-y-1.5">
          <Label for="token-secret">{{ t('inventory.settings.secretLabel') }}</Label>
          <div class="flex items-center gap-2">
            <Input
              id="token-secret"
              :model-value="secret ?? ''"
              readonly
              class="font-mono text-sm"
              data-testid="token-secret"
              @focus="(e: FocusEvent) => (e.target as HTMLInputElement).select()"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              class="size-11 shrink-0"
              :aria-label="t('inventory.settings.copy')"
              data-testid="token-copy"
              @click="copySecret"
            >
              <Check v-if="copied" />
              <Copy v-else />
            </Button>
          </div>
        </div>

        <!-- Install — prefilled one-paste command (secret embedded). -->
        <div class="space-y-1.5">
          <p class="text-sm text-muted-foreground">{{ t('inventory.settings.installHint') }}</p>
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-md border bg-muted px-3 py-2 text-left font-mono text-xs hover:bg-muted/70"
            data-testid="token-install-prefilled"
            @click="copyPrefilledInstall"
          >
            <span class="truncate">{{ prefilledInstallCommand }}</span>
            <Copy class="size-4 shrink-0 text-muted-foreground" />
          </button>
          <p class="text-xs text-muted-foreground">{{ t('inventory.settings.installHistoryWarning') }}</p>
        </div>

        <!-- Install — token-less command (installer prompts for the token). -->
        <div class="space-y-1.5">
          <p class="text-sm text-muted-foreground">{{ t('inventory.settings.installHintSafe') }}</p>
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-md border bg-muted px-3 py-2 text-left font-mono text-xs hover:bg-muted/70"
            data-testid="token-install-safe"
            @click="copyInstall"
          >
            <span class="truncate">{{ installCommand }}</span>
            <Copy class="size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>

        <DialogFooter>
          <Button type="button" data-testid="token-done" @click="close">
            {{ t('inventory.settings.done') }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
