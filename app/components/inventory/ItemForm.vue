<script setup lang="ts">
/**
 * ItemForm (D-05 / D-07 / D-08) — the composing Item capture form.
 *
 * Composes the four Plan 05-04 pickers in the EXACT UI-SPEC field order:
 *   1 Name (Input, required → inventory.error.nameRequired)
 *   2 Location (LocationCombobox, grouped by Area, required, ?location= prefill)
 *   3 Category (CategoryCombobox, inline-create, required ON CREATE →
 *     inventory.error.categoryRequired)
 *   4 Quantity (Input type=number, optional, min 0)
 *   5 Tags (TagChipInput, string[] of NAMES)
 *   6 Notes (textarea, plain text only — no raw HTML rendering, XSS rule T-05-12)
 *   7 Photo (PhotoUploader: create stages one File; edit shows the gallery)
 *
 * Save is the D-07 SEAMLESS single surface: saveItem(payload, photoFile, locationId)
 * does the JSON create/update then the optional photo POST behind ONE toast. The
 * two-request reality is never exposed (D-07). On create we POST to the chosen
 * Location; on edit we PUT /items/{id}. On read we map existing.tags ({id,name}[])
 * → names (RESEARCH Pitfall 6).
 *
 * Security: the Location picker only offers accessible Locations; a crafted
 * prefill id the user cannot access is rejected server-side on save (T-05-13).
 * Notes render as a textarea value only — never raw HTML (T-05-12).
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import LocationCombobox from '~/components/inventory/LocationCombobox.vue'
import CategoryCombobox from '~/components/inventory/CategoryCombobox.vue'
import TagChipInput from '~/components/inventory/TagChipInput.vue'
import PhotoUploader from '~/components/inventory/PhotoUploader.vue'
import { useInventoryStore } from '~/stores/inventory'
import type { Item } from '~~/shared/types/inventory'

const props = defineProps<{
  /** Edit mode: the hydrated Item to mutate. */
  existing?: Item
  /** Create mode: pre-select this Location (from ?location=). */
  prefillLocationId?: number
}>()

const { t } = useI18n()
const store = useInventoryStore()
const { fetchCategories } = useInventory()

const isEdit = computed(() => !!props.existing)

// ---------------------------------------------------------------
// Form state — seeded from `existing` (edit) or empty (create)
// ---------------------------------------------------------------
const form = reactive({
  id: props.existing?.id as number | undefined,
  name: props.existing?.name ?? '',
  locationId: (props.existing?.location?.id ?? props.prefillLocationId ?? null) as number | null,
  categoryId: (props.existing?.category?.id ?? null) as number | null,
  quantity: (props.existing?.quantity ?? null) as number | null,
  description: props.existing?.description ?? '',
  // RESEARCH Pitfall 6: tags v-model is string[] of NAMES.
  tags: (props.existing?.tags ?? []).map(tg => tg.name) as string[],
})

/** CREATE mode: the single staged photo File (auto-POSTed by saveItem). */
const photoFile = ref<File | null>(null)

/**
 * Quantity is `number | null` in the payload, but the Input modelValue is
 * `string | number`. Proxy through a computed: empty → null, else a clamped int.
 */
const quantityModel = computed<string | number>({
  get: () => (form.quantity == null ? '' : form.quantity),
  set: (v) => {
    const n = Number(v)
    form.quantity = v === '' || !Number.isFinite(n) ? null : Math.max(0, Math.trunc(n))
  },
})

const submitting = ref(false)
const nameError = ref(false)
const locationError = ref(false)
const categoryError = ref(false)

onMounted(async () => {
  // Warm the cross-Area Location cache for the Quick-add path (no prefill Area).
  await store.loadLocationsForPickers()
  // Seed the Category pool so the picker has options (cache may be empty on a
  // cold dedicated-page load).
  if (!store.categories.length) {
    const { data } = await fetchCategories()
    if (data.value?.data) store.categories = data.value.data
  }
})

function validate(): boolean {
  nameError.value = !form.name.trim()
  locationError.value = form.locationId == null
  // Category is required on create; on edit it may already be set/absent.
  categoryError.value = !isEdit.value && form.categoryId == null
  return !nameError.value && !locationError.value && !categoryError.value
}

