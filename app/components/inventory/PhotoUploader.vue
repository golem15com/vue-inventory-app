<script setup lang="ts">
/**
 * PhotoUploader (D-07) — dual-mode photo capture for the Item form.
 *
 * Mode is derived from the presence of `itemId`:
 *  - CREATE mode (no itemId): a multi-file input. The chosen File[] is emitted via
 *    v-model and held by the parent ItemForm, which passes it to
 *    saveItem(form, photoFiles) — the store then loops the photo POSTs as SECOND
 *    requests behind ONE success surface (D-07), reaching multi-photo parity with the
 *    edit-mode gallery. Nothing is uploaded from here directly.
 *  - EDIT mode (itemId set): a size-24 thumbnail gallery of the existing photos
 *    with a per-photo remove (confirm dialog → removePhoto) and a `+` add tile
 *    that POSTs a new photo immediately.
 *
 * CRITICAL (RESEARCH Pitfall 3 / T-05-11): the upload sends multipart FormData
 * with field name `file` and NEVER sets a content-type header — the browser must
 * set the multipart boundary itself. Client type/size pre-check (image/* + ≤10 MB)
 * is convenience only; the backend (image|mimes:...|max:10240) is authoritative
 * and surfaces inventory.error.photoRejected on a client reject.
 */
import { computed, ref } from 'vue'
import { ImagePlus, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { useInventoryStore } from '~/stores/inventory'
import type { Photo } from '~~/shared/types/inventory'

const props = defineProps<{
  /** CREATE mode: the staged Files (v-model) — multi-photo parity with edit mode. */
  modelValue?: File[]
  /** EDIT mode marker: the Item id whose gallery this manages. */
  itemId?: number
  /** EDIT mode: the existing photos to render in the gallery. */
  photos?: Photo[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: File[]]
}>()

const { t } = useI18n()
const store = useInventoryStore()

const isEdit = computed(() => typeof props.itemId === 'number')

/** Client-side convenience pre-check; the backend remains authoritative. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function acceptable(file: File): boolean {
  if (!file.type.startsWith('image/') || !ACCEPTED.includes(file.type)) return false
  if (file.size > MAX_BYTES) return false
  return true
}

// ---------------------------------------------------------------
// CREATE mode — stage multiple Files + previews (multi-photo parity)
// ---------------------------------------------------------------
const createInput = ref<HTMLInputElement | null>(null)
const staged = computed<File[]>(() => props.modelValue ?? [])

/** Object-URL previews for the currently-staged Files (revoked when superseded). */
const previewUrls = computed(() => staged.value.map(f => URL.createObjectURL(f)))

function onCreatePick(event: Event) {
  const picked = Array.from((event.target as HTMLInputElement).files ?? [])
  // Reset the native input so the same file can be re-picked after a remove.
  if (createInput.value) createInput.value.value = ''
  if (!picked.length) return

  const ok: File[] = []
  let rejected = false
  for (const file of picked) {
    if (acceptable(file)) ok.push(file)
    else rejected = true
  }
  if (rejected) toast.error(t('inventory.error.photoRejected'))
  if (ok.length) emit('update:modelValue', [...staged.value, ...ok])
}

function removeStaged(index: number) {
  const next = staged.value.slice()
  next.splice(index, 1)
  emit('update:modelValue', next)
}

// ---------------------------------------------------------------
// EDIT mode — add a new photo (immediate multipart POST)
// ---------------------------------------------------------------
const addInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

async function onAddPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (!file || props.itemId == null) return
  if (!acceptable(file)) {
    toast.error(t('inventory.error.photoRejected'))
    if (addInput.value) addInput.value.value = ''
    return
  }
  uploading.value = true
  try {
    const { $api } = useNuxtApp()
    const baseURL = useRuntimeConfig().public.inventoryApiBase as string
    const fd = new FormData()
    fd.append('file', file)
    // CRITICAL: do NOT set a content-type header — the browser sets the multipart boundary.
    await $api(`/items/${props.itemId}/photos`, { baseURL, method: 'POST', body: fd })
    toast.success(t('inventory.item.saved'))
    await refreshNuxtData(`inv:item:${props.itemId}`)
  }
  catch {
    toast.error(t('inventory.error.photoRejected'))
  }
  finally {
    uploading.value = false
    if (addInput.value) addInput.value.value = ''
  }
}

// ---------------------------------------------------------------
// EDIT mode — remove a photo (confirm → removePhoto)
// ---------------------------------------------------------------
const confirmOpen = ref(false)
const pendingRemoveId = ref<number | null>(null)

function askRemove(fileId: number) {
  pendingRemoveId.value = fileId
  confirmOpen.value = true
}

async function confirmRemove() {
  if (pendingRemoveId.value == null || props.itemId == null) return
  try {
    await store.removePhoto(props.itemId, pendingRemoveId.value)
  }
  catch {
    // Store surfaced the failure toast.
  }
  finally {
    confirmOpen.value = false
    pendingRemoveId.value = null
  }
}
</script>

<template>
  <!-- CREATE MODE: multiple optional photos, staged for the seamless save -->
  <div v-if="!isEdit" class="space-y-3">
    <div v-if="staged.length" class="flex flex-wrap gap-3">
      <div
        v-for="(url, index) in previewUrls"
        :key="index"
        class="relative size-24"
      >
        <img :src="url" alt="" class="size-24 rounded-md object-cover">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          class="absolute top-1 right-1 bg-background/80 text-destructive hover:text-destructive"
          :aria-label="t('inventory.action.deleteLabel', { name: 'photo' })"
          @click="removeStaged(index)"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
    <input
      ref="createInput"
      type="file"
      accept="image/*"
      capture="environment"
      multiple
      class="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm hover:file:bg-accent"
      @change="onCreatePick"
    >
  </div>

  <!-- EDIT MODE: multi-photo gallery with add + per-photo remove -->
  <div v-else class="flex flex-wrap gap-3">
    <div
      v-for="photo in photos ?? []"
      :key="photo.id"
      class="relative size-24"
    >
      <img
        :src="photo.thumb_url || photo.url"
        alt=""
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
        class="sr-only"
        :disabled="uploading"
        @change="onAddPick"
      >
    </label>
  </div>

  <!-- Remove-photo confirm (D-06: no restore) -->
  <Dialog :open="confirmOpen" @update:open="confirmOpen = $event">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('inventory.item.photo.delete.title') }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ t('inventory.item.photo.delete.title') }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" @click="confirmOpen = false">
          {{ t('inventory.action.cancel') }}
        </Button>
        <Button
          type="button"
          variant="destructive"
          :disabled="store.isLoading"
          @click="confirmRemove"
        >
          {{ t('inventory.action.confirmDelete') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
