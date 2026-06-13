<script setup lang="ts">
/**
 * /areas/[id] — Location list (drill level 2, D-01).
 *
 * Lists the Locations within one Area as dense rows (UI-SPEC §"Drill-down lists").
 * Each row drills to /locations/{id}, carries an item-count meta, and (unless it is
 * the General catch-all) inline edit + delete affordances. The General Location
 * renders NO delete trigger (Gap 3) — the dialog's disabled-confirm is only a
 * backstop. Empty Areas show the contextual empty state + Add Location CTA.
 *
 * Auth-guarded (UX redirect only). A foreign/missing Area 404s with the generic
 * inventory.error.notFound copy — never "no permission" (no enumeration, T-05-15).
 * Names render via {{ }} interpolation, never v-html (T-05-17).
 */
import { computed, ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Image as ImageIcon, Pencil, Trash2 } from '@lucide/vue'
import Breadcrumbs from '~/components/inventory/Breadcrumbs.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import LocationFormDialog from '~/components/inventory/LocationFormDialog.vue'
import DeleteConfirmDialog from '~/components/inventory/DeleteConfirmDialog.vue'
import type { Location } from '~~/shared/types/inventory'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { fetchLocations } = useInventory()

const areaId = computed(() => Number(route.params.id))

const { data, status, error } = await fetchLocations(areaId.value)

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: t('inventory.error.notFound') })
}

const locations = computed(() => data.value?.data ?? [])
const loadFailed = computed(() => status.value === 'error')

// Resolve the Area name from any Location's embedded area ref (every Area has at
// least the auto-created General Location).
const areaName = computed(() => locations.value.find(l => l.area)?.area?.name ?? '')

// Create Location modal (create-only now — editing moved to the full-page
// /locations/:id/edit screen, D-08; the Pencil affordance navigates there).
const formOpen = ref(false)

function openCreate() {
  formOpen.value = true
}

// Delete (regular Locations only — General has no trigger).
const deleteOpen = ref(false)
const toDelete = ref<Location | null>(null)
function openDelete(location: Location) {
  toDelete.value = location
  deleteOpen.value = true
}

async function refresh() {
  await refreshNuxtData(`inv:area:${areaId.value}:locations`)
}

useSeoMeta({
  title: () => areaName.value || t('inventory.totals.locations'),
})
</script>

<template>
  <section class="space-y-6">
    <Breadcrumbs
      :segments="[
        { label: t('inventory.totals.areas'), to: '/dashboard' },
        { label: areaName },
      ]"
    />

    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="min-w-0 break-words text-3xl font-semibold tracking-tight">
        {{ areaName }}
      </h1>
      <div class="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          class="size-11"
          :aria-label="t('inventory.action.editLabel', { name: areaName })"
          @click="navigateTo(`/areas/${areaId}/edit`)"
        >
          <Pencil />
        </Button>
        <Button class="min-h-11 w-full sm:w-auto" data-testid="add-location" @click="openCreate">
          {{ t('inventory.location.create') }}
        </Button>
      </div>
    </header>

    <p v-if="loadFailed" class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('inventory.error.loadFailed') }}
    </p>

    <EmptyState
      v-if="!locations.length"
      :title="t('inventory.empty.locations.title')"
      :body="t('inventory.empty.locations.body')"
    >
      <Button @click="openCreate">{{ t('inventory.location.create') }}</Button>
    </EmptyState>

    <Card v-else class="p-2">
      <ul class="divide-y">
        <li
          v-for="location in locations"
          :key="location.id"
          :data-testid="location.is_general === true ? 'location-general' : 'location-row'"
          class="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 py-3 hover:bg-muted"
        >
          <NuxtLink :to="`/locations/${location.id}`" class="flex min-h-11 min-w-0 flex-1 items-center gap-3">
            <!-- Location cover thumbnail (D-09) — first photo, else a placeholder. -->
            <img
              v-if="location.photos?.[0]"
              :src="location.photos[0].thumb_url"
              :alt="location.name"
              class="size-12 shrink-0 rounded-md object-cover"
            >
            <div
              v-else
              class="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted"
            >
              <ImageIcon class="size-5 text-muted-foreground" />
            </div>
            <span class="truncate text-base">{{ location.name }}</span>
            <span class="ml-2 shrink-0 text-sm text-muted-foreground">
              {{ location.item_count ?? 0 }} {{ t('inventory.totals.items') }}
            </span>
          </NuxtLink>

          <div class="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="size-11"
              :aria-label="t('inventory.action.editLabel', { name: location.name })"
              @click="navigateTo(`/locations/${location.id}/edit`)"
            >
              <Pencil />
            </Button>
            <!-- General (catch-all) Location: NO delete trigger (Gap 3). -->
            <Button
              v-if="location.is_general !== true"
              variant="ghost"
              size="icon"
              data-testid="location-delete"
              class="size-11 text-destructive hover:text-destructive"
              :aria-label="t('inventory.action.deleteLabel', { name: location.name })"
              @click="openDelete(location)"
            >
              <Trash2 />
            </Button>
          </div>
        </li>
      </ul>
    </Card>
  </section>

  <!-- Create-only Location dialog; editing lives at /locations/:id/edit (D-08). -->
  <LocationFormDialog
    v-model:open="formOpen"
    :area-id="areaId"
    @saved="refresh"
  />

  <DeleteConfirmDialog
    v-model:open="deleteOpen"
    subject="location"
    :location="toDelete"
    @confirmed="refresh"
  />
</template>
