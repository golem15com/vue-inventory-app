<script setup lang="ts">
/**
 * /ai-assist (Phase 7 Plan 04, D-07) — the dedicated photo-to-catalog page.
 *
 * Single-page PROGRESSIVE SCROLL (not a wizard primitive): a vertical space-y-8
 * stack of step Cards inside the locked max-w-5xl shell (no new layout, no modal).
 * The 4 steps:
 *   1 Where  — AreaCombobox (required) + LocationCombobox cascaded to the Area
 *   2 Photo  — PhotoUploader (create-mode staging) + "Analyze photo"
 *   3 Review — analyzing skeleton / editable AiAssistRow repeater / empty / error
 *   4 Save   — "Save all ({n})": ONE bulk call → attach photo → navigate
 *
 * Store contract (Plan 03, verified in 07-03-SUMMARY):
 *   store.recognize(photoFile, areaId)  → items[]  (read-only; rejects on AI error)
 *   store.bulkSaveItems(locationId, rows) → ONE request, one toast
 *   store.attachLocationPhoto(locationId, photoFile) → best-effort, no toast
 *
 * Duplicate flagging (D-13) reuses the already-scoped /items/search read that
 * useInventory().fetchSearch wraps — performed imperatively per-suggestion via
 * $api so each row can be flagged independently; NO backend change. The check is
 * NON-BLOCKING (a flagged row can still be saved, edited, or removed).
 *
 * Security: the page only offers accessible Areas/Locations, but the server is
 * the sole authority — recognize re-gates Area::accessibleBy and bulk/attach
 * re-gate Location::accessibleBy on every call (T-07-18). All suggestion text
 * renders via the AiAssistRow input/textarea VALUES — never raw HTML (T-07-17).
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Loader2, Plus, Sparkles } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import AreaCombobox from '~/components/inventory/AreaCombobox.vue'
import LocationCombobox from '~/components/inventory/LocationCombobox.vue'
import PhotoUploader from '~/components/inventory/PhotoUploader.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import AiAssistRow, { type AiAssistRowModel } from '~/components/inventory/AiAssistRow.vue'
import { useInventoryStore } from '~/stores/inventory'
import type { Item, Location } from '~~/shared/types/inventory'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const store = useInventoryStore()
// fetchSearch wraps the scoped /items/search read; the per-row duplicate check
// below reuses that same endpoint imperatively (no backend change, D-13).
const { fetchCategories } = useInventory()

// ---------------------------------------------------------------
// Flow state
// ---------------------------------------------------------------
type Status = 'idle' | 'analyzing' | 'reviewed' | 'empty' | 'error'

const areaId = ref<number | null>(null)
const locationId = ref<number | null>(null)
const photoFile = ref<File | null>(null)
const status = ref<Status>('idle')
const saving = ref(false)
const touched = ref(false)

/** Each entry pairs the editable row with its (non-blocking) duplicate flag. */
const rows = reactive<{ row: AiAssistRowModel, duplicate: boolean }[]>([])

onMounted(async () => {
  await store.loadLocationsForPickers()
  // Seed the Category pool so the inline-create combobox has options.
  if (!store.categories.length) {
    const { data } = await fetchCategories()
    if (data.value?.data) store.categories = data.value.data
  }
})

// ---------------------------------------------------------------
// Step 1 — Area → Location cascade
// ---------------------------------------------------------------
/** The chosen Area's Locations, scoping the LocationCombobox (mirrors search). */
const areaLocations = computed<Location[]>(() =>
  areaId.value != null ? (store.locationsByArea[areaId.value] ?? []) : [],
)

/** The chosen Location's name — used in the D-14 attach confirmation line. */
const locationName = computed<string>(() =>
  areaLocations.value.find(l => l.id === locationId.value)?.name ?? '',
)

// Clear a stale Location when the Area changes.
function onAreaChange(id: number | null) {
  areaId.value = id
  locationId.value = null
}

const whereReady = computed(() => areaId.value != null && locationId.value != null)
const canAnalyze = computed(
  () => whereReady.value && !!photoFile.value && status.value !== 'analyzing',
)

// ---------------------------------------------------------------
// Step 2 — Analyze
// ---------------------------------------------------------------
function toRow(s: { name: string, category: string | null, quantity: number, description: string | null }): AiAssistRowModel {
  // The AI `category` string is a HINT only: leave item_category_id null so the
  // CategoryCombobox inline-create resolves it on selection (D-05).
  return {
    name: s.name ?? '',
    item_category_id: null,
    quantity: typeof s.quantity === 'number' ? s.quantity : null,
    description: s.description ?? '',
  }
}

