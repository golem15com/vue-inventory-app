<script setup lang="ts">
/**
 * SearchFilterBar — the four-filter wrapper the /search page composes.
 *
 * Owns the Area/Location/Category/Tag filter set and their layout:
 *  - `sm:` and up — the four pickers render INLINE in a wrapping flex row.
 *  - base (phone, D-12/D-13) — they collapse behind a single "Filters" button
 *    that opens a bottom `Sheet` (side="bottom"); the active-filter count rides
 *    the button label via inventory.search.filtersActive.
 *
 * Cascade (D-05): the Location picker's options are narrowed to the selected
 * Area from the store's `locationsByArea` cache (warmed via
 * loadLocationsForPickers); changing Area clears a now-invalid Location.
 * Category and Tag stay global. The cascade is a client-side UX narrowing only,
 * NOT an authz boundary — the server re-scopes every search (T-06-07 accepted).
 *
 * Clearing (non-destructive, no confirm): each active filter shows a chip with a
 * per-chip X, plus a ghost "Clear filters" button that nulls all four. Filters
 * v-model `number | null` only — typed ints, never concatenated into markup
 * (T-06-08). All copy is i18n-keyed; no raw strings.
 */
import { computed, onMounted, watch } from 'vue'
import { X } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet'
import AreaCombobox from '~/components/inventory/AreaCombobox.vue'
import TagCombobox from '~/components/inventory/TagCombobox.vue'
import LocationCombobox from '~/components/inventory/LocationCombobox.vue'
import CategoryCombobox from '~/components/inventory/CategoryCombobox.vue'
import { useInventoryStore } from '~/stores/inventory'
import type { Location } from '~~/shared/types/inventory'

export interface SearchFilters {
  area: number | null
  location: number | null
  category: number | null
  tag: number | null
}

const props = defineProps<{
  modelValue: SearchFilters
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SearchFilters]
}>()

const { t } = useI18n()
const store = useInventoryStore()

// Warm the cross-Area Location cache for the cascade (memoized in the store).
onMounted(() => store.loadLocationsForPickers())

/** Patch a single filter field and emit the merged object (v-model contract). */
function setFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

/** Cascade source (D-05): narrow Locations to the selected Area, else flatten all. */
const locationOptions = computed<Location[]>(() =>
  props.modelValue.area
    ? (store.locationsByArea[props.modelValue.area] ?? [])
    : Object.values(store.locationsByArea).flat(),
)

// Clear a now-invalid Location when the Area changes the available set.
watch(() => props.modelValue.area, () => {
  const loc = props.modelValue.location
  if (loc !== null && !locationOptions.value.some(l => l.id === loc)) {
    setFilter('location', null)
  }
})

/** Active-filter chips for the summary row + the mobile button count. */
const activeChips = computed(() => {
  const chips: { key: keyof SearchFilters, label: string }[] = []
  if (props.modelValue.area !== null) {
    const a = Object.values(store.locationsByArea).flat()
      .find(l => l.area?.id === props.modelValue.area)?.area
    chips.push({ key: 'area', label: a?.name ?? t('inventory.search.filterArea') })
  }
  if (props.modelValue.location !== null) {
    const l = locationOptions.value.find(o => o.id === props.modelValue.location)
    chips.push({ key: 'location', label: l?.name ?? t('inventory.field.location') })
  }
  if (props.modelValue.category !== null) {
    const c = store.categories.find(o => o.id === props.modelValue.category)
    chips.push({ key: 'category', label: c?.name ?? t('inventory.field.category') })
  }
  if (props.modelValue.tag !== null) {
    const tg = store.tags.find(o => o.id === props.modelValue.tag)
    chips.push({ key: 'tag', label: tg?.name ?? t('inventory.field.tags') })
  }
  return chips
})

const activeCount = computed(() => activeChips.value.length)

function clearAll() {
  emit('update:modelValue', { area: null, location: null, category: null, tag: null })
}
</script>

<template>
  <div class="space-y-2">
    <!-- sm:+ — inline filter bar. -->
    <div class="hidden flex-wrap gap-2 sm:flex">
      <div data-testid="filter-area-wrap" class="min-w-40 flex-1">
        <AreaCombobox
          :model-value="modelValue.area"
          @update:model-value="setFilter('area', $event)"
        />
      </div>
      <div data-testid="filter-location" class="min-w-40 flex-1">
        <LocationCombobox
          :model-value="modelValue.location"
          :locations="locationOptions"
          @update:model-value="setFilter('location', $event)"
        />
      </div>
      <div data-testid="filter-category" class="min-w-40 flex-1">
        <CategoryCombobox
          :model-value="modelValue.category"
          @update:model-value="setFilter('category', $event)"
        />
      </div>
      <div data-testid="filter-tag-wrap" class="min-w-40 flex-1">
        <TagCombobox
          :model-value="modelValue.tag"
          @update:model-value="setFilter('tag', $event)"
        />
      </div>
    </div>

    <!-- base (phone) — Filters button → bottom sheet. -->
    <Sheet>
      <SheetTrigger as-child>
        <Button
          type="button"
          variant="outline"
          data-testid="filters-button"
          class="min-h-11 w-full sm:hidden"
        >
          {{ activeCount > 0
            ? t('inventory.search.filtersActive', { count: activeCount })
            : t('inventory.search.filters') }}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" class="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{{ t('inventory.search.filters') }}</SheetTitle>
        </SheetHeader>
        <div class="space-y-3 px-4 pb-4">
          <AreaCombobox
            :model-value="modelValue.area"
            @update:model-value="setFilter('area', $event)"
          />
          <LocationCombobox
            :model-value="modelValue.location"
            :locations="locationOptions"
            @update:model-value="setFilter('location', $event)"
          />
          <CategoryCombobox
            :model-value="modelValue.category"
            @update:model-value="setFilter('category', $event)"
          />
          <TagCombobox
            :model-value="modelValue.tag"
            @update:model-value="setFilter('tag', $event)"
          />
        </div>
      </SheetContent>
    </Sheet>

    <!-- Active-filter chips + clear-all (shown only when ≥1 filter is set). -->
    <div v-if="activeCount > 0" class="flex flex-wrap items-center gap-2">
      <span
        v-for="chip in activeChips"
        :key="chip.key"
        class="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm"
      >
        {{ chip.label }}
        <button
          type="button"
          :aria-label="t('inventory.search.clearFilters')"
          class="opacity-80 hover:opacity-100"
          @click="setFilter(chip.key, null)"
        >
          <X class="size-3" />
        </button>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="clear-filters"
        @click="clearAll"
      >
        {{ t('inventory.search.clearFilters') }}
      </Button>
    </div>
  </div>
</template>
