<script setup lang="ts">
/**
 * DeleteConfirmDialog (D-06) — a generic, consequence-stating delete dialog for
 * an Area or a Location. It spells out exactly what cascades/reassigns using the
 * serializer count fields (location_count / item_count), so the user knows the
 * blast radius before confirming. There is NO restore affordance anywhere
 * (D-06): soft-delete reversal is not exposed by the API.
 *
 * Guards (RESEARCH Pattern 3, Gap 3) — primary enforcement is at the TRIGGER
 * site (callers must not render a delete trigger for a non-owner's Area or for a
 * General Location). This component adds DEFENSE IN DEPTH: if it is somehow
 * opened for a General Location, the confirm button is disabled. Client hiding is
 * UX only — the backend is the real authz boundary (owner-only Area delete;
 * General delete → 422).
 *
 * On confirm it calls the matching store action (deleteArea / deleteLocation),
 * which toasts inventory.deleted and refreshes the affected lists, then emits
 * `confirmed` and closes.
 */
import { computed, ref } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { useInventoryStore } from '~/stores/inventory'
import type { Area, Location } from '~~/shared/types/inventory'

const props = defineProps<{
  open: boolean
  subject: 'area' | 'location'
  area?: Area | null
  location?: Location | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirmed: []
}>()

const { t } = useI18n()
const store = useInventoryStore()

const submitting = ref(false)

const name = computed(() =>
  props.subject === 'area' ? (props.area?.name ?? '') : (props.location?.name ?? ''),
)

const title = computed(() =>
  props.subject === 'area'
    ? t('inventory.area.delete.title', { name: name.value })
    : t('inventory.location.delete.title', { name: name.value }),
)

const body = computed(() => {
  if (props.subject === 'area') {
    return t('inventory.area.delete.body', {
      locations: props.area?.location_count ?? 0,
      items: props.area?.item_count ?? 0,
    })
  }
  return t('inventory.location.delete.body', {
    items: props.location?.item_count ?? 0,
  })
})

/**
 * Defense-in-depth guard: a General Location can never be deleted (the catch-all
 * is undeletable — the backend returns 422). If the dialog is somehow opened for
 * one, render the confirm disabled. Callers should never render the trigger at
 * all for `is_general === true`.
 */
const isGeneralLocation = computed(
  () => props.subject === 'location' && props.location?.is_general === true,
)
const confirmDisabled = computed(() => submitting.value || store.isLoading || isGeneralLocation.value)

function close() {
  emit('update:open', false)
}

async function onConfirm() {
  if (confirmDisabled.value) return
  submitting.value = true
  try {
    if (props.subject === 'area' && props.area) {
      await store.deleteArea(props.area.id)
    }
    else if (props.subject === 'location' && props.location?.area) {
      await store.deleteLocation(props.location.area.id, props.location.id)
    }
    emit('confirmed')
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
        <DialogDescription>{{ body }}</DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button type="button" variant="outline" @click="close">
          {{ t('inventory.action.cancel') }}
        </Button>
        <Button
          type="button"
          variant="destructive"
          data-testid="confirm-delete"
          :disabled="confirmDisabled"
          @click="onConfirm"
        >
          {{ t('inventory.action.confirmDelete') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
