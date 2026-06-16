<script setup lang="ts">
/**
 * /items/[id]/edit — the Item EDIT route (D-03).
 *
 * Near-verbatim of the pre-rewrite /items/[id]: auth-guarded (UX redirect only),
 * hydrates the Item via the SSR read composable, 404s a missing/inaccessible id with
 * the generic inventory.error.notFound copy (no foreign-record enumeration), then
 * passes the record to ItemForm as `existing` — which switches the photo field into
 * the multi-photo gallery (edit mode). Renders at the shared max-w-5xl reading width;
 * the form lays out as a 2-col grid inside it. The View Item screen at /items/:id
 * links here via its Edit CTA.
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
