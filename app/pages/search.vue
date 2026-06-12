<script setup lang="ts">
/**
 * /search (D-01) — the felt center of gravity: "type a name, see where it lives."
 *
 * Pure composition over the Wave-1/2 building blocks plus the net-new behaviors
 * that have no codebase analog:
 *   - fetchSearch (Plan 02): a reactive seven-param read on the stable inv:search
 *     key — mutating the reactive query re-runs the fetch AND auto-aborts the prior
 *     in-flight request (RESEARCH Pattern 1A); no hand-rolled cancel.
 *   - SearchFilterBar + SearchResultRow (Plan 03): the filter wrapper (inline bar /
 *     mobile bottom-sheet + Area→Location cascade + active chips) and the result row.
 *   - watchDebounced 300ms (UI-SPEC-locked): debounce the live query; never setTimeout.
 *   - URL ⇄ state: hydrate q/filters/page ONCE on setup, then router.replace (NOT
 *     push, NOT a route→state watch — Pitfall 4 feedback loop) with pruned empties so
 *     the search is deep-linkable and rehydrates on refresh.
 *   - Load-more accumulation: useFetch REPLACES data per run (Pitfall 2), so results
 *     accumulate into a separate ref — replace on page 1, append on Load-more.
 *
 * Security: the page renders EXACTLY what the server returns and performs NO
 * client-side access filtering (T-06-12 / T-05-04 precedent — the server
 * double-scopes). Names render through SearchResultRow's {{ }} interpolation only —
 * never raw HTML injection (T-06-11). The query/filters are typed reads from
 * useRoute().query, passed
 * to fetchSearch as a typed query object — never concatenated into markup.
 *
 * Auth-guarded (UX redirect only; the backend jwt.auth + accessibleBy scope is the
 * real boundary).
 */
import { computed, reactive, ref, watch } from 'vue'
import { Search } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import SearchFilterBar, { type SearchFilters } from '~/components/inventory/SearchFilterBar.vue'
import SearchResultRow from '~/components/inventory/SearchResultRow.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import type { LocationQueryRaw } from 'vue-router'
import type { Item, Meta } from '~~/shared/types/inventory'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { fetchSearch } = useInventory()

const PER_PAGE = 20

// --- URL hydrate-once (RESEARCH Pattern 2) — never watch route.query back into
// state (Pitfall 4 feedback loop). These reads run a single time on setup. ---
const q = ref((route.query.q as string) ?? '')
const filters = reactive<SearchFilters>({
  area: route.query.area ? Number(route.query.area) : null,
  location: route.query.location ? Number(route.query.location) : null,
  category: route.query.category ? Number(route.query.category) : null,
  tag: route.query.tag ? Number(route.query.tag) : null,
})
const page = ref(route.query.page ? Number(route.query.page) : 1)
const debouncedQ = ref(q.value)

// --- Debounce (300ms, UI-SPEC-locked) + immediate filter reset; both reset page. ---
watchDebounced(q, (v) => {
  debouncedQ.value = v
  page.value = 1
}, { debounce: 300 })

watch(() => ({ ...filters }), () => {
  page.value = 1
}, { deep: true })

// The reactive query drives fetchSearch to re-run + auto-abort the prior request.
const searchQuery = computed(() => ({
  q: debouncedQ.value,
  area: filters.area,
  location: filters.location,
  category: filters.category,
  tag: filters.tag,
  page: page.value,
  per_page: PER_PAGE,
}))

const { data, status } = fetchSearch(searchQuery)

// --- Load-more accumulation (Pitfall 2: useFetch REPLACES data per run). ---
const results = ref<Item[]>([])
const meta = ref<Meta | null>(null)

watch(data, (d) => {
  if (!d) return
  results.value = page.value === 1 ? d.data : [...results.value, ...d.data]
  meta.value = d.meta
}, { immediate: true })

const canLoadMore = computed(
  () => !!meta.value && meta.value.current_page < meta.value.last_page,
)

