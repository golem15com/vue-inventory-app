<script setup lang="ts">
// Tab-title template. @nuxtjs/seo's default template ("%s %separator %siteName")
// only resolves %siteName at prerender time, so the static SPA build (ssr:false)
// renders a literal "%siteName" on client-rendered routes (login, settings, ...).
// A FUNCTION titleTemplate is evaluated by @unhead on every title change — client
// side included — and emits a finished string with no tokens. Pages set just their
// own title (e.g. t('inventory.settings.title')); the site name is appended here.
useHead({
  titleTemplate: (title?: string) =>
    title && title !== 'whereiput.it' ? `${title} | whereiput.it` : 'whereiput.it',
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
