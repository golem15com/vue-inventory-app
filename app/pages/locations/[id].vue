<script setup lang="ts">
/**
 * /locations/[id] — Item list (drill level 3, D-01).
 *
 * Paginated list of the Items in one Location as dense rows (UI-SPEC
 * §"Drill-down lists"): name + category + "× {quantity}" meta + tiny thumb, with
 * inline edit (→ /items/{id}) and delete (inline confirm → store.deleteItem; Items
 * have no cascade so a plain confirm is sufficient, per the plan). The header's
 * Add Item CTA carries the ?location= prefill (D-08). Empty Locations show the
 * contextual empty state + Add Item CTA.
 *
 * Auth-guarded (UX redirect only). A foreign/missing Location 404s with the generic
 * inventory.error.notFound copy (no enumeration, T-05-15). Names render via {{ }}
 * interpolation, never v-html (T-05-17).
 */
import { computed, ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Pencil, Trash2 } from '@lucide/vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import Breadcrumbs from '~/components/inventory/Breadcrumbs.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import { useInventoryStore } from '~/stores/inventory'
import type { Item } from '~~/shared/types/inventory'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { fetchItems } = useInventory()
const store = useInventoryStore()

const locationId = computed(() => Number(route.params.id))
const page = computed(() => {
  const n = Number(route.query.page)
  return Number.isFinite(n) && n > 0 ? n : 1
})

const { data, status, error } = await fetchItems(locationId.value, page.value)

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: t('inventory.error.notFound') })
}

const items = computed(() => data.value?.data ?? [])
const meta = computed(() => data.value?.meta)
const loadFailed = computed(() => status.value === 'error')

// Resolve Location + Area names from any embedded item ref (3-segment breadcrumb).
const locationName = computed(() => items.value.find(i => i.location)?.location?.name ?? '')
const areaName = computed(() => items.value.find(i => i.area)?.area?.name ?? '')
const areaId = computed(() => items.value.find(i => i.area)?.area?.id ?? null)

const hasPrev = computed(() => (meta.value?.current_page ?? 1) > 1)
const hasNext = computed(() => (meta.value?.current_page ?? 1) < (meta.value?.last_page ?? 1))

// Inline item-delete confirm (no cascade → a plain confirm, not the
// area/location DeleteConfirmDialog which calls deleteArea/deleteLocation).
const deleteOpen = ref(false)
const toDelete = ref<Item | null>(null)
const deleting = ref(false)

function openDelete(item: Item) {
  toDelete.value = item
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!toDelete.value || deleting.value) return
  deleting.value = true
  try {
    await store.deleteItem(toDelete.value)
    deleteOpen.value = false
    await refreshNuxtData(`inv:loc:${locationId.value}:items:${page.value}`)
  }
  catch {
    // Store surfaced the failure toast.
  }
  finally {
    deleting.value = false
  }
}

useSeoMeta({
  title: () => locationName.value || t('inventory.totals.items'),
})
</script>

<template>
  <section class="space-y-6">
    <Breadcrumbs
      :segments="[
        { label: t('inventory.totals.areas'), to: '/' },
        { label: areaName, to: areaId ? `/areas/${areaId}` : undefined },
        { label: locationName },
      ]"
    />

    <header class="flex items-center justify-between">
      <h1 class="text-3xl font-semibold tracking-tight">
        {{ locationName }}
      </h1>
      <Button @click="navigateTo(`/items/new?location=${locationId}`)">
        {{ t('inventory.item.add') }}
      </Button>
    </header>

    <p v-if="loadFailed" class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('inventory.error.loadFailed') }}
    </p>

    <EmptyState
      v-if="!items.length"
      :title="t('inventory.empty.items.title')"
      :body="t('inventory.empty.items.body')"
    >
      <Button @click="navigateTo(`/items/new?location=${locationId}`)">
        {{ t('inventory.item.add') }}
      </Button>
    </EmptyState>

    <template v-else>
      <Card class="p-2">
        <ul class="divide-y">
          <li
            v-for="item in items"
            :key="item.id"
            data-testid="item-row"
            class="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted"
          >
            <NuxtLink :to="`/items/${item.id}`" class="flex min-w-0 flex-1 items-center gap-3">
              <img
                v-if="item.photos?.[0]"
                :src="item.photos[0].thumb_url"
                :alt="item.name"
                class="size-10 rounded-md object-cover"
              >
              <span class="truncate text-base">{{ item.name }}</span>
              <span class="text-sm text-muted-foreground">
                {{ item.category?.name ?? '—' }}
                <span v-if="item.quantity != null" class="text-xs">· × {{ item.quantity }}</span>
              </span>
            </NuxtLink>

            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                :aria-label="t('inventory.action.editLabel', { name: item.name })"
                @click="navigateTo(`/items/${item.id}`)"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-destructive hover:text-destructive"
                :aria-label="t('inventory.action.deleteLabel', { name: item.name })"
                @click="openDelete(item)"
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        </ul>
      </Card>

      <!-- Pagination (lift the blog page/prev/next pattern). -->
      <div v-if="meta && meta.last_page > 1" class="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          :disabled="!hasPrev"
          @click="navigateTo({ query: { page: meta.current_page - 1 } })"
        >
          {{ t('blog.prevPage') }}
        </Button>
        <span class="text-sm text-muted-foreground">
          {{ t('blog.pageOf', { current: meta.current_page, last: meta.last_page }) }}
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="!hasNext"
          @click="navigateTo({ query: { page: meta.current_page + 1 } })"
        >
          {{ t('blog.nextPage') }}
        </Button>
      </div>
    </template>
  </section>

  <!-- Inline item-delete confirm. -->
  <Dialog v-model:open="deleteOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('inventory.action.deleteLabel', { name: toDelete?.name ?? '' }) }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ t('inventory.action.confirmDelete') }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" @click="deleteOpen = false">
          {{ t('inventory.action.cancel') }}
        </Button>
        <Button
          type="button"
          variant="destructive"
          :disabled="deleting || store.isLoading"
          @click="confirmDelete"
        >
          {{ t('inventory.action.confirmDelete') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
