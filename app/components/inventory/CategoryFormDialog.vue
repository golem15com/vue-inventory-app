<script setup lang="ts">
/**
 * CategoryFormDialog (D-05) — CREATE-ONLY modal for an ItemCategory (D-02/D-12).
 *
 * The global category pool is create-only over the API: this dialog has no edit
 * branch and no removal affordance. It is used both from the Categories screen and
 * from the Item-form inline-create path, so it emits the created category
 * (`saved`) — the caller can immediately select the returned id.
 *
 * Single field: name (required). Submits through useInventoryStore().saveCategory(),
 * which toasts inventory.category.saved and returns the created record.
 */
import { reactive, ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useInventoryStore } from '~/stores/inventory'
import type { ItemCategory } from '~~/shared/types/inventory'

const props = defineProps<{
  open: boolean
  /** Optional seed name from the combobox inline-create row. */
  initialName?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [category: ItemCategory]
}>()

const { t } = useI18n()
const store = useInventoryStore()

const form = reactive({ name: '' })
const submitting = ref(false)
const nameError = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.name = props.initialName ?? ''
    nameError.value = false
  },
  { immediate: true },
)

function close() {
  emit('update:open', false)
}

async function onSubmit() {
  if (!form.name.trim()) {
    nameError.value = true
    return
  }
  nameError.value = false
  submitting.value = true
  try {
    const created = await store.saveCategory({ name: form.name.trim() })
    emit('saved', created)
    close()
  }
  catch {
    // Store surfaced the failure toast + error.value.
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('inventory.category.create') }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t('inventory.category.create') }}</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="category-name">{{ t('inventory.field.name') }}</Label>
          <Input
            id="category-name"
            v-model="form.name"
            :aria-invalid="nameError"
            autocomplete="off"
          />
          <p v-if="nameError" class="text-sm text-destructive">
            {{ t('inventory.error.nameRequired') }}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="close">
            {{ t('inventory.action.cancel') }}
          </Button>
          <Button type="submit" :disabled="submitting || store.isLoading">
            {{ t('inventory.action.save') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
