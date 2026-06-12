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

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

type Tab = 'integrations'
const TABS: Array<{ key: Tab, label: string }> = [
  { key: 'integrations', label: 'inventory.settings.integrations.title' },
]

const activeTab = computed<Tab>(() => {
  const q = route.query.tab
  return q === 'integrations' ? 'integrations' : 'integrations'
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
  </section>
</template>
