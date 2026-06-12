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
import { Search, Sparkles } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import AreaCard from '~/components/inventory/AreaCard.vue'
import AreaFormDialog from '~/components/inventory/AreaFormDialog.vue'
import DeleteConfirmDialog from '~/components/inventory/DeleteConfirmDialog.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import { useAuthStore } from '~/stores/auth'
import { storeToRefs } from 'pinia'
import type { Area } from '~~/shared/types/inventory'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const { fetchAreas, fetchRecent, fetchCategories } = useInventory()

// AI gate (D-14/D-15): read `can_use_ai` from the auth store (hydrated from the
// me/areas envelope) — the AI button is structurally ABSENT for non-AI users
// (hide-not-dim; no teaser, no greyed-out affordance). The server 403 (Plan 01)
// is the real boundary; this v-if is convenience only.
const auth = useAuthStore()
const { canUseAi } = storeToRefs(auth)

// Prominent dashboard search box (D-02) — the same goSearch on-ramp as the
// top bar. The typed query is handed to router.push as a structured
// `query: { q }` object (Nuxt encodes it); never concatenated (T-06-09).
const router = useRouter()
const topbarQ = ref('')

function goSearch() {
  router.push({ path: '/search', query: topbarQ.value ? { q: topbarQ.value } : {} })
}

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
      <Button class="min-h-11" data-testid="create-area" @click="createOpen = true">
        {{ t('inventory.empty.firstArea.cta') }}
      </Button>
    </EmptyState>
  </section>

  <!-- Dashboard sections (UI-SPEC §"Dashboard composition"). -->
  <section v-else class="space-y-8">
    <!-- Hero heading — whereiput.it mark beside the page title (09-03 checkpoint). -->
    <div class="flex items-center gap-2">
      <img
        src="/brand/logo.png"
        :alt="t('inventory.dashboard.brandAlt')"
        class="h-8 w-auto"
        width="32"
        height="32"
      >
      <h1 class="text-base font-semibold tracking-tight">{{ t('inventory.dashboard.title') }}</h1>
    </div>

    <p v-if="loadFailed" class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('inventory.error.loadFailed') }}
    </p>

    <!-- 0. Prominent dashboard search box (D-02) — the one accent on-ramp.
         Routes to /search via the shared goSearch, reusing the layout pattern. -->
    <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="goSearch">
      <div class="relative min-w-0 flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="topbarQ"
          :placeholder="t('inventory.search.placeholder')"
          :aria-label="t('inventory.search.label')"
          class="min-h-11 w-full pl-10 text-base"
          data-testid="dashboard-search-input"
        />
      </div>
      <Button type="submit" class="min-h-11 sm:w-auto">
        {{ t('inventory.search.title') }}
      </Button>
    </form>

    <!-- 1. Totals strip -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="totals">
      <Card v-for="total in totals" :key="total.key" class="bg-card p-4">
        <p class="text-3xl font-semibold">{{ total.value }}</p>
        <p class="text-sm text-muted-foreground">{{ total.caption }}</p>
      </Card>
    </div>

    <!-- 2. Quick-add Item + AI catalog entry (the dashboard's one accent cluster). -->
    <div class="flex items-center gap-3 flex-wrap">
      <Button class="min-h-11 w-full sm:w-auto" @click="navigateTo('/items/new')">
        {{ t('inventory.item.quickAdd') }}
      </Button>
      <Button
        v-if="canUseAi"
        class="min-h-11 w-full sm:w-auto"
        :aria-label="t('inventory.aiAssist.entryLabel')"
        @click="navigateTo('/ai-assist')"
      >
        <Sparkles class="size-4" />
        {{ t('inventory.aiAssist.entry') }}
      </Button>
    </div>

    <!-- 3. Area cards -->
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-semibold">{{ t('inventory.totals.areas') }}</h2>
        <Button class="min-h-11" data-testid="create-area" @click="createOpen = true">
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
      <h2 class="text-base font-semibold">{{ t('inventory.totals.items') }}</h2>
      <Card class="p-2">
        <ul v-if="recent.length" class="divide-y">
          <li v-for="item in recent" :key="item.id">
            <NuxtLink
              :to="`/items/${item.id}`"
              class="flex min-h-11 items-center gap-3 rounded-md px-2 py-3 hover:bg-muted"
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
