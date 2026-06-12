<script setup lang="ts">
/**
 * /categories — the ItemCategory screen (D-02, list + create ONLY).
 *
 * The global category pool is create-only over the API (D-12): this screen lists
 * existing categories as read-only rows with NO edit/delete affordance, plus one
 * accent Add Category CTA opening the create-only CategoryFormDialog. Empty pool
 * shows the contextual empty state + Add CTA.
 *
 * Auth-guarded (UX redirect only). Names render via {{ }} interpolation, never
 * v-html (T-05-17).
 */
import { computed, ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import Breadcrumbs from '~/components/inventory/Breadcrumbs.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import CategoryFormDialog from '~/components/inventory/CategoryFormDialog.vue'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const { fetchCategories } = useInventory()

const { data, status } = await fetchCategories()

const categories = computed(() => data.value?.data ?? [])
const loadFailed = computed(() => status.value === 'error')

const createOpen = ref(false)

async function onSaved() {
  await refreshNuxtData('inv:categories')
}

useSeoMeta({
  title: () => t('inventory.totals.categories'),
})
</script>

<template>
  <section class="space-y-6">
    <Breadcrumbs :segments="[{ label: t('inventory.totals.categories') }]" />

    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="min-w-0 break-words text-3xl font-semibold tracking-tight">
        {{ t('inventory.totals.categories') }}
      </h1>
      <Button class="min-h-11 w-full sm:w-auto" data-testid="add-category" @click="createOpen = true">
        {{ t('inventory.category.create') }}
      </Button>
    </header>

    <p v-if="loadFailed" class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('inventory.error.loadFailed') }}
    </p>

    <EmptyState
      v-if="!categories.length"
      :title="t('inventory.empty.categories.title')"
    >
      <Button @click="createOpen = true">{{ t('inventory.category.create') }}</Button>
    </EmptyState>

    <!-- Read-only rows — NO edit/delete affordance (D-12). -->
    <Card v-else class="p-2">
      <ul class="divide-y">
        <li
          v-for="category in categories"
          :key="category.id"
          data-testid="category-row"
          class="rounded-md px-2 py-2 text-base"
        >
          {{ category.name }}
        </li>
      </ul>
    </Card>
  </section>

  <CategoryFormDialog v-model:open="createOpen" @saved="onSaved" />
</template>
