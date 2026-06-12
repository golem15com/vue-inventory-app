<script setup lang="ts">
/**
 * Dashboard (D-04 / D-09) — the Inventory home.
 *
 * Pure composition over the Plan 02 foundation (useInventory reads + the Pinia
 * store) and the Plan 03 components (AreaCard, EmptyState, AreaFormDialog,
 * DeleteConfirmDialog). Two top-level branches:
 *
 *   - ZERO Areas → the first-run guided hero (D-09): one centered EmptyState with
 *     the single accent "Create your first Area" CTA opening AreaFormDialog.
 *   - Otherwise → space-y-8 sections (UI-SPEC §"Dashboard composition"):
 *       1. Totals strip   (Areas / Locations / Items / Categories)
 *       2. Quick-add Item  (the one accent CTA, → /items/new cross-Area path)
 *       3. Area cards      (owner-only delete via AreaCard → DeleteConfirmDialog)
 *       4. Recent items    (up to 8, "where it lives" line + thumbnail)
 *
 * Auth-guarded (UX redirect only; the backend jwt.auth + accessibleBy scope is the
 * real boundary, T-05-16). The dashboard renders ONLY the Areas the scoped API
 * returns — a foreign Area is structurally absent (never a disabled card). All
 * names render via {{ }} interpolation, never v-html (T-05-17).
 */
import { computed, ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import AreaCard from '~/components/inventory/AreaCard.vue'
import AreaFormDialog from '~/components/inventory/AreaFormDialog.vue'
import DeleteConfirmDialog from '~/components/inventory/DeleteConfirmDialog.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import type { Area } from '~~/shared/types/inventory'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const { fetchAreas, fetchRecent, fetchCategories } = useInventory()

// SSR reads (PATTERNS "SSR envelope → computed").
const { data: areasData, status } = await fetchAreas()
const { data: recentData } = await fetchRecent(8)
const { data: categoriesData } = await fetchCategories()

const areas = computed(() => areasData.value?.data ?? [])
const recent = computed(() => recentData.value?.data ?? [])
const categories = computed(() => categoriesData.value?.data ?? [])

const loadFailed = computed(() => status.value === 'error')

// Totals strip figures (UI-SPEC §"Dashboard composition" point 1).
const totalLocations = computed(() =>
  areas.value.reduce((sum, a) => sum + (a.location_count ?? 0), 0),
)
const totalItems = computed(() =>
  areas.value.reduce((sum, a) => sum + (a.item_count ?? 0), 0),
)

const totals = computed(() => [
  { key: 'areas', value: areas.value.length, caption: t('inventory.totals.areas') },
  { key: 'locations', value: totalLocations.value, caption: t('inventory.totals.locations') },
  { key: 'items', value: totalItems.value, caption: t('inventory.totals.items') },
  { key: 'categories', value: categories.value.length, caption: t('inventory.totals.categories') },
])

// "Where it lives" line for a Recent item: "{Location} · {Area}".
function whereItLives(location?: { name: string } | null, area?: { name: string } | null): string {
  return [location?.name, area?.name].filter(Boolean).join(' · ')
}

// AreaFormDialog (create) modal state.
const createOpen = ref(false)

// DeleteConfirmDialog state — opened by an AreaCard `delete` emit.
const deleteOpen = ref(false)
const areaToDelete = ref<Area | null>(null)

function onAreaDelete(area: Area) {
  areaToDelete.value = area
  deleteOpen.value = true
}

async function onAreaSaved() {
  // The store already refreshNuxtData('inv:areas')s; refresh again defensively so
  // the totals strip + cards re-render immediately after the dialog closes.
  await refreshNuxtData('inv:areas')
}

useSeoMeta({
  title: () => t('inventory.totals.areas'),
})
</script>

<template>
  <!-- First-run guided hero (D-09): zero Areas → ONLY this. -->
  <section v-if="!areas.length" class="flex min-h-[60vh] items-center justify-center">
    <EmptyState
      variant="firstRun"
      :title="t('inventory.empty.firstArea.title')"
      :body="t('inventory.empty.firstArea.body')"
    >
      <Button data-testid="create-area" @click="createOpen = true">
        {{ t('inventory.empty.firstArea.cta') }}
      </Button>
    </EmptyState>
  </section>

  <!-- Dashboard sections (UI-SPEC §"Dashboard composition"). -->
  <section v-else class="space-y-8">
    <p v-if="loadFailed" class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('inventory.error.loadFailed') }}
    </p>

    <!-- 1. Totals strip -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="totals">
      <Card v-for="total in totals" :key="total.key" class="bg-card p-4">
        <p class="text-3xl font-semibold">{{ total.value }}</p>
        <p class="text-sm text-muted-foreground">{{ total.caption }}</p>
      </Card>
    </div>

    <!-- 2. Quick-add Item — the one accent CTA on the dashboard. -->
    <div>
      <Button @click="navigateTo('/items/new')">
        {{ t('inventory.item.quickAdd') }}
      </Button>
    </div>

    <!-- 3. Area cards -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">{{ t('inventory.totals.areas') }}</h2>
        <Button data-testid="create-area" @click="createOpen = true">
          {{ t('inventory.area.create') }}
        </Button>
      </div>
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AreaCard
          v-for="area in areas"
          :key="area.id"
          :area="area"
          @delete="onAreaDelete"
        />
      </div>
    </div>

    <!-- 4. Recent items -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{{ t('inventory.totals.items') }}</h2>
      <Card class="p-2">
        <ul v-if="recent.length" class="divide-y">
          <li v-for="item in recent" :key="item.id">
            <NuxtLink
              :to="`/items/${item.id}`"
              class="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
            >
              <img
                v-if="item.photos?.[0]"
                :src="item.photos[0].thumb_url"
                :alt="item.name"
                class="size-12 rounded-md object-cover"
              >
              <div class="min-w-0">
                <p class="truncate font-semibold">{{ item.name }}</p>
                <p class="truncate text-sm text-muted-foreground">
                  {{ whereItLives(item.location, item.area) }}
                </p>
              </div>
            </NuxtLink>
          </li>
        </ul>
        <p v-else class="px-2 py-6 text-center text-sm text-muted-foreground">
          {{ t('inventory.empty.recent.title') }}
        </p>
      </Card>
    </div>
  </section>

  <!-- Create-Area modal (shared by the first-run hero + the cards header). -->
  <AreaFormDialog v-model:open="createOpen" @saved="onAreaSaved" />

  <!-- Owner-only Area delete (opened from an AreaCard `delete` emit). -->
  <DeleteConfirmDialog
    v-model:open="deleteOpen"
    subject="area"
    :area="areaToDelete"
    @confirmed="onAreaSaved"
  />
</template>
