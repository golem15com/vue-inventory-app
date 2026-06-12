<script setup lang="ts">
/**
 * TagChipInput (D-08) — a chip input wrapping the shadcn TagsInput (reka-ui).
 *
 * v-model is a `string[]` of tag NAMES (RESEARCH Pitfall 6) — NOT {id,name}
 * objects. On read (edit), the parent passes `item.tags.map(t => t.name)`. On
 * save, the Item payload sends these names verbatim; the backend auto-creates any
 * missing tags (D-08), so calling createTag here is unnecessary — a typed name +
 * Enter simply adds a chip.
 *
 * Add-on-Enter is the reka-ui TagsInput default (Enter commits the current input
 * as a new item). Each chip's delete control carries a localized aria-label
 * (inventory.action.deleteLabel) so the icon-only remove is accessible.
 *
 * Tags are a shared global create-only pool (D-12, T-05-14 accepted).
 */
import { TagsInput, TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText } from '~/components/ui/tags-input'

defineProps<{
  /** v-model: the selected tag names. */
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { t } = useI18n()

function update(value: string[] | undefined) {
  emit('update:modelValue', value ?? [])
}
</script>

<template>
  <TagsInput
    :model-value="modelValue"
    @update:model-value="update($event as string[])"
  >
    <TagsInputItem v-for="tag in modelValue" :key="tag" :value="tag">
      <TagsInputItemText />
      <TagsInputItemDelete :aria-label="t('inventory.action.deleteLabel', { name: tag })" />
    </TagsInputItem>
    <TagsInputInput />
  </TagsInput>
</template>