async function analyze() {
  if (!canAnalyze.value || areaId.value == null || !photoFile.value) return
  status.value = 'analyzing'
  rows.splice(0)
  try {
    const items = await store.recognize(photoFile.value, areaId.value)
    if (items.length) {
      for (const s of items) rows.push({ row: toRow(s), duplicate: false })
      status.value = 'reviewed'
      void flagDuplicates()
    }
    else {
      status.value = 'empty'
    }
  }
  catch {
    // recognize() already surfaced the store toast; show the page-specific copy
    // and keep the photo so Retry / Add-manually can recover (never a dead end).
    status.value = 'error'
    toast.error(t('inventory.aiAssist.error'))
  }
}

// ---------------------------------------------------------------
// Step 3 — Review: add / remove / manual entry
// ---------------------------------------------------------------
function addRow() {
  rows.push({ row: { name: '', item_category_id: null, quantity: null, description: '' }, duplicate: false })
}

function removeRow(index: number) {
  rows.splice(index, 1)
}

/** Empty/error recovery: reveal one manual row and enter the review state. */
function addManually() {
  if (!rows.length) addRow()
  status.value = 'reviewed'
}

/** "Try another photo": clear the staged photo and return focus to Step 2. */
function tryAnotherPhoto() {
  photoFile.value = null
  rows.splice(0)
  status.value = 'idle'
}

// ---------------------------------------------------------------
// Duplicate flagging (D-13) — reuse the scoped /items/search read
// ---------------------------------------------------------------
async function flagDuplicates() {
  if (areaId.value == null) return
  const { $api } = useNuxtApp()
  const baseURL = useRuntimeConfig().public.inventoryApiBase as string
  await Promise.all(
    rows.map(async (entry) => {
      const name = entry.row.name.trim()
      if (!name) return
      try {
        const res = await $api<{ data: Item[] }>('/items/search', {
          baseURL,
          query: { q: name, area: areaId.value, per_page: 5 },
        })
        // High-confidence: a case-insensitive exact name hit in the same Area.
        entry.duplicate = res.data.some(it => it.name.trim().toLowerCase() === name.toLowerCase())
      }
      catch {
        // Best-effort: a failed duplicate probe never blocks the flow.
      }
    }),
  )
}

// ---------------------------------------------------------------
// Step 4 — Save all (one bulk call → attach photo → navigate)
// ---------------------------------------------------------------
const validRows = computed(() =>
  rows.filter(e => e.row.name.trim() && e.row.item_category_id != null),
)
const canSave = computed(() => !saving.value && validRows.value.length > 0)

function toPayload(row: AiAssistRowModel): Partial<Item> {
  return {
    name: row.name.trim(),
    item_category_id: row.item_category_id,
    quantity: row.quantity,
    description: row.description.trim() || null,
  } as unknown as Partial<Item>
}

async function saveAll() {
  touched.value = true
  if (locationId.value == null) return
  const payload = validRows.value.map(e => toPayload(e.row))
  if (!payload.length) return
  saving.value = true
  try {
    await store.bulkSaveItems(locationId.value, payload)
    // Best-effort photo attach (D-14) — bulkSaveItems owns the one success toast.
    if (photoFile.value) {
      try {
        await store.attachLocationPhoto(locationId.value, photoFile.value)
      }
      catch {
        // Attach is best-effort; the items are already saved.
      }
    }
    await navigateTo(`/locations/${locationId.value}`)
  }
  catch {
    // Store surfaced the failure toast; stay on the page so the user can retry.
  }
  finally {
    saving.value = false
  }
}

const skeletonRows = [0, 1, 2]

useSeoMeta({
  title: () => t('inventory.aiAssist.title'),
})
</script>

