<script setup lang="ts">
/**
 * /areas/[id]/edit — full-page Edit Area screen (D-08).
 *
 * Renders at the standard reading width (max-w-5xl) like the View pages — square,
 * headers-in-cards. Two fields (name + description — Area has a description,
 * Location does not) + a multi-photo gallery card. The single --primary CTA is
 * Save; all controls are min-h-11.
 *
 * Reads the Area via the SSR composable (fetchArea returns {photos}, valid since
 * the 10-02 serializer carries area.photos); a missing/inaccessible id 404s with
 * the generic inventory.error.notFound copy (no enumeration). Name+description
 * save goes through store.saveArea ({id,name,description}); photo add/remove go
 * through the scoped Task-1 Area photo store actions (store.attachAreaPhoto /
 * store.removeAreaPhoto). The server-side accessibleBy scope + 404-no-leak is the
 * real authz boundary (T-10-04-01); the SPA performs zero client-side access
 * filtering. Names/descriptions render via {{ }} interpolation, never v-html
 * (T-10-04-02).
 */
import { computed, reactive, ref } from 'vue'
import { ImagePlus, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { useInventoryStore } from '~/stores/inventory'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { fetchArea } = useInventory()
const store = useInventoryStore()

const areaId = computed(() => Number(route.params.id))

const { data, error } = await fetchArea(areaId.value)

if (error.value || !data.value?.data) {
  throw createError({ statusCode: 404, statusMessage: t('inventory.error.notFound') })
}

const area = computed(() => data.value!.data)
const photos = computed(() => area.value.photos ?? [])
const parentTo = computed(() => `/areas/${areaId.value}`)

// ---------------------------------------------------------------
// Name + description fields + save
// ---------------------------------------------------------------
const form = reactive({
  name: area.value.name,
  description: area.value.description ?? '',
})
const nameError = ref(false)
const submitting = ref(false)

async function onSubmit() {
  if (!form.name.trim()) {
    nameError.value = true
    return
  }
  nameError.value = false
  submitting.value = true
  try {
    await store.saveArea({
      id: area.value.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
    })
    await navigateTo(parentTo.value)
  }
  catch {
    // Store surfaced the failure toast + error.value.
  }
  finally {
    submitting.value = false
  }
}

// ---------------------------------------------------------------
// Photo add (immediate multipart POST) — client convenience pre-check
// ---------------------------------------------------------------
const ACCEPTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
function acceptable(file: File): boolean {
  if (!file.type.startsWith('image/') || !ACCEPTED.includes(file.type)) return false
  if (file.size > MAX_BYTES) return false
  return true
}

const addInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

async function onAddPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (addInput.value) addInput.value.value = ''
  if (!file) return
  if (!acceptable(file)) {
    toast.error(t('inventory.error.photoRejected'))
    return
  }
  uploading.value = true
  try {
    await store.attachAreaPhoto(areaId.value, file)
  }
  catch {
    // Store surfaced the failure toast.
  }
  finally {
    uploading.value = false
  }
}

// ---------------------------------------------------------------
// Photo remove (confirm → store.removeAreaPhoto)
// ---------------------------------------------------------------
const confirmOpen = ref(false)
const pendingRemoveId = ref<number | null>(null)

function askRemove(fileId: number) {
  pendingRemoveId.value = fileId
  confirmOpen.value = true
}

async function confirmRemove() {
  if (pendingRemoveId.value == null) return
  try {
    await store.removeAreaPhoto(areaId.value, pendingRemoveId.value)
  }
  catch {
    // Store surfaced the failure toast.
  }
  finally {
    confirmOpen.value = false
    pendingRemoveId.value = null
  }
}

useSeoMeta({
  title: () => t('inventory.area.edit'),
})
</script>

<template>
  <section class="space-y-6">
    <h1 class="text-3xl font-semibold tracking-tight">{{ t('inventory.area.edit') }}</h1>

    <form class="space-y-6" @submit.prevent="onSubmit">
      <!-- Name + description (header-in-card) -->
      <Card class="bg-card border p-6">
        <div class="space-y-4">
          <div class="space-y-1.5">
            <Label for="area-name">{{ t('inventory.field.name') }}</Label>
            <Input
              id="area-name"
              v-model="form.name"
              class="min-h-11"
              :aria-invalid="nameError"
              autocomplete="off"
            />
            <p v-if="nameError" class="text-sm text-destructive">
              {{ t('inventory.error.nameRequired') }}
            </p>
          </div>

          <div class="space-y-1.5">
            <Label for="area-description">{{ t('inventory.field.description') }}</Label>
            <Input id="area-description" v-model="form.description" class="min-h-11" autocomplete="off" />
          </div>
        </div>
      </Card>

      <!-- Photos (header-in-card) — multi-photo gallery + add tile -->
      <Card class="bg-card border p-6">
        <h2 class="mb-4 text-sm font-medium text-muted-foreground">
          {{ t('inventory.location.photos') }}
        </h2>
        <div class="flex flex-wrap gap-4">
          <div
            v-for="photo in photos"
            :key="photo.id"
            class="relative size-24"
          >
            <img
              :src="photo.thumb_url || photo.url"
              :alt="area.name"
              class="size-24 rounded-md object-cover"
            >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="absolute top-1 right-1 bg-background/80 text-destructive hover:text-destructive"
              :aria-label="t('inventory.action.deleteLabel', { name: 'photo' })"
              @click="askRemove(photo.id)"
            >
              <Trash2 />
            </Button>
          </div>

          <!-- Add tile -->
          <label
            class="flex size-24 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors hover:bg-muted"
            :aria-disabled="uploading"
          >
            <ImagePlus class="size-6" />
            <input
              ref="addInput"
              type="file"
              accept="image/*"
              capture="environment"
              class="sr-only"
              :disabled="uploading"
              @change="onAddPick"
            >
          </label>
        </div>
      </Card>

      <!-- Footer: neutral Cancel, the one --primary Save -->
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" class="min-h-11" @click="navigateTo(parentTo)">
          {{ t('inventory.action.cancel') }}
        </Button>
        <Button type="submit" class="min-h-11" :disabled="submitting || store.isLoading">
          {{ t('inventory.action.save') }}
        </Button>
      </div>
    </form>

    <!-- Remove-photo confirm -->
    <Dialog :open="confirmOpen" @update:open="confirmOpen = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('inventory.item.photo.delete.title') }}</DialogTitle>
          <DialogDescription class="sr-only">
            {{ t('inventory.item.photo.delete.title') }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" class="min-h-11" @click="confirmOpen = false">
            {{ t('inventory.action.cancel') }}
          </Button>
          <Button
            type="button"
            variant="destructive"
            class="min-h-11"
            :disabled="store.isLoading"
            @click="confirmRemove"
          >
            {{ t('inventory.action.confirmDelete') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
