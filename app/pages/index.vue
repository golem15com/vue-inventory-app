<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { toast } from 'vue-sonner'

const { t } = useI18n()

// Demo home — exercises i18n + shadcn UI base. Auth/realtime demos land in
// 17-02/17-03 (this plan owns the baseline only).
useSeoMeta({
  title: () => t('demo.welcome'),
})
</script>

<template>
  <section class="space-y-6">
    <h1 class="text-3xl font-semibold tracking-tight">
      {{ t('demo.welcome') }}
    </h1>
    <p class="text-muted-foreground">
      Headless WinterCMS Nuxt 4 starter — auth, realtime, i18n, SEO and blog
      wiring assembled on a single opinionated baseline.
    </p>
    <Button @click="toast.success('Toaster works')">
      Test toast
    </Button>
  </section>
</template>
