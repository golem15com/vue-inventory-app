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
import { Pencil, Trash2 } from '@lucide/vue'
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

// Create / edit Location modal.
const formOpen = ref(false)
const editing = ref<Location | null>(null)

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(location: Location) {
  editing.value = location
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
        { label: t('inventory.totals.areas'), to: '/' },
        { label: areaName },
      ]"
    />

    <header class="flex items-center justify-between">
      <h1 class="text-3xl font-semibold tracking-tight">
        {{ areaName }}
      </h1>
      <Button data-testid="add-location" @click="openCreate">
        {{ t('inventory.location.create') }}
      </Button>
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
          class="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted"
        >
          <NuxtLink :to="`/locations/${location.id}`" class="min-w-0 flex-1">
            <span class="text-base">{{ location.name }}</span>
            <span class="ml-2 text-sm text-muted-foreground">
              {{ location.item_count ?? 0 }} {{ t('inventory.totals.items') }}
            </span>
          </NuxtLink>

          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="t('inventory.action.editLabel', { name: location.name })"
              @click="openEdit(location)"
            >
              <Pencil />
            </Button>
            <!-- General (catch-all) Location: NO delete trigger (Gap 3). -->
            <Button
              v-if="location.is_general !== true"
              variant="ghost"
              size="icon-sm"
              data-testid="location-delete"
              class="text-destructive hover:text-destructive"
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

  <LocationFormDialog
    v-model:open="formOpen"
    :area-id="areaId"
    :existing="editing"
    @saved="refresh"
  />

  <DeleteConfirmDialog
    v-model:open="deleteOpen"
    subject="location"
    :location="toDelete"
    @confirmed="refresh"
  />
</template>
