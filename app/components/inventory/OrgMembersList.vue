<script setup lang="ts">
/**
 * OrgMembersList (Phase 12, D-09) — the owner/admin Members surface.
 *
 * Reads the roster via useInventory().fetchMembers() (keyed `inv:org-members`,
 * JWT/cookie group, secret-free: id · email · role, NEVER a password). Renders a
 * Card list of rows (email · role badge · per-row remove) with a top "Add member"
 * accent CTA that opens <AddMemberDialog>, plus an <EmptyState> when there are no
 * members yet.
 *
 * DESTRUCTIVE REMOVE (T-12-member-destroy): the per-row remove affordance is an
 * icon-only ghost button (lucide Trash2), size-11 (44×44 touch target), with an
 * interpolated aria-label="Remove {email}" for an accessible name (no visible
 * label). The resting glyph is neutral (text-muted-foreground, hover:destructive);
 * the destructive colour appears ONLY inside the confirm dialog. Clicking opens a
 * DeleteConfirmDialog-pattern destructive modal — it NEVER deletes on first click —
 * which calls store.removeMember(id). The owner is non-removable server-side (422).
 *
 * After add/remove the store refreshes inv:org-members so the list re-reads.
 * Names render via {{ }} interpolation (auto-escaped), never v-html.
 */
import { computed, ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Plus, Trash2 } from '@lucide/vue'
import AddMemberDialog from '~/components/inventory/AddMemberDialog.vue'
import EmptyState from '~/components/inventory/EmptyState.vue'
import { useInventoryStore } from '~/stores/inventory'
import type { OrganisationMember } from '~~/shared/types/inventory'

const { t } = useI18n()
const store = useInventoryStore()
const { fetchMembers } = useInventory()

const { data, status } = await fetchMembers()

const members = computed<OrganisationMember[]>(() => data.value?.data ?? [])
const loadFailed = computed(() => status.value === 'error')

// Add-member dialog.
const addOpen = ref(false)

// Remove confirm (destructive — never first-click delete).
const removeOpen = ref(false)
const toRemove = ref<OrganisationMember | null>(null)
const removing = ref(false)

function roleLabel(role: OrganisationMember['organisation_role']): string {
  return t(`inventory.organisation.members.role${role.charAt(0).toUpperCase()}${role.slice(1)}`)
}

function openRemove(member: OrganisationMember) {
  toRemove.value = member
  removeOpen.value = true
}

async function confirmRemove() {
  if (!toRemove.value) return
  removing.value = true
  try {
    await store.removeMember(toRemove.value.id)
    removeOpen.value = false
  }
  catch {
    // Store surfaced the failure toast (e.g. 422 owner-non-removable).
  }
  finally {
    removing.value = false
  }
}

// Per-row role change (admin<->member; never owner — D-08). The control is only
// rendered for non-owner rows; the server re-guards (owner/admin-only, 422 on the
// owner) regardless of what the SPA renders.
const changingRoleId = ref<number | null>(null)

async function onRoleChange(member: OrganisationMember, role: unknown) {
  // Select emits AcceptableValue (string | null); narrow to the two valid roles.
  if (role !== 'member' && role !== 'admin') return
  if (role === member.organisation_role) return
  changingRoleId.value = member.id
  try {
    await store.updateOrgMemberRole(member.id, role)
  }
  catch {
    // Store surfaced the failure toast; the refresh re-reads the true role.
  }
  finally {
    changingRoleId.value = null
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-xl font-semibold tracking-tight">
          {{ t('inventory.organisation.members.heading') }}
        </h2>
      </div>
      <Button class="min-h-11 w-full shrink-0 sm:w-auto" data-testid="add-member" @click="addOpen = true">
        <Plus class="mr-1 size-4" />
        {{ t('inventory.organisation.members.add') }}
      </Button>
    </header>

    <p v-if="loadFailed" class="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
      {{ t('inventory.organisation.loadError') }}
    </p>

    <EmptyState
      v-else-if="!members.length"
      :title="t('inventory.organisation.members.emptyTitle')"
      :body="t('inventory.organisation.members.emptyBody')"
    >
      <Button class="min-h-11" @click="addOpen = true">
        <Plus class="mr-1 size-4" />
        {{ t('inventory.organisation.members.add') }}
      </Button>
    </EmptyState>

    <Card v-else class="p-2">
      <ul class="divide-y">
        <li
          v-for="member in members"
          :key="member.id"
          data-testid="member-row"
          class="flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-muted"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <p class="truncate text-base">{{ member.email }}</p>
            <!-- Owner role is fixed (D-08): a static badge, never editable. -->
            <span
              v-if="member.organisation_role === 'owner'"
              class="inline-flex items-center rounded-none border px-2 py-0.5 text-sm text-muted-foreground"
            >
              {{ roleLabel(member.organisation_role) }}
            </span>
            <!-- Member/admin role is changeable inline (admin<->member only). -->
            <Select
              v-else
              :model-value="member.organisation_role"
              :disabled="store.isLoading && changingRoleId === member.id"
              @update:model-value="(v) => onRoleChange(member, v)"
            >
              <SelectTrigger
                class="h-8 w-36 rounded-none text-sm"
                data-testid="member-role-select"
                :aria-label="t('inventory.organisation.members.roleChangeLabel', { email: member.email })"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{{ t('inventory.organisation.members.roleMember') }}</SelectItem>
                <SelectItem value="admin">{{ t('inventory.organisation.members.roleAdmin') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            v-if="member.organisation_role !== 'owner'"
            variant="ghost"
            size="icon"
            data-testid="member-remove"
            class="size-11 shrink-0 text-muted-foreground hover:text-destructive"
            :aria-label="t('inventory.organisation.members.removeLabel', { email: member.email })"
            @click="openRemove(member)"
          >
            <Trash2 />
          </Button>
        </li>
      </ul>
    </Card>

    <AddMemberDialog v-model:open="addOpen" />

    <!-- Destructive remove confirm (DeleteConfirmDialog pattern — never first-click). -->
    <Dialog v-model:open="removeOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {{ t('inventory.organisation.members.removeTitle', { email: toRemove?.email ?? '' }) }}
          </DialogTitle>
          <DialogDescription>{{ t('inventory.organisation.members.removeBody') }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" class="min-h-11" @click="removeOpen = false">
            {{ t('inventory.action.cancel') }}
          </Button>
          <Button
            type="button"
            variant="destructive"
            class="min-h-11"
            data-testid="confirm-remove-member"
            :disabled="removing || store.isLoading"
            @click="confirmRemove"
          >
            {{ t('inventory.organisation.members.removeConfirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
