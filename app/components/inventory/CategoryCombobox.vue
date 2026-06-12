<script setup lang="ts">
/**
 * CategoryCombobox (D-08) — a searchable Category picker with INLINE CREATE.
 *
 * Composition is Popover + Command (same as LocationCombobox). v-model is the
 * selected `categoryId: number | null`, over the store's shared `categories`
 * cache (the parent ItemForm seeds it via fetchCategories()).
 *
 * Create-on-the-fly (D-08): when the typed query has NO exact case-insensitive
 * name match, a synthetic "Create '{query}'" CommandItem is offered (label from
 * inventory.combobox.createOption). Selecting it calls saveCategory({ name }),
 * which pushes the new category into the store cache, then selects the returned
 * id — so the new category is immediately selectable. The taxonomy is a shared
 * global create-only pool (D-12, T-05-14 accepted).
 */
import { computed, ref } from 'vue'
import { Check, ChevronsUpDown, Plus } from '@lucide/vue'
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

const props = defineProps<{
  modelValue: number | null
  /** Optional invalid flag to surface a required-field error border. */
  invalid?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()
const store = useInventoryStore()

const open = ref(false)
const query = ref('')
const creating = ref(false)

const categories = computed(() => store.categories)

const selectedCategory = computed(() =>
  categories.value.find(c => c.id === props.modelValue) ?? null,
)

/** Show the inline-create row only when the typed query has no exact name match. */
const showCreate = computed(() => {
  const q = query.value.trim()
  if (!q) return false
  return !categories.value.some(c => c.name.toLowerCase() === q.toLowerCase())
})

function select(id: number) {
  emit('update:modelValue', id)
  open.value = false
}

async function createOption() {
  const name = query.value.trim()
  if (!name || creating.value) return
  creating.value = true
  try {
    const created = await store.saveCategory({ name })
    if (created) select(created.id)
  }
  catch {
    // Store surfaced the failure toast.
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        data-testid="category-combobox"
        :aria-expanded="open"
        :aria-invalid="invalid"
        class="w-full justify-between font-normal"
      >
        <span :class="selectedCategory ? '' : 'text-muted-foreground'">
          {{ selectedCategory?.name ?? t('inventory.category.create') }}
        </span>
        <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-(--reka-popover-trigger-width) p-0" align="start">
      <Command>
        <CommandInput
          :placeholder="t('inventory.category.create')"
          @input="query = ($event.target as HTMLInputElement).value"
        />
        <CommandList>
          <CommandEmpty>
            <button
              v-if="showCreate"
              type="button"
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              :disabled="creating"
              @click="createOption"
            >
              <Plus class="size-4" />
              {{ t('inventory.combobox.createOption', { name: query.trim() }) }}
            </button>
            <span v-else>{{ t('inventory.empty.categories.title') }}</span>
          </CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="category in categories"
              :key="category.id"
              :value="category.name"
              @select="select(category.id)"
            >
              <Check
                class="mr-2 size-4"
                :class="category.id === modelValue ? 'opacity-100' : 'opacity-0'"
              />
              {{ category.name }}
            </CommandItem>
            <CommandItem
              v-if="showCreate"
              :value="`__create__${query}`"
              data-testid="combobox-create"
              @select="createOption"
            >
              <Plus class="mr-2 size-4" />
              {{ t('inventory.combobox.createOption', { name: query.trim() }) }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
