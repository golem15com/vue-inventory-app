<script setup lang="ts">
/**
 * SearchResultRow — a presentational search-result row.
 *
 * Mirrors the dashboard recent-items row (pages/index.vue lines 146–171): a
 * whole-row NuxtLink to /items/[id]. Two intentional departures-from-verbatim:
 *  - the flex gap is bumped to gap-4 (the LOCKED UI-SPEC spacing scale allows
 *    only 4/8/16/24/32/48/64 — the smaller dashboard gap is disallowed here).
 *  - py-2 becomes py-4 so the full-row tap target clears 44px on mobile (Pitfall 1).
 *
 * Extends the dashboard row (D-08): a placeholder thumbnail when the Item has no
 * photo, a quantity badge, and category + tag chips (plain muted spans, NOT an
 * accent). All text renders via mustache interpolation (Vue auto-escapes), never
 * raw HTML injection — a server-returned name/location/category/tag cannot
 * inject markup (T-06-06).
 */
import { computed } from 'vue'
import { Package } from '@lucide/vue'
import LocationPhotoBadge from '~/components/inventory/LocationPhotoBadge.vue'
import type { Item } from '~~/shared/types/inventory'

const props = defineProps<{
  item: Item
}>()

// "{Location} · {Area}" — same join the dashboard uses (index.vue lines 63–65).
const whereItLives = computed(() =>
  [props.item.location?.name, props.item.area?.name].filter(Boolean).join(' · '),
)
</script>

<template>
  <NuxtLink
    :to="`/items/${item.id}`"
    data-testid="search-result-row"
    class="flex items-center gap-4 rounded-md px-2 py-4 hover:bg-muted"
  >
    <!--
      Thumbnail precedence (D-05): the Item's own photo → else its Location's first
      photo (with a muted "Location photo" honesty hint) → else the Package
      placeholder. The hint is a quiet caption, never an accent/CTA — borrowing the
      Location's photo is disclosed, not celebrated.
    -->
    <img
      v-if="item.photos?.[0]"
      :src="item.photos[0].thumb_url"
      :alt="item.name"
      class="size-12 shrink-0 rounded-md object-cover"
    >
    <div
      v-else-if="item.location?.photos?.[0]"
      class="relative size-12 shrink-0"
    >
      <img
        :src="item.location.photos[0].thumb_url"
        :alt="item.name"
        class="size-12 rounded-md object-cover"
      >
      <LocationPhotoBadge />
    </div>
    <div
      v-else
      class="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted"
    >
      <Package class="size-5 text-muted-foreground" />
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate font-semibold">{{ item.name }}</p>
      <p class="truncate text-sm text-muted-foreground">{{ whereItLives }}</p>

      <!-- Quantity badge + category/tag chips (informational, muted — not accents). -->
      <div
        v-if="item.quantity != null || item.category || item.tags.length"
        class="mt-1 flex flex-wrap items-center gap-1"
      >
        <span
          v-if="item.quantity != null"
          class="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-sm"
        >
          {{ item.quantity }}
        </span>
        <span
          v-if="item.category"
          class="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-sm"
        >
          {{ item.category.name }}
        </span>
        <span
          v-for="tag in item.tags"
          :key="tag.id"
          class="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-sm"
        >
          {{ tag.name }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
