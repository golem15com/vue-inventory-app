<script setup lang="ts">
/**
 * /items/[id] — the Item EDIT route (D-05 / D-07).
 *
 * Auth-guarded (UX redirect only). Hydrates the Item via the SSR read composable
 * and throws a 404 on a missing/inaccessible id — the copy is the generic
 * inventory.error.notFound (no existence enumeration of foreign records, the
 * security copy rule). Passes the hydrated record to ItemForm as `existing`, which
 * switches the photo field into the multi-photo gallery (edit mode).
 */
import ItemForm from '~/components/inventory/ItemForm.vue'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { fetchItem } = useInventory()

const { data, error } = await fetchItem(Number(route.params.id))

if (error.value || !data.value?.data) {
  throw createError({ statusCode: 404, statusMessage: t('inventory.error.notFound') })
}

const item = computed(() => data.value!.data)

useSeoMeta({
  title: () => item.value.name,
})
</script>

<template>
  <section class="space-y-6">
    <h1 class="text-3xl font-semibold tracking-tight">
      {{ item.name }}
    </h1>
    <ItemForm :existing="item" />
  </section>
</template>
