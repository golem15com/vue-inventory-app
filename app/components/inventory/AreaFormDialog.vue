<script setup lang="ts">
/**
 * AreaFormDialog (D-05) — create/edit modal for an Area.
 *
 * Fields: name (required) + description (optional). NO creator/holder field
 * (D-13) — the backend assigns it on POST and makes it non-writable on PUT.
 *
 * Submits through useInventoryStore().saveArea(), which toasts on success and
 * refreshes the dashboard counts. Empty-name is caught client-side with the
 * localized inventory.error.nameRequired copy; save failures surface via the
 * store's generic error toast. The accent Save is the ONLY filled button
 * (UI-SPEC Color reserved list) — Cancel is outline.
 */
import { computed, reactive, ref, watch } from 'vue'
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
import type { Area } from '~~/shared/types/inventory'

const props = defineProps<{
  open: boolean
  existing?: Area | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [area: Area]
}>()

const { t } = useI18n()
const store = useInventoryStore()

const form = reactive({ name: '', description: '' })
const submitting = ref(false)
const nameError = ref(false)

const isEdit = computed(() => !!props.existing?.id)
const title = computed(() => (isEdit.value ? props.existing!.name : t('inventory.area.create')))

// Re-seed the form whenever the dialog opens (edit pre-fills, create resets).
watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.name = props.existing?.name ?? ''
    form.description = props.existing?.description ?? ''
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
    const saved = await store.saveArea({
      id: props.existing?.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
    })
    emit('saved', saved)
    close()
  }
  catch {
    // Store already surfaced the failure toast + error.value.
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
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t('inventory.area.create') }}</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="area-name">{{ t('inventory.field.name') }}</Label>
          <Input
            id="area-name"
            v-model="form.name"
            :aria-invalid="nameError"
            autocomplete="off"
          />
          <p v-if="nameError" class="text-sm text-destructive">
            {{ t('inventory.error.nameRequired') }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="area-description">{{ t('inventory.field.description') }}</Label>
          <Input id="area-description" v-model="form.description" autocomplete="off" />
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
