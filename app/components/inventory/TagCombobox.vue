<script setup lang="ts">
/**
 * TagCombobox — a CLEARABLE single-TAG-id filter picker.
 *
 * Composition mirrors LocationCombobox VERBATIM (Popover + Command). Like
 * AreaCombobox it carries a top "Any" CommandItem that `select(null)`s so the
 * filter clears back to null.
 *
 * v-model is a SINGLE tag id (`number | null`) — the backend `tag` search param
 * is one int. This is deliberately NOT TagChipInput (which v-models a multi-name
 * `string[]` for the Item form — the wrong shape for a single-id filter).
 *
 * Options come from `useInventory().fetchTags()`. Names render via interpolation,
 * never v-html (T-06-06).
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
import type { Tag } from '~~/shared/types/inventory'

const props = defineProps<{
  modelValue: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()
const { fetchTags } = useInventory()

const open = ref(false)

const { data: tagsData } = await fetchTags()
const tags = computed<Tag[]>(() => tagsData.value?.data ?? [])

const selectedTag = computed<Tag | null>(() =>
  tags.value.find(tag => tag.id === props.modelValue) ?? null,
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
        data-testid="filter-tag"
        :aria-expanded="open"
        class="min-h-11 w-full justify-between font-normal"
      >
        <span :class="selectedTag ? '' : 'text-muted-foreground'">
          {{ selectedTag?.name ?? t('inventory.search.filterTag') }}
        </span>
        <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-(--reka-popover-trigger-width) p-0" align="start">
      <Command>
        <CommandInput :placeholder="t('inventory.search.filterTag')" />
        <CommandList>
          <CommandEmpty>{{ t('inventory.empty.tags.title') }}</CommandEmpty>
          <CommandGroup>
            <CommandItem :value="''" @select="select(null)">
              <Check
                class="mr-2 size-4"
                :class="props.modelValue === null ? 'opacity-100' : 'opacity-0'"
              />
              {{ t('inventory.search.filterAny') }}
            </CommandItem>
            <CommandItem
              v-for="tag in tags"
              :key="tag.id"
              :value="tag.name"
              @select="select(tag.id)"
            >
              <Check
                class="mr-2 size-4"
                :class="tag.id === modelValue ? 'opacity-100' : 'opacity-0'"
              />
              {{ tag.name }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
