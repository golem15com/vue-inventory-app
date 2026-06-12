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
import { computed, ref } from 'vue'
import { AlertTriangle, ExternalLink, X } from '@lucide/vue'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Button } from '~/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import CategoryCombobox from '~/components/inventory/CategoryCombobox.vue'
import type { Item } from '~~/shared/types/inventory'

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
  /**
   * The actual matching existing Items (name + their location/area) backing the
   * flag — listed in the chip popover, each linking to /items/{id} for editing.
   */
  duplicates?: Item[]
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

/** Localized remove aria-label. */
const removeLabel = computed(() => t('inventory.aiAssist.removeRow'))

/** Header heading: the row's current name, falling back to a generic label when empty. */
const headingLabel = computed(() => row.value.name.trim() || t('inventory.aiAssist.newItem'))

// ---------------------------------------------------------------
// Duplicate chip popover (D-13) — opens on tap/click AND desktop hover.
// ---------------------------------------------------------------
/** The matching existing items (safe default), listed inside the popover. */
const duplicateItems = computed<Item[]>(() => props.duplicates ?? [])

/** Localized accessible label for the chip trigger. */
const duplicateTriggerLabel = computed(() => t('inventory.aiAssist.duplicateLabel'))

const popoverOpen = ref(false)
// Hover-open uses a small close delay so moving the pointer from the trigger
// into the content doesn't dismiss it; tap/click still toggles on touch.
let closeTimer: ReturnType<typeof setTimeout> | null = null

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function openPopover() {
  clearCloseTimer()
  popoverOpen.value = true
}

function scheduleClose() {
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    popoverOpen.value = false
    closeTimer = null
  }, 150)
}
</script>

<template>
  <div
    class="rounded-md border bg-card p-4"
    :class="duplicate ? 'border-l-2 border-l-amber-500/60' : ''"
  >
    <!-- Card header: name heading (left) + remove (top-right corner). -->
    <div class="mb-4 flex items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <h3 class="truncate text-base font-medium" :class="row.name.trim() ? '' : 'text-muted-foreground'">
          {{ headingLabel }}
        </h3>
        <!--
          Duplicate flag (text + icon, never color-only — Phase 6 a11y rule).
          Interactive popover (D-13): the badge is a real focusable button that
          opens on tap/click AND desktop hover, listing each matching existing
          item + its location with a link to open it for editing in a new tab.
        -->
        <Popover v-if="duplicate" v-model:open="popoverOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-sm text-amber-700 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:text-amber-400"
              :aria-label="duplicateTriggerLabel"
              @mouseenter="openPopover"
              @mouseleave="scheduleClose"
              @focus="openPopover"
              @blur="scheduleClose"
            >
              <AlertTriangle class="size-4" />
              {{ t('inventory.aiAssist.duplicate') }}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            class="w-72 space-y-3"
            @mouseenter="openPopover"
            @mouseleave="scheduleClose"
          >
            <p class="text-sm font-medium">{{ t('inventory.aiAssist.duplicateList') }}</p>
            <ul v-if="duplicateItems.length" class="space-y-1">
              <li
                v-for="dup in duplicateItems"
                :key="dup.id"
              >
                <a
                  :href="`/items/${dup.id}`"
                  target="_blank"
                  rel="noopener"
                  class="-mx-2 flex items-start justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span class="min-w-0">
                    <span class="block truncate font-medium">{{ dup.name }}</span>
                    <span class="block text-xs text-muted-foreground">
                      <template v-if="dup.location?.name">
                        {{ t('inventory.aiAssist.duplicateIn', { location: dup.location.name }) }}
                      </template>
                      <template v-if="dup.area?.name">
                        <span class="opacity-70"> · {{ dup.area.name }}</span>
                      </template>
                    </span>
                  </span>
                  <span class="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <ExternalLink class="size-3.5" />
                    <span class="sr-only">{{ t('inventory.aiAssist.duplicateOpen') }}</span>
                  </span>
                </a>
              </li>
            </ul>
            <p class="text-xs text-muted-foreground">{{ t('inventory.aiAssist.duplicateIgnore') }}</p>
          </PopoverContent>
        </Popover>
      </div>

      <!-- Remove (44px, no confirm — non-destructive on unsaved data). -->
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="shrink-0 text-destructive hover:text-destructive"
        :aria-label="removeLabel"
        @click="emit('remove')"
      >
        <X />
      </Button>
    </div>

    <!-- Phone: stacked. sm:+: name / category / quantity inline. -->
    <div class="flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:items-start sm:gap-4">
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
