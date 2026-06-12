<script setup lang="ts">
/**
 * Privacy Policy `/privacy` (D-08) — public, unauthenticated (SC-2).
 *
 * Static reading page on the public layout. Visibly enumerates: account email,
 * item photos, AI photo processing via the Claude API, Typesense indexing,
 * admin-granted Area sharing, and the GDPR delete path. Carries the
 * "Draft — review before production" callout.
 *
 * All copy via t(); no raw HTML (T-09-10); no Inventory API reads (T-09-09).
 */
definePageMeta({ layout: 'public' })

const { t } = useI18n()

const sections = ['email', 'photos', 'ai', 'typesense', 'sharing', 'gdpr'] as const

useSeoMeta({ title: () => t('public.privacy.title') })
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-12 space-y-6">
    <h1 class="text-3xl font-semibold">{{ t('public.privacy.title') }}</h1>

    <div class="rounded-md border bg-muted p-4 text-sm text-muted-foreground">
      {{ t('public.privacy.draftNotice') }}
    </div>

    <p class="text-base text-foreground">{{ t('public.privacy.intro') }}</p>

    <section v-for="key in sections" :key="key" class="space-y-2">
      <h2 class="text-base font-semibold">{{ t(`public.privacy.${key}.title`) }}</h2>
      <p class="text-base text-foreground">{{ t(`public.privacy.${key}.body`) }}</p>
    </section>
  </article>
</template>
