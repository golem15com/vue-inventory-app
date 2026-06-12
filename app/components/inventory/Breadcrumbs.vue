<script setup lang="ts">
/**
 * Breadcrumbs (D-03, UI-SPEC §"App shell") — the minimal in-content breadcrumb
 * trail. Renders text-sm muted, segments separated by a lucide ChevronRight
 * (size-4). Ancestor segments with a `to` are NuxtLinks (hover:text-foreground);
 * the last/current segment is text-foreground font-semibold with no link.
 *
 * Example output: Areas / Reymonta / Warsztat
 *
 * Segment labels are plain strings provided by the caller (already localized /
 * record names) — rendered as text via interpolation, never v-html.
 */
import { ChevronRight } from '@lucide/vue'

defineProps<{
  segments: { label: string, to?: string }[]
}>()
</script>

<template>
  <nav class="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
    <template v-for="(segment, index) in segments" :key="index">
      <ChevronRight v-if="index > 0" class="size-4 shrink-0" aria-hidden="true" />

      <NuxtLink
        v-if="segment.to && index < segments.length - 1"
        :to="segment.to"
        class="hover:text-foreground"
      >
        {{ segment.label }}
      </NuxtLink>
      <span
        v-else
        class="text-foreground font-semibold"
        :aria-current="index === segments.length - 1 ? 'page' : undefined"
      >
        {{ segment.label }}
      </span>
    </template>
  </nav>
</template>
