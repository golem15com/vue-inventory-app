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
import { Pencil, Sparkles, Trash2 } from '@lucide/vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { storeToRefs } from 'pinia'
import Breadcrumbs from '~/components/inventory/Breadcrumbs.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import { useInventoryStore } from '~/stores/inventory'
import { useAuthStore } from '~/stores/auth'
import type { Item } from '~~/shared/types/inventory'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { fetchItems, fetchLocation } = useInventory()
const store = useInventoryStore()
// UX-only AI gate (mirrors dashboard.vue); the backend re-gates AI server-side.
const auth = useAuthStore()
const { canUseAi } = storeToRefs(auth)

const locationId = computed(() => Number(route.params.id))
const page = computed(() => {
  const n = Number(route.query.page)
  return Number.isFinite(n) && n > 0 ? n : 1
})

const { data, status, error } = await fetchItems(locationId.value, page.value)

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: t('inventory.error.notFound') })
}

// Fetch the Location itself for its attached photos + an authoritative name. Best-
// effort: the items-based fetch above already owns the 404, so a Location-fetch
// miss must NOT double-throw — fall through to the item-derived header.
const { data: locationData } = await fetchLocation(locationId.value)
const location = computed(() => locationData.value?.data ?? null)
const locationPhotos = computed(() => location.value?.photos ?? [])

const items = computed(() => data.value?.data ?? [])
const meta = computed(() => data.value?.meta)
const loadFailed = computed(() => status.value === 'error')

// Prefer the Location's own name/Area, fall back to any embedded item ref.
const locationName = computed(() =>
  location.value?.name ?? items.value.find(i => i.location)?.location?.name ?? '')
const areaName = computed(() =>
  location.value?.area?.name ?? items.value.find(i => i.area)?.area?.name ?? '')
const areaId = computed(() =>
  location.value?.area?.id ?? items.value.find(i => i.area)?.area?.id ?? null)

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

    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="min-w-0 break-words text-3xl font-semibold tracking-tight">
        {{ locationName }}
      </h1>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <!-- Edit Location (always available, mirrors the View Area pencil → /areas/:id/edit). -->
        <Button
          variant="ghost"
          size="icon"
          class="size-11 self-start sm:self-auto"
          :aria-label="t('inventory.action.editLabel', { name: locationName })"
          @click="navigateTo(`/locations/${locationId}/edit`)"
        >
          <Pencil />
        </Button>
        <Button
          v-if="items.length"
          class="min-h-11 w-full sm:w-auto"
          @click="navigateTo(`/items/new?location=${locationId}`)"
        >
          {{ t('inventory.item.add') }}
        </Button>
        <Button
          v-if="items.length && canUseAi"
          class="min-h-11 w-full sm:w-auto"
          data-testid="scan-with-ai"
          :aria-label="t('inventory.aiAssist.entryLabel')"
          @click="navigateTo(`/ai-assist?area=${areaId}&location=${locationId}`)"
        >
          <Sparkles class="size-4" />
          {{ t('inventory.aiAssist.entry') }}
        </Button>
      </div>
    </header>

    <!-- Attached Location photos (D-14) — small thumbnail gallery near the header. -->
    <section v-if="locationPhotos.length" class="space-y-2">
      <h2 class="text-sm font-medium text-muted-foreground">{{ t('inventory.location.photos') }}</h2>
      <ul class="flex flex-wrap gap-4">
        <li v-for="photo in locationPhotos" :key="photo.id">
          <a :href="photo.url" target="_blank" rel="noopener" class="block">
            <img
              :src="photo.thumb_url"
              :alt="locationName"
              class="size-24 rounded-md object-cover"
            >
          </a>
        </li>
      </ul>
    </section>

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
      <Button
        v-if="canUseAi"
        data-testid="scan-with-ai"
        :aria-label="t('inventory.aiAssist.entryLabel')"
        @click="navigateTo(`/ai-assist?area=${areaId}&location=${locationId}`)"
      >
        <Sparkles class="size-4" />
        {{ t('inventory.aiAssist.entry') }}
      </Button>
    </EmptyState>

    <template v-else>
      <Card class="p-2">
        <ul class="divide-y">
          <li
            v-for="item in items"
            :key="item.id"
            data-testid="item-row"
            class="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 py-3 hover:bg-muted"
          >
            <NuxtLink :to="`/items/${item.id}`" class="flex min-h-11 min-w-0 flex-1 items-center gap-3">
              <img
                v-if="item.photos?.[0]"
                :src="item.photos[0].thumb_url"
                :alt="item.name"
                class="size-10 shrink-0 rounded-md object-cover"
              >
              <span class="truncate text-base">{{ item.name }}</span>
              <span class="shrink-0 text-sm text-muted-foreground">
                {{ item.category?.name ?? '—' }}
                <span v-if="item.quantity != null" class="text-xs">· × {{ item.quantity }}</span>
              </span>
            </NuxtLink>

            <div class="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="size-11"
                :aria-label="t('inventory.action.editLabel', { name: item.name })"
                @click="navigateTo(`/items/${item.id}`)"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="size-11 text-destructive hover:text-destructive"
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
          class="min-h-11"
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
          class="min-h-11"
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
        <Button type="button" variant="outline" class="min-h-11" @click="deleteOpen = false">
          {{ t('inventory.action.cancel') }}
        </Button>
        <Button
          type="button"
          variant="destructive"
          class="min-h-11"
          :disabled="deleting || store.isLoading"
          @click="confirmDelete"
        >
          {{ t('inventory.action.confirmDelete') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
