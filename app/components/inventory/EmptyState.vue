<script setup lang="ts">
/**
 * EmptyState (D-09/D-10) — reusable centered empty/first-run block.
 *
 * Renders a title (text-lg font-semibold) + optional body (text-sm muted) + an
 * optional default slot for the contextual CTA button (e.g. Add Location, or the
 * first-run "Create your first Area" accent button). The `variant` prop sizes the
 * vertical breathing room per the UI-SPEC spacing scale:
 *   - 'contextual' → py-12 (48px) — no-Locations / no-Items / no-Categories empties
 *   - 'firstRun'   → py-16 (64px) — the guided first-Area hero (D-09)
 *
 * Used by the dashboard (first-run + no-Recent) and every drill level.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    body?: string
    variant?: 'contextual' | 'firstRun'
  }>(),
  {
    body: '',
    variant: 'contextual',
  },
)

const paddingClass = computed(() => (props.variant === 'firstRun' ? 'py-16' : 'py-12'))
</script>

<template>
  <div :class="['flex flex-col items-center text-center', paddingClass]">
    <h2 class="text-lg font-semibold">{{ title }}</h2>
    <p v-if="body" class="mt-2 text-sm text-muted-foreground">{{ body }}</p>
    <div v-if="$slots.default" class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <slot />
    </div>
  </div>
</template>