function loadMore() {
  page.value += 1
}

// --- URL push: replace (NOT push), prune empties (Pattern 2). ---
function pruneEmpty(obj: LocationQueryRaw): LocationQueryRaw {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

watch([debouncedQ, () => ({ ...filters }), page], () => {
  router.replace({
    query: pruneEmpty({
      q: debouncedQ.value || undefined,
      area: filters.area ?? undefined,
      location: filters.location ?? undefined,
      category: filters.category ?? undefined,
      tag: filters.tag ?? undefined,
      page: page.value > 1 ? page.value : undefined,
    }),
  })
}, { deep: true })

// --- Derived view states. ---
const hasActiveCriteria = computed(
  () => debouncedQ.value.trim().length > 0
    || filters.area !== null
    || filters.location !== null
    || filters.category !== null
    || filters.tag !== null,
)

// Skeleton: pending AND nothing yet to show (first load / criteria change).
const showSkeleton = computed(() => status.value === 'pending' && results.value.length === 0)
const showError = computed(() => status.value === 'error')
// Settled with zero results AND an active query/filter → "no matches".
const showNoMatches = computed(
  () => !showSkeleton.value
    && !showError.value
    && results.value.length === 0
    && hasActiveCriteria.value,
)
// Initial browse: no criteria → the same fetch returns recent under a "Recent" heading.
const showRecentHeading = computed(() => !hasActiveCriteria.value && results.value.length > 0)

const skeletonRows = [0, 1, 2, 3, 4]

useSeoMeta({
  title: () => t('inventory.search.title'),
})
</script>

<template>
  <!-- No container — the layout's <main mx-auto w-full max-w-5xl px-4 py-8> owns it. -->
  <section class="space-y-8">
    <!-- Live query box (no submit needed — debounced auto-search). -->
    <div class="relative">
      <Search class="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        v-model="q"
        data-testid="search-input"
        :placeholder="t('inventory.search.placeholder')"
        :aria-label="t('inventory.search.label')"
        class="min-h-11 w-full pl-10 text-base"
      />
    </div>

    <!-- Filter bar (owns inline-bar / mobile bottom-sheet + cascade + chips + clear). -->
    <SearchFilterBar v-model="filters" />

    <!-- Error banner (dashboard pattern). -->
    <p
      v-if="showError"
      class="rounded-md border border-destructive/40 p-4 text-sm text-destructive"
    >
      {{ t('inventory.search.error') }}
    </p>

    <!-- Recent heading for the initial browse mode. -->
    <h2 v-if="showRecentHeading" class="text-lg font-semibold">
      {{ t('inventory.search.recent') }}
    </h2>

    <!-- Results / skeleton / empty. -->
    <template v-if="!showError">
      <!-- Skeleton rows while the first page loads (NOT a spinner). -->
      <Card v-if="showSkeleton" class="p-2">
        <ul class="divide-y">
          <li
            v-for="row in skeletonRows"
            :key="row"
            class="flex items-center gap-4 px-2 py-4"
          >
            <div class="size-12 shrink-0 animate-pulse rounded-md bg-muted" />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div class="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </li>
        </ul>
      </Card>

      <!-- No matches for an active query/filter. -->
      <EmptyState
        v-else-if="showNoMatches"
        :title="t('inventory.search.empty.title')"
        :body="t('inventory.search.empty.body')"
      />

      <!-- Result rows. -->
      <Card v-else-if="results.length" class="p-2">
        <ul class="divide-y">
          <li v-for="item in results" :key="item.id">
            <SearchResultRow :item="item" />
          </li>
        </ul>
      </Card>

      <!-- Load more (hidden when on the last page). -->
      <div v-if="canLoadMore" class="flex justify-center">
        <Button
          data-testid="load-more"
          variant="outline"
          class="min-h-11"
          @click="loadMore"
        >
          {{ t('inventory.search.loadMore') }}
        </Button>
      </div>
    </template>
  </section>
</template>