function buildPayload() {
  return {
    ...(form.id ? { id: form.id } : {}),
    name: form.name.trim(),
    item_category_id: form.categoryId,
    quantity: form.quantity,
    description: form.description.trim() || null,
    tags: form.tags,
  }
}

async function onSubmit() {
  if (!validate()) return
  submitting.value = true
  try {
    // The write payload uses backend field names (item_category_id, tags as
    // names) — it is the API contract, not the read model — so cast via unknown.
    await store.saveItem(
      buildPayload() as unknown as Partial<Item>,
      photoFile.value ?? undefined,
      form.locationId ?? undefined,
    )
    // ONE success surface (the store toasts). Navigate back to where the Item lives.
    const back = form.locationId ? `/locations/${form.locationId}` : '/'
    await navigateTo(back)
  }
  catch {
    // Store surfaced the failure toast + error.value.
  }
  finally {
    submitting.value = false
  }
}

function onCancel() {
  const back = form.locationId ? `/locations/${form.locationId}` : '/'
  return navigateTo(back)
}
</script>

<template>
  <form class="max-w-2xl space-y-6" @submit.prevent="onSubmit">
    <!-- 1. Name (required) -->
    <div class="space-y-1.5">
      <Label for="item-name">{{ t('inventory.field.name') }}</Label>
      <Input
        id="item-name"
        v-model="form.name"
        :aria-invalid="nameError"
        autocomplete="off"
      />
      <p v-if="nameError" class="text-sm text-destructive">
        {{ t('inventory.error.nameRequired') }}
      </p>
    </div>

    <!-- 2. Location (grouped combobox, required, ?location= prefill) -->
    <div class="space-y-1.5">
      <Label>{{ t('inventory.field.location') }}</Label>
      <LocationCombobox v-model="form.locationId" :invalid="locationError" />
      <p v-if="locationError" class="text-sm text-destructive">
        {{ t('inventory.error.locationRequired') }}
      </p>
    </div>

    <!-- 3. Category (inline-create combobox, required on create) -->
    <div class="space-y-1.5">
      <Label>{{ t('inventory.field.category') }}</Label>
      <CategoryCombobox v-model="form.categoryId" :invalid="categoryError" />
      <p v-if="categoryError" class="text-sm text-destructive">
        {{ t('inventory.error.categoryRequired') }}
      </p>
    </div>

    <!-- 4. Quantity (number, optional, min 0) -->
    <div class="space-y-1.5">
      <Label for="item-quantity">{{ t('inventory.field.quantity') }}</Label>
      <Input
        id="item-quantity"
        v-model="quantityModel"
        type="number"
        min="0"
        inputmode="numeric"
      />
    </div>

    <!-- 5. Tags (chip input, string[] of names) -->
    <div class="space-y-1.5">
      <Label>{{ t('inventory.field.tags') }}</Label>
      <TagChipInput v-model="form.tags" />
    </div>

    <!-- 6. Notes (plain text only — no raw HTML rendering) -->
    <div class="space-y-1.5">
      <Label for="item-notes">{{ t('inventory.field.description') }}</Label>
      <textarea
        id="item-notes"
        v-model="form.description"
        rows="3"
        class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3"
      />
    </div>

    <!-- 7. Photo (create: one staged File; edit: multi-photo gallery) -->
    <div class="space-y-1.5">
      <Label>{{ t('inventory.field.photo') }}</Label>
      <PhotoUploader
        v-if="!isEdit"
        v-model="photoFile"
      />
      <PhotoUploader
        v-else
        :item-id="existing!.id"
        :photos="existing!.photos"
      />
    </div>

    <!-- Footer: single accent Save Item + Cancel -->
    <div class="flex items-center gap-3 pt-2">
      <Button type="submit" :disabled="submitting || store.isLoading">
        {{ t('inventory.item.save') }}
      </Button>
      <Button type="button" variant="outline" @click="onCancel">
        {{ t('inventory.action.cancel') }}
      </Button>
    </div>
  </form>
</template>
