<script setup lang="ts">
/**
 * AddMemberDialog (Phase 12, D-01/D-02) — the owner/admin "add a member" modal.
 *
 * Clones MintTokenDialog.vue's dialog shell. Fields: email, a temporary password,
 * and a role (Member · Admin — never owner). Submit calls
 * useInventoryStore().addMember({email,password,role}), which goes through `$api`
 * on the JWT/cookie group; the owner/admin write is server-guarded (Plan 05, D-09).
 *
 * SECRET DISCIPLINE (T-12-cred-leak): the temporary password is WRITE-ONLY — it
 * is sent in the request body and is NEVER round-tripped back (the member-row read
 * is secret-free). The field is cleared whenever the dialog (re)opens.
 *
 * On success the store fires the "Member added." toast + refreshes inv:org-members,
 * the dialog closes and emits `added` so the parent can react. All visible strings
 * go through t(); values render via {{ }} interpolation (auto-escaped), never v-html.
 */
import { reactive, ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { useInventoryStore } from '~/stores/inventory'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  added: []
}>()

const { t } = useI18n()
const store = useInventoryStore()

const form = reactive({
  email: '',
  password: '',
  role: 'member' as 'member' | 'admin',
})
const emailError = ref(false)
const passwordError = ref(false)
const submitting = ref(false)

// Reset everything whenever the dialog (re)opens — the write-only password never
// lingers in component state across opens (secret hygiene, T-12-cred-leak).
watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.email = ''
    form.password = ''
    form.role = 'member'
    emailError.value = false
    passwordError.value = false
  },
)

function close() {
  emit('update:open', false)
}

async function onSubmit() {
  emailError.value = !form.email.trim()
  passwordError.value = form.password.length < 8
  if (emailError.value || passwordError.value) return

  submitting.value = true
  try {
    await store.addMember({
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    })
    // The store toasted "Member added." + refreshed inv:org-members.
    emit('added')
    close()
  }
  catch {
    // Store surfaced the failure toast + error.value.
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('inventory.organisation.members.dialogTitle') }}</DialogTitle>
        <DialogDescription>{{ t('inventory.organisation.members.emptyBody') }}</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="member-email">{{ t('inventory.organisation.members.emailLabel') }}</Label>
          <Input
            id="member-email"
            v-model="form.email"
            type="email"
            :aria-invalid="emailError"
            autocomplete="off"
            class="min-h-11"
            data-testid="member-email"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="member-password">{{ t('inventory.organisation.members.passwordLabel') }}</Label>
          <Input
            id="member-password"
            v-model="form.password"
            type="password"
            :aria-invalid="passwordError"
            autocomplete="new-password"
            class="min-h-11 font-mono"
            data-testid="member-password"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="member-role">{{ t('inventory.organisation.members.roleLabel') }}</Label>
          <Select v-model="form.role">
            <SelectTrigger id="member-role" class="min-h-11 w-full" data-testid="member-role">
              <SelectValue :placeholder="t('inventory.organisation.members.roleLabel')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{{ t('inventory.organisation.members.roleMember') }}</SelectItem>
              <SelectItem value="admin">{{ t('inventory.organisation.members.roleAdmin') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" class="min-h-11" @click="close">
            {{ t('inventory.action.cancel') }}
          </Button>
          <Button
            type="submit"
            class="min-h-11"
            :disabled="submitting || store.isLoading"
            data-testid="member-submit"
          >
            {{ t('inventory.organisation.members.save') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
