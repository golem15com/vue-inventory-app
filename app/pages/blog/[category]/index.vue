<script setup lang="ts">
/**
 * Blog category page (demo — D-11). SSR-renders posts filtered by the
 * `category` route param against /_journal/api/v1/posts?category=:slug.
 * Re-pointed from queststream's WC target; locale-keyed via useBlog.
 */
const { t } = useI18n()
const route = useRoute()
const { fetchPosts, fetchCategories } = useBlog()

const categorySlug = computed(() => route.params.category as string)

const page = computed(() => {
  const p = Number(route.query.page)
  return Number.isFinite(p) && p > 0 ? p : 1
})

const { data: postsData, status } = await fetchPosts({
  category: categorySlug.value,
  page: page.value,
  perPage: 9,
})
const { data: categoriesData } = await fetchCategories()

const posts = computed(() => postsData.value?.data ?? [])
const meta = computed(() => postsData.value?.meta)
const category = computed(() =>
  categoriesData.value?.data?.find(c => c.slug === categorySlug.value),
)
const categoryName = computed(() => category.value?.name ?? categorySlug.value)

const hasPrev = computed(() => (meta.value?.current_page ?? 1) > 1)
const hasNext = computed(() => (meta.value?.current_page ?? 1) < (meta.value?.last_page ?? 1))

useSeoMeta({
  title: () => `${categoryName.value} — ${t('blog.title')}`,
  description: () => category.value?.description ?? t('blog.subtitle'),
  ogTitle: () => `${categoryName.value} — ${t('blog.title')}`,
  ogDescription: () => category.value?.description ?? t('blog.subtitle'),
})
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink to="/blog" class="text-sm text-muted-foreground hover:underline">
        ← {{ t('blog.backToBlog') }}
      </NuxtLink>
      <h1 class="text-3xl font-semibold tracking-tight">{{ categoryName }}</h1>
      <p v-if="category?.description" class="text-muted-foreground">
        {{ category.description }}
      </p>
    </header>

    <p v-if="status === 'pending'" class="text-muted-foreground">…</p>

    <template v-else-if="posts.length">
      <ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="post in posts"
          :key="post.id"
          class="overflow-hidden rounded-lg border"
        >
          <NuxtLink :to="`/blog/${categorySlug}/${post.slug}`" class="block">
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
            </div>
          </NuxtLink>
        </li>
      </ul>

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

    <p v-else class="text-muted-foreground">{{ t('blog.noPosts') }}</p>
  </section>
</template>
