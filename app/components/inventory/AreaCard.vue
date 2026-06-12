<script setup lang="ts">
/**
 * AreaCard (D-04, UI-SPEC §"Dashboard composition" point 3) — a dashboard tile
 * for one Area. The WHOLE card is the drill-in link to /areas/{id} (hover:bg-muted).
 *
 * Shows two count chips ("{n} Locations · {m} Items") from the serializer's
 * location_count / item_count fields. A trash affordance (ghost, text-destructive)
 * sits top-right and renders ONLY when area.is_owner === true (RESEARCH Pattern 3,
 * Gap 3) — shared Editors never see Area delete. The trash is an icon-only control,
 * so it carries a localized aria-label (inventory.action.deleteLabel) and stops
 * propagation so clicking it never triggers the card's drill link; it emits
 * `delete` for the page to open the DeleteConfirmDialog.
 *
 * Hiding the affordance is UX only — the backend rejects a non-owner Area delete
 * (T-05-08). Names render as text via interpolation, never v-html (T-05-09).
 */
import { Trash2 } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import type { Area } from '~~/shared/types/inventory'

const props = defineProps<{
  area: Area
}>()

const emit = defineEmits<{
  delete: [area: Area]
}>()

const { t } = useI18n()

function onDelete() {
  emit('delete', props.area)
}
</script>

<template>
  <NuxtLink
    :to="`/areas/${area.id}`"
    data-testid="area-card"
    class="relative block rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
  >
    <Button
      v-if="area.is_owner === true"
      variant="ghost"
      size="icon-sm"
      data-testid="area-delete"
      class="absolute top-2 right-2 text-destructive hover:text-destructive"
      :aria-label="t('inventory.action.deleteLabel', { name: area.name })"
      @click.prevent.stop="onDelete"
    >
      <Trash2 />
    </Button>

    <h3 class="pr-8 font-semibold leading-snug">{{ area.name }}</h3>

    <p class="mt-2 text-sm text-muted-foreground">
      {{ area.location_count ?? 0 }} {{ t('inventory.totals.locations') }}
      ·
      {{ area.item_count ?? 0 }} {{ t('inventory.totals.items') }}
    </p>
  </NuxtLink>
</template>
