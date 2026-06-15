<script setup lang="ts">
/**
 * /settings (Phase 8) — the SPA settings page.
 *
 * Auth-guarded the same way the inventory pages are (`middleware: 'auth'`), so
 * the token-CRUD UI is never reachable anonymously (T-08-spa-auth). v1 ships a
 * single visible "Integrations" tab hosting <TokenManager />; the tab is driven
 * by a `?tab=` query so future tabs slot in without restructuring (the segmented
 * control is structured for >1 tab even though only one exists today).
 */
import { computed } from 'vue'
import { Button } from '~/components/ui/button'
import Breadcrumbs from '~/components/inventory/Breadcrumbs.vue'
import TokenManager from '~/components/inventory/TokenManager.vue'
import AiSettings from '~/components/inventory/AiSettings.vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

type Tab = 'integrations' | 'ai'
const ALL_TABS: Array<{ key: Tab, label: string }> = [
  { key: 'integrations', label: 'inventory.settings.integrations.title' },
  { key: 'ai', label: 'inventory.settings.ai.title' },
]

// Drop the per-user AI tab when this deployment enforces shared organisation
// credentials (D-04, ai_org_lock from me/areas). This is COSMETIC on top of the
// Plan 04 server gate — a user reaching the AI surface directly still hits the
// server-enforced lock (defence in depth).
const TABS = computed(() => ALL_TABS.filter(tab => !(tab.key === 'ai' && auth.aiOrgLock)))

const activeTab = computed<Tab>(() => {
  const q = route.query.tab
  // Never resolve to a filtered-out tab: ?tab=ai while org-locked falls back to
  // integrations.
  if (q === 'ai' && !auth.aiOrgLock) return 'ai'
  return 'integrations'
})

function selectTab(tab: Tab) {
  router.replace({ path: '/settings', query: { tab } })
}

useSeoMeta({
  title: () => t('inventory.settings.title'),
})
</script>

<template>
  <section class="space-y-6">
    <Breadcrumbs
      :segments="[
        { label: t('inventory.totals.areas'), to: '/' },
        { label: t('inventory.settings.title') },
      ]"
    />

    <header>
      <h1 class="text-3xl font-semibold tracking-tight">{{ t('inventory.settings.title') }}</h1>
    </header>

    <!-- Tab strip (single tab in v1; structured for future expansion). -->
    <nav class="flex gap-1 border-b" aria-label="Settings sections">
      <Button
        v-for="tab in TABS"
        :key="tab.key"
        variant="ghost"
        class="min-h-11 rounded-b-none border-b-2 px-4"
        :class="activeTab === tab.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'"
        :data-testid="`settings-tab-${tab.key}`"
        @click="selectTab(tab.key)"
      >
        {{ t(tab.label) }}
      </Button>
    </nav>

    <TokenManager v-if="activeTab === 'integrations'" />
    <AiSettings v-else-if="activeTab === 'ai'" />
  </section>
</template>
