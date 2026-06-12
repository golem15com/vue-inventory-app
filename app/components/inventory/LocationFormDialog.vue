<script setup lang="ts">
/**
 * LocationFormDialog (D-05) — create/edit modal for a Location within an Area.
 *
 * Single field: name (required). The parent Area is passed as `areaId` so the
 * store can POST to /areas/{areaId}/locations on create. Submits through
 * useInventoryStore().saveLocation(), which toasts on success and refreshes the
 * Area's location list + dashboard counts. Same footer/error pattern as the
 * Area dialog — accent Save is the only filled button (UI-SPEC Color list).
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
import type { Location } from '~~/shared/types/inventory'

const props = defineProps<{
  open: boolean
  areaId: number
  existing?: Location | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [location: Location]
}>()

const { t } = useI18n()
const store = useInventoryStore()

const form = reactive({ name: '' })
const submitting = ref(false)
const nameError = ref(false)

const isEdit = computed(() => !!props.existing?.id)
const title = computed(() => (isEdit.value ? props.existing!.name : t('inventory.location.create')))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.name = props.existing?.name ?? ''
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
    const saved = await store.saveLocation(props.areaId, {
      id: props.existing?.id,
      name: form.name.trim(),
    })
    emit('saved', saved)
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
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t('inventory.location.create') }}</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="location-name">{{ t('inventory.field.name') }}</Label>
          <Input
            id="location-name"
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
