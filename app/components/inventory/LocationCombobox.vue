<script setup lang="ts">
/**
 * LocationCombobox (D-08) — a searchable Location picker GROUPED BY AREA.
 *
 * Composition is Popover + Command (NOT the reka-ui Combobox root): one
 * CommandGroup per Area (heading = Area name), each holding the Area's Locations
 * as CommandItems. v-model is the selected `locationId: number | null`.
 *
 * Two data sources:
 *  - default: the store's cross-Area `locationsByArea` cache (the Quick-add path
 *    that may target any accessible Area). The parent ItemForm calls
 *    loadLocationsForPickers() on mount so the cache is warm.
 *  - optional `locations` prop: a single Area's Locations supplied directly by a
 *    parent (e.g. arriving from an Area drill), which skips the cross-Area cache.
 *
 * No inline-create here — Locations are created through LocationFormDialog, never
 * from the Item form (only Category/Tag are create-on-the-fly, D-08).
 *
 * Security: this only ever offers Locations the permission-scoped API returned;
 * a crafted Location id the user can't access is rejected server-side on save
 * (T-05-13). Names render via interpolation, never v-html.
 */
import { computed, ref } from 'vue'
import { Check, ChevronsUpDown } from '@lucide/vue'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command'
import { Button } from '~/components/ui/button'
import { useInventoryStore } from '~/stores/inventory'
import type { Location } from '~~/shared/types/inventory'

const props = defineProps<{
  modelValue: number | null
  /** Optional single-Area Location list; when present, skips the cross-Area cache. */
  locations?: Location[]
  /** Optional invalid flag to surface a required-field error border. */
  invalid?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()
const store = useInventoryStore()

const open = ref(false)

/** Area id → Location[] groups: either the passed-in single Area or the store cache. */
const groups = computed<{ areaId: number, areaName: string, locations: Location[] }[]>(() => {
  if (props.locations && props.locations.length) {
    // A directly-supplied single Area's Locations — derive the heading from the first.
    const areaRef = props.locations[0]?.area
    return [{
      areaId: areaRef?.id ?? 0,
      areaName: areaRef?.name ?? '',
      locations: props.locations,
    }]
  }
  return Object.entries(store.locationsByArea).map(([areaId, locations]) => ({
    areaId: Number(areaId),
    areaName: locations[0]?.area?.name ?? '',
    locations,
  }))
})

/** Flat lookup so the trigger can show the selected Location's name. */
const selectedLocation = computed<Location | null>(() => {
  for (const g of groups.value) {
    const found = g.locations.find(l => l.id === props.modelValue)
    if (found) return found
  }
  return null
})

function select(id: number) {
  emit('update:modelValue', id)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        data-testid="location-combobox"
        :aria-expanded="open"
        :aria-invalid="invalid"
        class="w-full justify-between font-normal"
      >
        <span :class="selectedLocation ? '' : 'text-muted-foreground'">
          {{ selectedLocation?.name ?? t('inventory.location.create') }}
        </span>
        <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-(--reka-popover-trigger-width) p-0" align="start">
      <Command>
        <CommandInput :placeholder="t('inventory.field.name')" />
        <CommandList>
          <CommandEmpty>{{ t('inventory.empty.locations.title') }}</CommandEmpty>
          <CommandGroup
            v-for="group in groups"
            :key="group.areaId"
            :heading="group.areaName"
          >
            <CommandItem
              v-for="location in group.locations"
              :key="location.id"
              :value="location.name"
              @select="select(location.id)"
            >
              <Check
                class="mr-2 size-4"
                :class="location.id === modelValue ? 'opacity-100' : 'opacity-0'"
              />
              {{ location.name }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
