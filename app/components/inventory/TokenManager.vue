<script setup lang="ts">
/**
 * TokenManager (Phase 8) — the Integrations-tab token surface.
 *
 * Reads the caller's tokens via useInventory().fetchTokens() (keyed `inv:tokens`,
 * JWT/cookie group, secret-free). Renders a card list — name, scope badges,
 * last-used, expiry — with a per-row revoke behind a confirm dialog, plus a top
 * "Generate token" button that opens MintTokenDialog.
 *
 * After a mint or a revoke the store calls refreshNuxtData('inv:tokens'), so the
 * list re-reads automatically — this component never holds the raw secret (that
 * lives only inside MintTokenDialog, view-once). The empty state shows when the
 * user has no tokens. Names render via {{ }} interpolation (T-08-spa-xss).
 */
import { computed, ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Plus, Trash2 } from '@lucide/vue'
import MintTokenDialog from '~/components/inventory/MintTokenDialog.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import { useInventoryStore } from '~/stores/inventory'
import type { TokenMeta } from '~~/shared/types/inventory'

const { t } = useI18n()
const store = useInventoryStore()
const { fetchTokens } = useInventory()

const { data, status } = await fetchTokens()

const tokens = computed<TokenMeta[]>(() => data.value?.data ?? [])
const loadFailed = computed(() => status.value === 'error')

// Mint dialog.
const mintOpen = ref(false)

// Revoke confirm.
const revokeOpen = ref(false)
const toRevoke = ref<TokenMeta | null>(null)
const revoking = ref(false)

function openRevoke(token: TokenMeta) {
  toRevoke.value = token
  revokeOpen.value = true
}

async function confirmRevoke() {
  if (!toRevoke.value) return
  revoking.value = true
  try {
    await store.revokeToken(toRevoke.value.id)
    revokeOpen.value = false
  }
  catch {
    // Store surfaced the failure toast.
  }
  finally {
    revoking.value = false
  }
}

/** Localized "Never" or the formatted timestamp. */
function formatStamp(value: string | null): string {
  if (!value) return t('inventory.settings.token.never')
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString()
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-xl font-semibold tracking-tight">
          {{ t('inventory.settings.integrations.title') }}
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ t('inventory.settings.integrations.description') }}
        </p>
      </div>
      <Button class="min-h-11 w-full shrink-0 sm:w-auto" data-testid="mint-token" @click="mintOpen = true">
        <Plus class="mr-1 size-4" />
        {{ t('inventory.settings.mint') }}
      </Button>
    </header>

    <p v-if="loadFailed" class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('inventory.settings.loadError') }}
    </p>

    <EmptyState
      v-else-if="!tokens.length"
      :title="t('inventory.settings.integrations.title')"
      :body="t('inventory.settings.empty')"
    >
      <Button @click="mintOpen = true">
        <Plus class="mr-1 size-4" />
        {{ t('inventory.settings.mint') }}
      </Button>
    </EmptyState>

    <Card v-else class="p-2">
      <ul class="divide-y">
        <li
          v-for="token in tokens"
          :key="token.id"
          data-testid="token-row"
          class="flex min-h-11 items-start justify-between gap-3 rounded-md px-2 py-3 hover:bg-muted"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <p class="truncate text-base font-medium">{{ token.name }}</p>
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                v-for="scope in token.scopes"
                :key="scope"
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
              >
                {{ t(`inventory.settings.token.scope.${scope}`) }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ t('inventory.settings.token.lastUsed') }}: {{ formatStamp(token.last_used_at) }}
              ·
              {{ t('inventory.settings.token.expires') }}: {{ formatStamp(token.expires_at) }}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            data-testid="token-revoke"
            class="size-11 shrink-0 text-destructive hover:text-destructive"
            :aria-label="t('inventory.settings.revokeTitle', { name: token.name })"
            @click="openRevoke(token)"
          >
            <Trash2 />
          </Button>
        </li>
      </ul>
    </Card>

    <MintTokenDialog v-model:open="mintOpen" />

    <Dialog v-model:open="revokeOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {{ t('inventory.settings.revokeTitle', { name: toRevoke?.name ?? '' }) }}
          </DialogTitle>
          <DialogDescription>{{ t('inventory.settings.revokeConfirm') }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" @click="revokeOpen = false">
            {{ t('inventory.action.cancel') }}
          </Button>
          <Button
            type="button"
            variant="destructive"
            data-testid="confirm-revoke"
            :disabled="revoking || store.isLoading"
            @click="confirmRevoke"
          >
            {{ t('inventory.settings.revoke') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
