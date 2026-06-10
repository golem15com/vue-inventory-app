<script setup lang="ts">
/**
 * Blog post detail (demo — D-11). SSR-renders a single PUBLISHED post from
 * /_journal/api/v1/posts/{slug} with prev/next/related navigation and per-post
 * @nuxtjs/seo meta. Re-pointed from queststream's WC target; locale-keyed.
 *
 * SECURITY (T-17-10 / V5 — Info Disclosure/XSS): we `v-html` ONLY the backend
 * `content_html` field, which is pre-rendered and trusted by the Journal
 * plugin. We NEVER v-html user-supplied input (route params, search terms);
 * all such values flow through Vue's auto-escaping interpolation. Anonymous
 * callers receive published posts only — drafts 404 (backend-enforced).
 */
const { t } = useI18n()
const route = useRoute()
const { fetchPost } = useBlog()

const slug = computed(() => route.params.slug as string)
const categorySlug = computed(() => route.params.category as string)

const { data: postData, error } = await fetchPost(slug.value)

// 404 → Nuxt error page (graceful). Drafts and unknown slugs land here.
if (error.value || !postData.value?.data) {
  throw createError({ statusCode: 404, statusMessage: t('blog.notFound') })
}

const post = computed(() => postData.value!.data)
const previous = computed(() => post.value.previous_post)
const next = computed(() => post.value.next_post)
const related = computed(() => post.value.related_posts ?? [])

// Description fallback: excerpt, else stripped content_html (trusted source).
const description = computed(() => {
  if (post.value.excerpt) return post.value.excerpt
  if (post.value.content_html) {
    return post.value.content_html.replace(/<[^>]*>/g, '').slice(0, 160)
  }
  return ''
})

// Per-post SEO meta (@nuxtjs/seo).
useSeoMeta({
  title: () => post.value.title,
  description: () => description.value,
  ogType: 'article',
  ogTitle: () => post.value.title,
  ogDescription: () => description.value,
  ogImage: () => post.value.featured_image_url ?? undefined,
  articlePublishedTime: () => post.value.published_at ?? undefined,
  articleModifiedTime: () => post.value.updated_at,
})

function authorName(p: typeof post.value): string {
  const a = p.author
  if (!a) return ''
  return [a.first_name, a.last_name].filter(Boolean).join(' ') || a.login
}
</script>

<template>
  <article class="mx-auto max-w-3xl space-y-8">
    <NuxtLink
      :to="`/blog/${categorySlug}`"
      class="text-sm text-muted-foreground hover:underline"
    >
      ← {{ t('blog.backToBlog') }}
    </NuxtLink>

    <header class="space-y-4">
      <div v-if="post.categories?.length" class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="cat in post.categories"
          :key="cat.id"
          :to="`/blog/${cat.slug}`"
          class="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
        >
          {{ cat.name }}
        </NuxtLink>
      </div>

      <h1 class="text-3xl font-bold tracking-tight md:text-4xl">{{ post.title }}</h1>

      <div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span v-if="post.author">{{ authorName(post) }}</span>
        <span v-if="post.published_at">{{ post.published_at }}</span>
        <span v-if="post.reading_time">{{ post.reading_time }} {{ t('blog.minRead') }}</span>
      </div>

      <img
        v-if="post.featured_image_url"
        :src="post.featured_image_url"
        :alt="post.title"
        width="768"
        height="432"
        class="aspect-video w-full rounded-lg object-cover"
      >
    </header>

    <!--
      Trusted, pre-rendered backend HTML only (T-17-10). content_html comes from
      the Journal plugin's serializer; it is NEVER user-controlled request input.
    -->
    <div
      v-if="post.content_html"
      class="prose max-w-none dark:prose-invert"
      v-html="post.content_html"
    />

    <!-- Prev / Next navigation -->
    <nav
      v-if="previous || next"
      class="flex items-stretch justify-between gap-4 border-t pt-6"
    >
      <NuxtLink
        v-if="previous"
        :to="`/blog/${categorySlug}/${previous.slug}`"
        class="flex-1 rounded-md border p-4 hover:bg-muted"
      >
        <span class="block text-xs text-muted-foreground">← {{ t('blog.previous') }}</span>
        <span class="font-medium">{{ previous.title }}</span>
      </NuxtLink>
      <span v-else class="flex-1" />

      <NuxtLink
        v-if="next"
        :to="`/blog/${categorySlug}/${next.slug}`"
        class="flex-1 rounded-md border p-4 text-right hover:bg-muted"
      >
        <span class="block text-xs text-muted-foreground">{{ t('blog.next') }} →</span>
        <span class="font-medium">{{ next.title }}</span>
      </NuxtLink>
      <span v-else class="flex-1" />
    </nav>

    <!-- Related posts -->
    <section v-if="related.length" class="space-y-4 border-t pt-6">
      <h2 class="text-xl font-semibold">{{ t('blog.related') }}</h2>
      <ul class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <li
          v-for="rel in related"
          :key="rel.id"
          class="rounded-lg border p-3"
        >
          <NuxtLink
            :to="`/blog/${rel.categories?.[0]?.slug ?? categorySlug}/${rel.slug}`"
            class="block space-y-1"
          >
            <span class="block font-medium leading-snug">{{ rel.title }}</span>
            <span v-if="rel.excerpt" class="line-clamp-2 text-sm text-muted-foreground">
              {{ rel.excerpt }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </article>
</template>
