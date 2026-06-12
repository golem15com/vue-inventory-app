<script setup lang="ts">
/**
 * Terms of Use `/terms` (D-08) — public, unauthenticated (SC-2).
 *
 * Static reading page on the public layout: acceptable use, your content,
 * no warranty, and the draft-status caveat. Carries the draft notice.
 * All copy via t(); no raw HTML (T-09-10); no Inventory API reads (T-09-09).
 */
definePageMeta({ layout: 'public' })

const { t } = useI18n()

const sections = ['use', 'content', 'warranty', 'draft'] as const

useSeoMeta({ title: () => t('public.terms.title') })
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-12 space-y-6">
    <h1 class="text-3xl font-semibold">{{ t('public.terms.title') }}</h1>

    <div class="rounded-md border bg-muted p-4 text-sm text-muted-foreground">
      {{ t('public.terms.draftNotice') }}
    </div>

    <p class="text-base text-foreground">{{ t('public.terms.intro') }}</p>

    <section v-for="key in sections" :key="key" class="space-y-2">
      <h2 class="text-base font-semibold">{{ t(`public.terms.${key}.title`) }}</h2>
      <p class="text-base text-foreground">{{ t(`public.terms.${key}.body`) }}</p>
    </section>
  </article>
</template>
