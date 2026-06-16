<script setup lang="ts">
/**
 * /items/new — the Item CREATE route (D-05 / D-08).
 *
 * Auth-guarded (UX redirect only; the backend jwt.auth + accessibleBy scope is the
 * real boundary). Reads the optional `?location=` query and passes it to ItemForm
 * as `prefillLocationId` so arriving from a Location drill pre-selects that
 * Location (D-08). With no query it is the cross-Area Quick-add path — ItemForm
 * warms the grouped Location picker on mount.
 */
import ItemForm from '~/components/inventory/ItemForm.vue'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()

/** ?location= prefill — Number() or undefined when absent/invalid. */
const prefillLocationId = computed(() => {
  const raw = route.query.location
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
})

useSeoMeta({
  title: () => t('inventory.item.add'),
})
</script>

<template>
  <section class="space-y-6">
    <h1 class="text-3xl font-semibold tracking-tight">
      {{ t('inventory.item.add') }}
    </h1>
    <ItemForm :prefill-location-id="prefillLocationId" />
  </section>
</template>
