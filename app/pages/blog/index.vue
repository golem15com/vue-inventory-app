<script setup lang="ts">
/**
 * Blog index (demo page — D-11; clients gut this and keep the wiring).
 *
 * SSR-renders a paginated list of PUBLISHED posts from /_journal/api/v1/posts
 * via useBlog(), with pagination controls and a category nav. Locale-keyed:
 * useBlog's watch:[locale] refetches on locale switch for SSR/client parity.
 *
 * Lifted (structure + data-flow) from queststream pages/blog/index.vue,
 * re-pointed to the Journal contract and stripped of queststream-specific
 * components — this uses plain Tailwind + the starter's runtimeConfig wiring.
 */
const { t } = useI18n()
const route = useRoute()
const { fetchPosts, fetchCategories } = useBlog()

// Page from the query string so ?page=N is SSR-fetched and shareable.
const page = computed(() => {
  const p = Number(route.query.page)
  return Number.isFinite(p) && p > 0 ? p : 1
})

// SSR fetches — keyed + watch:[locale] inside useBlog. `page` is reactive in
// the key so navigating ?page=N refetches.
const { data: postsData, status } = await fetchPosts({ page: page.value, perPage: 9 })
const { data: categoriesData } = await fetchCategories()

const posts = computed(() => postsData.value?.data ?? [])
const meta = computed(() => postsData.value?.meta)
const categories = computed(() => categoriesData.value?.data ?? [])

const hasPrev = computed(() => (meta.value?.current_page ?? 1) > 1)
const hasNext = computed(() => (meta.value?.current_page ?? 1) < (meta.value?.last_page ?? 1))

useSeoMeta({
  title: () => t('blog.title'),
  description: () => t('blog.subtitle'),
  ogTitle: () => t('blog.title'),
  ogDescription: () => t('blog.subtitle'),
})
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight">{{ t('blog.title') }}</h1>
      <p class="text-muted-foreground">{{ t('blog.subtitle') }}</p>
    </header>

    <!-- Category nav → /blog/:category -->
    <nav v-if="categories.length" class="flex flex-wrap gap-2">
      <NuxtLink
        to="/blog"
        class="rounded-full border px-3 py-1 text-sm hover:bg-muted"
      >
        {{ t('blog.allCategories') }}
      </NuxtLink>
      <NuxtLink
        v-for="cat in categories"
        :key="cat.id"
        :to="`/blog/${cat.slug}`"
        class="rounded-full border px-3 py-1 text-sm hover:bg-muted"
      >
        {{ cat.name }}
        <span class="text-muted-foreground">({{ cat.post_count }})</span>
      </NuxtLink>
    </nav>

    <!-- Loading -->
    <p v-if="status === 'pending'" class="text-muted-foreground">…</p>

    <!-- Post list -->
    <template v-else-if="posts.length">
      <ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="post in posts"
          :key="post.id"
          class="overflow-hidden rounded-lg border"
        >
          <NuxtLink
            :to="`/blog/${post.categories?.[0]?.slug ?? 'uncategorized'}/${post.slug}`"
            class="block"
          >
            <img
              v-if="post.featured_image_url"
              :src="post.featured_image_url"
              :alt="post.title"
              width="400"
              height="225"
              class="aspect-video w-full object-cover"
            >
            <div class="space-y-2 p-4">
              <h2 class="font-semibold leading-snug">{{ post.title }}</h2>
              <p v-if="post.excerpt" class="line-clamp-3 text-sm text-muted-foreground">
                {{ post.excerpt }}
              </p>
              <p v-if="post.reading_time" class="text-xs text-muted-foreground">
                {{ post.reading_time }} {{ t('blog.minRead') }}
              </p>
            </div>
          </NuxtLink>
        </li>
      </ul>

      <!-- Pagination from meta -->
      <nav
        v-if="meta && meta.last_page > 1"
        class="flex items-center justify-between border-t pt-4"
      >
        <NuxtLink
          v-if="hasPrev"
          :to="{ query: { page: (meta.current_page - 1) || undefined } }"
          class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          ← {{ t('blog.prevPage') }}
        </NuxtLink>
        <span v-else />

        <span class="text-sm text-muted-foreground">
          {{ t('blog.pageOf', { current: meta.current_page, last: meta.last_page }) }}
        </span>

        <NuxtLink
          v-if="hasNext"
          :to="{ query: { page: meta.current_page + 1 } }"
          class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          {{ t('blog.nextPage') }} →
        </NuxtLink>
        <span v-else />
      </nav>
    </template>

    <!-- Empty -->
    <p v-else class="text-muted-foreground">{{ t('blog.noPosts') }}</p>
  </section>
</template>
