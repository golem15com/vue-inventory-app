<script setup lang="ts">
/**
 * AiAssistRow (Phase 7 Plan 04) — one EDITABLE repeater row in the /ai-assist
 * review step. It is a compact row, NOT a full-page form: it composes the same
 * field primitives as ItemForm (name Input + CategoryCombobox inline-create +
 * a number quantity + a plain-text description textarea) plus a 44px remove
 * affordance and a non-blocking amber "Possible duplicate" badge (D-13).
 *
 * Data contract: `v-model` is the row object the parent /ai-assist page holds in
 * its `rows` array — `{ name, item_category_id, quantity, description }`. The
 * CategoryCombobox resolves `item_category_id` (inline-create on a fresh
 * AI-proposed category, D-05). `:duplicate` flags a likely existing item; the
 * flag is text + icon (never color-only, Phase 6 a11y rule) and never blocks
 * save — the user may keep, edit, or remove a flagged row.
 *
 * Security: name/description render only as input/textarea VALUES — never as raw
 * HTML (T-07-17 / Phase 5 T-05 XSS rule). Description is plain text.
 */
import { computed } from 'vue'
import { AlertTriangle, X } from '@lucide/vue'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Button } from '~/components/ui/button'
import CategoryCombobox from '~/components/inventory/CategoryCombobox.vue'

/** The editable row shape held in the parent page's `rows` array. */
export interface AiAssistRowModel {
  name: string
  item_category_id: number | null
  quantity: number | null
  description: string
}

const props = defineProps<{
  /** Likely-duplicate flag (D-13) — non-blocking, surfaced as an amber badge. */
  duplicate?: boolean
  /** Surface the required-name error once the row has been touched. */
  touched?: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()

const { t } = useI18n()

/** The row object (two-way bound from the parent page). */
const row = defineModel<AiAssistRowModel>({ required: true })

/** Required-name error: empty name after the row was touched. */
const nameError = computed(() => !!props.touched && !row.value.name.trim())

/**
 * Quantity is `number | null` in the payload but the Input modelValue is
 * `string | number`. Proxy through a computed (mirrors ItemForm): empty → null,
 * else a clamped non-negative int.
 */
const quantityModel = computed<string | number>({
  get: () => (row.value.quantity == null ? '' : row.value.quantity),
  set: (v) => {
    const n = Number(v)
    row.value.quantity = v === '' || !Number.isFinite(n) ? null : Math.max(0, Math.trunc(n))
  },
})

/** Localized remove aria-label — falls back to the generic label when name is empty. */
const removeLabel = computed(() => t('inventory.aiAssist.removeRow'))
</script>

<template>
  <div
    class="rounded-md border bg-card p-4"
    :class="duplicate ? 'border-l-2 border-l-amber-500/60' : ''"
  >
    <!-- Duplicate flag (text + icon, never color-only — Phase 6 a11y rule). -->
    <div v-if="duplicate" class="mb-4">
      <span
        class="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-sm text-amber-700 dark:text-amber-400"
        :title="t('inventory.aiAssist.duplicateHint')"
      >
        <AlertTriangle class="size-4" />
        {{ t('inventory.aiAssist.duplicate') }}
      </span>
    </div>

    <!-- Phone: stacked. sm:+: name / category / quantity inline, remove trailing. -->
    <div class="flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_1fr_auto_auto] sm:items-start sm:gap-4">
      <!-- Name (required) -->
      <div class="space-y-2">
        <Label class="text-sm">{{ t('inventory.field.name') }}</Label>
        <Input
          v-model="row.name"
          class="min-h-11"
          :aria-invalid="nameError"
          autocomplete="off"
        />
        <p v-if="nameError" class="text-sm text-destructive">
          {{ t('inventory.error.nameRequired') }}
        </p>
      </div>

      <!-- Category (inline-create combobox → item_category_id) -->
      <div class="space-y-2">
        <Label class="text-sm">{{ t('inventory.field.category') }}</Label>
        <CategoryCombobox v-model="row.item_category_id" />
      </div>

      <!-- Quantity (optional, min 0) -->
      <div class="space-y-2 sm:w-24">
        <Label class="text-sm">{{ t('inventory.field.quantity') }}</Label>
        <Input
          v-model="quantityModel"
          class="min-h-11"
          type="number"
          min="0"
          inputmode="numeric"
        />
      </div>

      <!-- Remove (44px, no confirm — non-destructive on unsaved data) -->
      <div class="space-y-2">
        <Label class="text-sm sm:sr-only">&nbsp;</Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="text-destructive hover:text-destructive"
          :aria-label="removeLabel"
          @click="emit('remove')"
        >
          <X />
        </Button>
      </div>
    </div>

    <!-- Description (full-width, plain text only — never raw HTML) -->
    <div class="mt-4 space-y-2">
      <Label class="text-sm">{{ t('inventory.field.description') }}</Label>
      <textarea
        v-model="row.description"
        rows="2"
        class="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 md:text-sm"
      />
    </div>
  </div>
</template>
