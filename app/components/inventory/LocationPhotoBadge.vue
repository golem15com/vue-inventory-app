<script setup lang="ts">
/**
 * LocationPhotoBadge (dtmopdb5) — the D-05 "this thumbnail is the Location's photo,
 * not the item's own" honesty hint.
 *
 * Replaces the old full-width muted text label (which "covered most of the image" on
 * /search) with a small square corner icon. The hint reads via a native title +
 * aria-label tooltip rather than a shadcn Tooltip primitive — none exists in the app,
 * and native title avoids a TooltipProvider wrapper + the project's known SSR
 * composable pitfalls. Drop it inside any `relative` image container.
 */
import { MapPin } from '@lucide/vue'

const { t } = useI18n()
</script>

<template>
  <span
    class="absolute bottom-1 left-1 flex items-center justify-center bg-background/80 p-1 text-muted-foreground"
    :title="t('inventory.item.locationPhoto')"
    :aria-label="t('inventory.item.locationPhoto')"
  >
    <MapPin class="size-3.5" />
  </span>
</template>
