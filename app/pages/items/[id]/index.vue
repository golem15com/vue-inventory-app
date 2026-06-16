<script setup lang="ts">
/**
 * /items/[id] — the read-only View Item screen (D-03 / D-04 / D-05).
 *
 * Auth-guarded (UX redirect only; the backend jwt.auth + accessibleBy scope is the
 * real boundary). Hydrates the Item via the SSR read composable and throws a 404 on
 * a missing/inaccessible id — the copy is the generic inventory.error.notFound (no
 * existence enumeration of foreign records, the security copy rule).
 *
 * This is READ-FIRST: it SHOWS where the item lives and what it is, with editing one
 * deliberate click away behind the Edit button (→ /items/:id/edit, which reuses the
 * item form). Renders at the shared max-w-5xl reading width, square, headers-in-cards.
 * Desktop = details-left / photo-right; mobile = details FIRST,
 * photo gallery LAST (the user explicitly cares about this order).
 *
 * Photo precedence (D-05): item own photo → else the Location's first photo (with a
 * muted "Location photo" honesty hint) → else the Package placeholder + noPhoto
 * caption. The location.photos embed arrives via the 10-02 serializer change and
 * typechecks via the 10-01 EmbeddedLocation widening.
 */
import { computed } from 'vue'
import { Package } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import LocationPhotoBadge from '~/components/inventory/LocationPhotoBadge.vue'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { fetchItem } = useInventory()

const { data, error } = await fetchItem(Number(route.params.id))

if (error.value || !data.value?.data) {
  throw createError({ statusCode: 404, statusMessage: t('inventory.error.notFound') })
}

const item = computed(() => data.value!.data)

// "{Location} · {Area}" — the same join the search row uses (SearchResultRow.vue:26-27).
const whereItLives = computed(() =>
  [item.value.location?.name, item.value.area?.name].filter(Boolean).join(' · '),
)

/** The Location's first photo — the D-05 fallback when the item has none. */
const locationPhoto = computed(() => item.value.location?.photos?.[0] ?? null)

useSeoMeta({
  title: () => item.value.name,
})
</script>

<template>
  <section class="space-y-6">
    <!-- Desktop: details (2 cols) left, photos (1 col) right. Mobile: details first, photos last. -->
    <div class="flex flex-col gap-6 lg:grid lg:grid-cols-3">
      <!-- DETAILS (left / first) -->
      <Card class="bg-card border p-6 lg:col-span-2">
        <div class="space-y-6">
          <!-- Name + the one --primary Edit CTA -->
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h1 class="min-w-0 break-words text-3xl font-semibold tracking-tight">
              {{ item.name }}
            </h1>
            <Button
              class="min-h-11 shrink-0"
              data-testid="item-edit"
              @click="navigateTo(`/items/${item.id}/edit`)"
            >
              {{ t('inventory.item.edit') }}
            </Button>
          </div>

          <!-- Where it lives -->
          <p v-if="whereItLives" class="text-sm text-muted-foreground">
            {{ whereItLives }}
          </p>

          <!-- Quantity (only if present) + category + tags as square muted chips -->
          <div
            v-if="item.quantity != null || item.category || item.tags.length"
            class="flex flex-wrap items-center gap-2"
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

          <!-- Description / notes -->
          <p
            v-if="item.description"
            class="whitespace-pre-line text-base leading-normal"
          >
            {{ item.description }}
          </p>
        </div>
      </Card>

      <!-- PHOTO GALLERY (right / last) -->
      <Card class="bg-card border p-6">
        <!-- 1. Item's own photos -->
        <ul v-if="item.photos.length" class="flex flex-wrap gap-4">
          <li v-for="photo in item.photos" :key="photo.id">
            <a :href="photo.url" target="_blank" rel="noopener" class="block">
              <img
                :src="photo.thumb_url || photo.url"
                :alt="item.name"
                class="size-24 rounded-md object-cover"
              >
            </a>
          </li>
        </ul>

        <!-- 2. D-05 fallback: the Location's first photo + muted honesty hint -->
        <div v-else-if="locationPhoto" class="relative inline-block">
          <a :href="locationPhoto.url" target="_blank" rel="noopener" class="block">
            <img
              :src="locationPhoto.url"
              :alt="item.name"
              class="size-24 rounded-md object-cover"
            >
          </a>
          <LocationPhotoBadge />
        </div>

        <!-- 3. No photo anywhere: placeholder + muted caption -->
        <div v-else class="flex flex-col items-start gap-2">
          <div class="flex size-24 items-center justify-center rounded-md bg-muted">
            <Package class="size-6 text-muted-foreground" />
          </div>
          <p class="text-sm text-muted-foreground">{{ t('inventory.item.noPhoto') }}</p>
        </div>
      </Card>
    </div>
  </section>
</template>
