<script setup lang="ts">
/**
 * Help & Getting Started `/help` (D-09) — public, unauthenticated (SC-2).
 *
 * Static reading page on the public layout: a "How it works" intro (Areas →
 * Locations → Items, search, photo AI, sharing) plus a short FAQ rendered as
 * stacked bg-card rows — NO accordion dependency.
 * All copy via t(); no raw HTML (T-09-10); no Inventory API reads (T-09-09).
 */
definePageMeta({ layout: 'public' })

const { t } = useI18n()

const faq = ['search', 'ai', 'sharing', 'delete'] as const

useSeoMeta({ title: () => t('public.help.title') })
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-12 space-y-6">
    <h1 class="text-3xl font-semibold">{{ t('public.help.title') }}</h1>

    <p class="text-base text-foreground">{{ t('public.help.intro') }}</p>

    <section class="space-y-2">
      <h2 class="text-base font-semibold">{{ t('public.help.howItWorks.title') }}</h2>
      <p class="text-base text-foreground">{{ t('public.help.howItWorks.body') }}</p>
    </section>

    <dl class="space-y-4">
      <div v-for="key in faq" :key="key" class="space-y-2 rounded-md border bg-card p-4">
        <dt class="text-base font-semibold">{{ t(`public.help.faq.${key}.q`) }}</dt>
        <dd class="text-base text-foreground">{{ t(`public.help.faq.${key}.a`) }}</dd>
      </div>
    </dl>
  </article>
</template>
