<script setup lang="ts">
/**
 * AreaCombobox — a CLEARABLE single-select Area filter picker.
 *
 * Composition mirrors LocationCombobox VERBATIM (Popover + Command, NOT the
 * reka-ui Combobox root). The one structural delta vs the Phase 5 required
 * pickers: a top "Any" CommandItem that `select(null)`s so the filter clears
 * back to null (filters are optional, never required).
 *
 * v-model is the selected `areaId: number | null`. Options come from the
 * permission-scoped `useInventory().fetchAreas()` read — every offered Area is
 * already accessible; the server re-scopes search regardless (T-06-07 accepted).
 * Names render via interpolation, never v-html (T-06-06).
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
import { useInventory } from '~/composables/useInventory'
import type { Area } from '~~/shared/types/inventory'

const props = defineProps<{
  modelValue: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()
const { fetchAreas } = useInventory()

const open = ref(false)

const { data: areasData } = await fetchAreas()
const areas = computed<Area[]>(() => areasData.value?.data ?? [])

const selectedArea = computed<Area | null>(() =>
  areas.value.find(a => a.id === props.modelValue) ?? null,
)

function select(id: number | null) {
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
        data-testid="filter-area"
        :aria-expanded="open"
        class="min-h-11 w-full justify-between font-normal"
      >
        <span :class="selectedArea ? '' : 'text-muted-foreground'">
          {{ selectedArea?.name ?? t('inventory.search.filterArea') }}
        </span>
        <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-(--reka-popover-trigger-width) p-0" align="start">
      <Command>
        <CommandInput :placeholder="t('inventory.search.filterArea')" />
        <CommandList>
          <CommandEmpty>{{ t('inventory.empty.firstArea.title') }}</CommandEmpty>
          <CommandGroup>
            <CommandItem :value="''" @select="select(null)">
              <Check
                class="mr-2 size-4"
                :class="props.modelValue === null ? 'opacity-100' : 'opacity-0'"
              />
              {{ t('inventory.search.filterAny') }}
            </CommandItem>
            <CommandItem
              v-for="area in areas"
              :key="area.id"
              :value="area.name"
              @select="select(area.id)"
            >
              <Check
                class="mr-2 size-4"
                :class="area.id === modelValue ? 'opacity-100' : 'opacity-0'"
              />
              {{ area.name }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