<template>
  <!-- No container — the layout's <main mx-auto max-w-5xl px-4 py-8> owns it. -->
  <section class="space-y-8">
    <!-- Heading + Back. -->
    <div class="space-y-2">
      <Button
        variant="ghost"
        class="min-h-11 -ml-2"
        @click="navigateTo('/')"
      >
        {{ t('inventory.aiAssist.back') }}
      </Button>
      <div class="flex items-center gap-2">
        <Sparkles class="size-5" />
        <h1 class="text-lg font-semibold">{{ t('inventory.aiAssist.title') }}</h1>
      </div>
      <p class="text-sm text-muted-foreground">{{ t('inventory.aiAssist.subtitle') }}</p>
    </div>

    <!-- Step 1 — Where (always visible). -->
    <Card class="space-y-4 p-4">
      <h2 class="text-lg font-semibold">{{ t('inventory.aiAssist.step.where') }}</h2>
      <div class="space-y-2">
        <Label>{{ t('inventory.search.filterArea') }}</Label>
        <AreaCombobox :model-value="areaId" @update:model-value="onAreaChange" />
      </div>
      <div class="space-y-2">
        <Label>{{ t('inventory.field.location') }}</Label>
        <LocationCombobox
          v-model="locationId"
          :locations="areaLocations"
        />
      </div>
    </Card>

    <!-- Step 2 — Photo (enabled once Area+Location set). -->
    <Card class="space-y-4 p-4" :class="whereReady ? '' : 'opacity-60'">
      <h2 class="text-lg font-semibold">{{ t('inventory.aiAssist.step.photo') }}</h2>
      <p class="text-sm text-muted-foreground">{{ t('inventory.aiAssist.photoHint') }}</p>
      <PhotoUploader v-model="photoFile" />
      <p v-if="locationName" class="text-sm text-muted-foreground">
        {{ t('inventory.aiAssist.attachPhoto', { location: locationName }) }}
      </p>
      <div>
        <Button
          class="min-h-11 w-full sm:w-auto"
          data-testid="analyze-photo"
          :disabled="!canAnalyze"
          @click="analyze"
        >
          <Loader2 v-if="status === 'analyzing'" class="size-4 animate-spin" />
          {{ t('inventory.aiAssist.analyze') }}
        </Button>
      </div>
    </Card>

    <!-- Step 3/4 — Review (appears after analyze, or via Add-manually). -->
    <Card
      v-if="status !== 'idle'"
      class="space-y-6 p-4"
    >
      <div class="space-y-2">
        <h2 class="text-lg font-semibold">{{ t('inventory.aiAssist.step.review') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('inventory.aiAssist.reviewHint') }}</p>
      </div>

      <!-- Analyzing: skeleton rows announced to assistive tech. -->
      <div
        v-if="status === 'analyzing'"
        role="status"
        aria-busy="true"
        class="space-y-4"
      >
        <span class="sr-only">{{ t('inventory.aiAssist.analyzing') }}</span>
        <div
          v-for="row in skeletonRows"
          :key="row"
          class="h-24 animate-pulse rounded-md bg-muted"
        />
      </div>

      <!-- Empty: never a dead end. -->
      <EmptyState
        v-else-if="status === 'empty'"
        :title="t('inventory.aiAssist.empty.title')"
        :body="t('inventory.aiAssist.empty.body')"
      >
        <div class="flex flex-col gap-4 sm:flex-row">
          <Button variant="outline" class="min-h-11" data-testid="add-manually" @click="addManually">
            {{ t('inventory.aiAssist.addManually') }}
          </Button>
          <Button variant="outline" class="min-h-11" @click="tryAnotherPhoto">
            {{ t('inventory.aiAssist.retry') }}
          </Button>
        </div>
      </EmptyState>

      <!-- Error: keep the photo, offer Retry + Add-manually inline. -->
      <div v-else-if="status === 'error'" class="space-y-4">
        <p class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
          {{ t('inventory.aiAssist.error') }}
        </p>
        <div class="flex flex-col gap-4 sm:flex-row">
          <Button variant="outline" class="min-h-11" @click="analyze">
            {{ t('inventory.aiAssist.retry') }}
          </Button>
          <Button variant="outline" class="min-h-11" data-testid="add-manually" @click="addManually">
            {{ t('inventory.aiAssist.addManually') }}
          </Button>
        </div>
      </div>

      <!-- Reviewed: the editable repeater + Add item + Save all. -->
      <template v-else>
        <div class="space-y-4">
          <AiAssistRow
            v-for="(entry, index) in rows"
            :key="index"
            v-model="entry.row"
            :duplicate="entry.duplicate"
            :touched="touched"
            @remove="removeRow(index)"
          />
        </div>

        <div>
          <Button variant="outline" class="min-h-11" data-testid="add-item" @click="addRow">
            <Plus class="size-4" />
            {{ t('inventory.aiAssist.addItem') }}
          </Button>
        </div>

        <!-- Step 4 — Save all. -->
        <div class="flex justify-end border-t pt-4">
          <Button
            class="min-h-11 w-full sm:w-auto"
            data-testid="save-all"
            :disabled="!canSave"
            @click="saveAll"
          >
            <Loader2 v-if="saving" class="size-4 animate-spin" />
            {{ t('inventory.aiAssist.saveAllCount', { count: validRows.length }) }}
          </Button>
        </div>
      </template>
    </Card>
  </section>
</template>
