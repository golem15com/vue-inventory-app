<script setup lang="ts">
/**
 * /organisation (Phase 12, WS-6, D-09/D-11/D-13) — the organisation page.
 *
 * Auth-guarded (middleware: 'auth'). The page shell mirrors settings.vue
 * (text-3xl title, Breadcrumbs, space-y-6 section stack). It branches on the auth
 * user's `organisation_role` (surfaced by the Plan 03 getApiArray seam):
 *
 *   - owner / admin → the management surface: <OrgAiSettings> (Shared AI provider
 *     card) + <OrgMembersList> (members + add + per-row destructive-confirm remove).
 *   - member (any non-owner/admin WITH an org, incl. role null) → a READ-ONLY view:
 *     the org name + a single muted "Using shared organisation credentials" band.
 *     NO edit/add/remove controls rendered. The member is NOT redirected away (D-13)
 *     — the real authz boundary is the Plan 05 server guard (403); this UI-hide is
 *     defence in depth (T-12-org-acl).
 *   - no organisation at all → an EmptyState so the page never crashes.
 *
 * The role branch is convenience/clarity only; secrets never round-trip and the
 * server enforces every write.
 */
import { computed } from 'vue'
import Breadcrumbs from '~/components/inventory/Breadcrumbs.vue'
import OrgAiSettings from '~/components/inventory/OrgAiSettings.vue'
import OrgMembersList from '~/components/inventory/OrgMembersList.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import { useAuthStore } from '~/stores/auth'
import type { OrganisationRole } from '~~/shared/types/inventory'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const auth = useAuthStore()

// The org fields ride the AuthUser index signature (typed unknown) — narrow them.
const organisationId = computed<number | null>(() => {
  const v = auth.user?.organisation_id
  return typeof v === 'number' ? v : null
})
const organisationRole = computed<OrganisationRole | null>(() => {
  const v = auth.user?.organisation_role
  return v === 'owner' || v === 'admin' || v === 'member' ? v : null
})

const hasOrganisation = computed(() => organisationId.value !== null)
const canManage = computed(
  () => organisationRole.value === 'owner' || organisationRole.value === 'admin',
)

useSeoMeta({
  title: () => t('inventory.organisation.title'),
})
</script>

<template>
  <section class="space-y-6">
    <Breadcrumbs
      :segments="[
        { label: t('inventory.totals.areas'), to: '/' },
        { label: t('inventory.organisation.title') },
      ]"
    />

    <header>
      <h1 class="text-3xl font-semibold tracking-tight">{{ t('inventory.organisation.title') }}</h1>
    </header>

    <!-- No organisation at all — never crash. -->
    <EmptyState
      v-if="!hasOrganisation"
      :title="t('inventory.organisation.noOrgTitle')"
      :body="t('inventory.organisation.noOrgBody')"
    />

    <!-- Owner / admin → the full management surface. -->
    <template v-else-if="canManage">
      <OrgAiSettings />
      <OrgMembersList />
    </template>

    <!-- Plain member → read-only "Using shared organisation credentials" band.
         No edit/add/remove controls; NOT redirected away (D-13). -->
    <div
      v-else
      class="bg-muted p-4 text-sm text-foreground"
      data-testid="org-shared-band"
    >
      <p class="text-base">{{ t('inventory.organisation.shared.indicator') }}</p>
      <p class="mt-1 text-muted-foreground">{{ t('inventory.organisation.shared.body') }}</p>
    </div>
  </section>
</template>
