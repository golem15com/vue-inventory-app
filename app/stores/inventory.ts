/**
 * Pinia inventory store (setup-store shape) — all Inventory MUTATIONS plus the
 * shared reactive caches the pickers/breadcrumbs read.
 *
 * Mirrors stores/auth.ts's try/catch/finally + `error.value` structure, but the
 * CALL MECHANISM differs deliberately: every write goes through the starter
 * `$api` ($fetch instance from plugins/api.ts) — NOT bare `$fetch`. `$api`
 * attaches the JWT bearer from the auth_token cookie and transparently refreshes
 * on 401 (RESEARCH Pitfall 1 / Anti-Patterns). Never re-implement auth here, and
 * never use `useFetch` for a write — reads live in composables/useInventory.ts.
 *
 * Reads are SSR-cached under keys owned by useInventory(); after each mutation we
 * `refreshNuxtData()` exactly the affected key(s) so lists/counts stay live
 * without a full reload.
 *
 * Security: the store renders only what the permission-scoped API returns — it
 * never treats client-side filtering as an authz boundary (T-05-04). The 404
 * surfaces as the generic `inventory.error.notFound` copy (no enumeration).
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import type { Area, Location, Item, ItemCategory, Tag, TokenMintForm, TokenMintResponse, AiCredentialForm, AiCredentialResponse, TestConnectionResult, OrgAiCredentialForm, OrgAiCredentialTestForm, OrgAiCredentialResponse, OrganisationMember, OrganisationMemberForm, OnboardingStatusResponse, OnboardingBootstrapForm, OnboardingBootstrapResponse } from '~~/shared/types/inventory'
import { useAuthStore } from '~/stores/auth'

export const useInventoryStore = defineStore('inventory', () => {
  const { t, locale } = useI18n()

  // ---------------------------------------------------------------
  // Shared reactive caches (pickers / counts / cross-Area grouping)
  // ---------------------------------------------------------------
  const locationsByArea = ref<Record<number, Location[]>>({})
  const categories = ref<ItemCategory[]>([])
  const tags = ref<Tag[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function inventoryBase(): string {
    return useRuntimeConfig().public.inventoryApiBase as string // /_inventory/api/v1
  }

  /** Shared catch handler: set generic error copy, toast it, rethrow. */
  function fail(err: unknown): never {
    error.value = t('inventory.error.saveFailed')
    toast.error(error.value)
    throw err
  }

  // ---------------------------------------------------------------
  // Area
  // ---------------------------------------------------------------
  async function saveArea(form: Partial<Area>) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = form.id
        ? await $api<{ data: Area }>(`/areas/${form.id}`, { baseURL, method: 'PUT', body: form })
        : await $api<{ data: Area }>('/areas', { baseURL, method: 'POST', body: form })
      toast.success(t('inventory.area.saved'))
      await refreshNuxtData('inv:areas')
      return res.data
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function deleteArea(id: number) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      await $api(`/areas/${id}`, { baseURL, method: 'DELETE' })
      delete locationsByArea.value[id]
      toast.success(t('inventory.deleted'))
      await refreshNuxtData('inv:areas')
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------
  // Location
  // ---------------------------------------------------------------
  async function saveLocation(areaId: number, form: Partial<Location>) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = form.id
        ? await $api<{ data: Location }>(`/locations/${form.id}`, { baseURL, method: 'PUT', body: form })
        : await $api<{ data: Location }>(`/areas/${areaId}/locations`, { baseURL, method: 'POST', body: form })
      toast.success(t('inventory.location.saved'))
      // Refresh the Area's location list + the dashboard counts.
      await refreshNuxtData([`inv:area:${areaId}:locations`, 'inv:areas'])
      // Keep the shared picker cache for this Area in sync.
      const list = locationsByArea.value[areaId]
      if (list) {
        const idx = list.findIndex(l => l.id === res.data.id)
        if (idx >= 0) list[idx] = res.data
        else list.push(res.data)
      }
      return res.data
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function deleteLocation(areaId: number, id: number) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      await $api(`/locations/${id}`, { baseURL, method: 'DELETE' })
      const list = locationsByArea.value[areaId]
      if (list) locationsByArea.value[areaId] = list.filter(l => l.id !== id)
      toast.success(t('inventory.deleted'))
      await refreshNuxtData([`inv:area:${areaId}:locations`, 'inv:areas'])
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------
  // Category (create-only taxonomy, D-12)
  // ---------------------------------------------------------------
  async function saveCategory(form: Partial<ItemCategory>) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = await $api<{ data: ItemCategory }>('/categories', { baseURL, method: 'POST', body: form })
      categories.value.push(res.data)
      toast.success(t('inventory.category.saved'))
      await refreshNuxtData('inv:categories')
      // Return the created category — the inline-create combobox needs its id.
      return res.data
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------
  // Tag (create-only taxonomy, D-12; create-on-the-fly from the chip input)
  // ---------------------------------------------------------------
  async function createTag(name: string) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = await $api<{ data: Tag }>('/tags', { baseURL, method: 'POST', body: { name } })
      // Backend returns the existing record on duplicate name (D-12) — de-dupe the pool.
      if (!tags.value.some(tg => tg.id === res.data.id)) tags.value.push(res.data)
      await refreshNuxtData('inv:tags')
      return res.data
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------
  // Item — the D-07 seamless two-request, single-surface save
  // ---------------------------------------------------------------
  async function saveItem(form: Partial<Item>, photoFiles?: File[], locationId?: number) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = form.id
        ? await $api<{ data: Item }>(`/items/${form.id}`, { baseURL, method: 'PUT', body: form })
        : await $api<{ data: Item }>(`/locations/${locationId}/items`, { baseURL, method: 'POST', body: form })
      const item = res.data

      // Multi-photo parity (D-07): loop the staged Files as sequential photo POSTs
      // after the JSON create — all behind the ONE success surface below.
      for (const photoFile of photoFiles ?? []) {
        const fd = new FormData()
        fd.append('file', photoFile)
        // CRITICAL: leave the request header untouched — the browser sets the
        // multipart boundary itself (RESEARCH Pitfall 3 / T-05-07).
        await $api(`/items/${item.id}/photos`, { baseURL, method: 'POST', body: fd })
      }

      // ONE success surface even though photos are extra requests (D-07).
      toast.success(t('inventory.item.saved'))
      const keys = ['inv:recent:8']
      if (item.location) keys.push(`inv:loc:${item.location.id}:items:1`)
      await refreshNuxtData(keys)
      return item
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function deleteItem(item: Item) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      await $api(`/items/${item.id}`, { baseURL, method: 'DELETE' })
      toast.success(t('inventory.deleted'))
      const keys = ['inv:recent:8']
      if (item.location) keys.push(`inv:loc:${item.location.id}:items:1`)
      await refreshNuxtData(keys)
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function removePhoto(itemId: number, fileId: number) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      await $api(`/items/${itemId}/photos/${fileId}`, { baseURL, method: 'DELETE' })
      toast.success(t('inventory.deleted'))
      await refreshNuxtData(`inv:item:${itemId}`)
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------
  // Location / Area photo mutations for the full-page Edit screens (D-08)
  //
  // Each mirrors the proven item-photo pair: $api against inventoryBase()
  // (the JWT/cookie group, the SPA's only credential), one toast, refresh the
  // affected SSR read key. The multipart attach POST NEVER sets a content-type
  // header — the browser sets the boundary itself (T-05-11). Server-side
  // accessibleBy scoping + 404-no-leak is the real authz boundary (T-10-04-01).
  // ---------------------------------------------------------------

  /** Attach a photo to a Location (Edit Location). Mirrors attachLocationPhoto. */
  async function attachLocationPhotoEdit(locationId: number, photoFile: File) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const fd = new FormData()
      fd.append('file', photoFile)
      // CRITICAL: leave the request header untouched — the browser sets the boundary.
      await $api(`/locations/${locationId}/photos`, { baseURL, method: 'POST', body: fd })
      toast.success(t('inventory.item.saved'))
      await refreshNuxtData(`inv:loc:${locationId}`)
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  /** Remove a photo from a Location (Edit Location). Mirrors removePhoto. */
  async function removeLocationPhoto(locationId: number, fileId: number) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      await $api(`/locations/${locationId}/photos/${fileId}`, { baseURL, method: 'DELETE' })
      toast.success(t('inventory.deleted'))
      await refreshNuxtData(`inv:loc:${locationId}`)
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  /** Attach a photo to an Area (Edit Area; the 10-02 route). Mirrors attachLocationPhoto. */
  async function attachAreaPhoto(areaId: number, photoFile: File) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const fd = new FormData()
      fd.append('file', photoFile)
      // CRITICAL: leave the request header untouched — the browser sets the boundary.
      await $api(`/areas/${areaId}/photos`, { baseURL, method: 'POST', body: fd })
      toast.success(t('inventory.item.saved'))
      // Refresh the single-Area read + the dashboard list (Area covers, D-09).
      await refreshNuxtData([`inv:area:${areaId}`, 'inv:areas'])
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  /** Remove a photo from an Area (Edit Area). Mirrors removePhoto. */
  async function removeAreaPhoto(areaId: number, fileId: number) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      await $api(`/areas/${areaId}/photos/${fileId}`, { baseURL, method: 'DELETE' })
      toast.success(t('inventory.deleted'))
      await refreshNuxtData([`inv:area:${areaId}`, 'inv:areas'])
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------
  // AI Inventory Assist — recognize (read-only) + bulk save + attach photo
  // ---------------------------------------------------------------

  /**
   * POST a single photo to /items/recognize (multipart) and return the AI's
   * suggested items. Writes NOTHING — so no refreshNuxtData. On failure we
   * surface the error via fail() but the rejection propagates so the page can
   * choose retry-vs-manual (D-10).
   */
  async function recognize(photoFile: File, areaId: number) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const fd = new FormData()
      fd.append('photo', photoFile)
      fd.append('area_id', String(areaId))
      // Pass the active UI locale so the AI returns names/categories/descriptions
      // in the user's selected language (backend degrades to English if unknown).
      fd.append('locale', String(locale.value))
      // CRITICAL: leave the request header untouched — the browser sets the
      // multipart boundary itself (mirror saveItem's photo step).
      const res = await $api<{ items: Array<{ name: string, category: string | null, quantity: number, description: string | null }> }>(
        '/items/recognize',
        { baseURL, method: 'POST', body: fd },
      )
      return res.items
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Bulk-create reviewed items in ONE request (D-12, never a loop) at
   * /locations/{id}/items/bulk. One success toast, one refresh.
   */
  async function bulkSaveItems(locationId: number, rows: Array<Partial<Item>>) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = await $api<{ data: Item[] }>(
        `/locations/${locationId}/items/bulk`,
        { baseURL, method: 'POST', body: { items: rows } },
      )
      toast.success(t('inventory.aiAssist.saved', { count: res.data.length }))
      await refreshNuxtData(['inv:recent:8', `inv:loc:${locationId}:items:1`])
      return res.data
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Best-effort: attach the analyzed photo to the chosen Location (D-14),
   * performed alongside bulkSaveItems. No toast (the bulk save owns the one
   * success surface). On error, fail() surfaces it but must not block save.
   */
  async function attachLocationPhoto(locationId: number, photoFile: File) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const fd = new FormData()
      fd.append('file', photoFile)
      // CRITICAL: leave the request header untouched — browser sets the boundary.
      await $api(`/locations/${locationId}/photos`, { baseURL, method: 'POST', body: fd })
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------
  // Personal API tokens (Phase 8) — Integrations surface.
  //
  // CRITICAL (D-02): token CRUD goes through `$api` against inventoryBase()
  // (= /_inventory/api/v1, the JWT/cookie group) — NEVER the token route group
  // (/api/v1/inventory). A token must never be usable to mint a token, so these
  // mutations carry the interactive JWT/cookie credential by construction.
  // ---------------------------------------------------------------

  /**
   * Mint a personal API token. Returns the FULL mint response so the dialog can
   * surface the raw `inv_…` secret ONCE — the secret is never stored here, never
   * re-fetched, and the list read (inv:tokens) only ever sees the secret-free
   * meta. Refreshes the token list so the new row appears after the reveal.
   */
  async function mintToken(form: TokenMintForm) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = await $api<TokenMintResponse>('/tokens', { baseURL, method: 'POST', body: form })
      toast.success(t('inventory.settings.tokenMinted'))
      await refreshNuxtData('inv:tokens')
      return res
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  /** Revoke a token by id (owner-scoped server-side; a foreign/missing id 404s). */
  async function revokeToken(id: number) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      await $api(`/tokens/${id}`, { baseURL, method: 'DELETE' })
      toast.success(t('inventory.settings.tokenRevoked'))
      await refreshNuxtData('inv:tokens')
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------
  // BYOK AI credential (Phase 11) — AI-settings surface.
  //
  // Both mutations go through `$api` against inventoryBase() (= /_inventory/api/v1,
  // the JWT/cookie group) — never the token route group (D-02). The stored key is
  // never round-tripped: the request carries the key in its body, the responses
  // are secret-free.
  // ---------------------------------------------------------------

  /**
   * Persist the caller's BYOK credential (D-06 plain persist). On success the
   * store fires the success toast, then refreshes `inv:me` so `can_use_ai`
   * recomputes (D-04) and `inv:ai-credential` so the configured status updates.
   * Returns the secret-free response. Save is decoupled from Test (D-06).
   */
  async function saveAiCredential(form: AiCredentialForm) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = await $api<AiCredentialResponse>('/ai-credential', { baseURL, method: 'POST', body: form })
      toast.success(t('inventory.settings.ai.saved'))
      await refreshNuxtData('inv:me') // recompute can_use_ai (D-04)
      await refreshNuxtData('inv:ai-credential') // refresh the configured status
      // The dashboard v-if + ai-gate middleware read `auth.canUseAi` (the auth
      // store ref), NOT the `inv:me` useFetch cache — refreshing `inv:me` alone
      // leaves the gate flag stale, so the AI affordances would not appear until
      // a full reload. Re-hydrate the authoritative flag here so saving a key
      // reveals the AI buttons immediately, without an F5 (D-04).
      await useAuthStore().fetchCanUseAi()
      return res
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Fire a cheap real provider call to verify the credential (D-06). Returns the
   * `{ ok, error? }` result so the component can render it INLINE (UI-SPEC) — NO
   * toast. This deliberately does NOT route through `fail()`: a failed connection
   * is a valid `{ ok: false }` result with the verbatim provider message (D-08),
   * not a thrown error to toast.
   */
  async function testAiConnection(form: AiCredentialForm) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    return await $api<TestConnectionResult>('/ai-credential/test', { baseURL, method: 'POST', body: form })
  }

  // ---------------------------------------------------------------
  // Org (shared) BYOK AI credential (Phase 12, D-09/D-13)
  //
  // Exact mirror of saveAiCredential/testAiConnection but pointed at the
  // org-scoped routes. The WRITE is owner/admin-guarded server-side (Plan 05);
  // the SPA still surfaces the failure through `fail()` on a 403. The org key is
  // never round-tripped — sent in the body, the responses are secret-free.
  // ---------------------------------------------------------------

  /**
   * Persist the ORGANISATION's shared BYOK credential (D-09). On success: success
   * toast, then refresh `inv:me` so `can_use_ai`/`ai_inherited` recompute (D-04/
   * D-13) and `inv:org-ai-credential` so the configured status updates, then
   * re-hydrate `auth.canUseAi`/`aiInherited` so the AI affordances + inherited
   * band update without an F5. Returns the secret-free response.
   */
  async function saveOrgAiCredential(form: OrgAiCredentialForm) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = await $api<OrgAiCredentialResponse>('/org-ai-credential', { baseURL, method: 'POST', body: form })
      toast.success(t('inventory.organisation.ai.saved'))
      await refreshNuxtData('inv:me') // recompute can_use_ai + ai_inherited (D-04/D-13)
      await refreshNuxtData('inv:org-ai-credential') // refresh the configured status
      await useAuthStore().fetchCanUseAi() // re-hydrate the authoritative flags (no F5)
      return res
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Fire a cheap real provider call to verify the org credential (D-09). Returns
   * the `{ ok, error? }` result for INLINE rendering (UI-SPEC) — NO toast, verbatim
   * provider message (D-08). Mirrors testAiConnection exactly.
   */
  async function testOrgAiConnection(form: OrgAiCredentialTestForm) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    return await $api<TestConnectionResult>('/org-ai-credential/test', { baseURL, method: 'POST', body: form })
  }

  // ---------------------------------------------------------------
  // Organisation members (Phase 12, owner/admin only — D-09)
  // ---------------------------------------------------------------

  /**
   * Add a member to the organisation (D-01/D-02). On success: success toast +
   * refresh `inv:org-members`. The temporary password is sent in the body and
   * never echoed back (secret-free response, Plan 05).
   */
  async function addMember(form: OrganisationMemberForm) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const res = await $api<OrganisationMember>('/org/members', { baseURL, method: 'POST', body: form })
      toast.success(t('inventory.organisation.members.added'))
      await refreshNuxtData('inv:org-members')
      return res
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Remove a member from the organisation (detaches without deleting the account,
   * Plan 05). The owner is non-removable server-side (422). On success: success
   * toast + refresh `inv:org-members`.
   */
  async function removeMember(id: number) {
    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      await $api(`/org/members/${id}`, { baseURL, method: 'DELETE' })
      toast.success(t('inventory.organisation.members.removed'))
      await refreshNuxtData('inv:org-members')
    }
    catch (err: unknown) {
      return fail(err)
    }
    finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------
  // First-run site-owner onboarding (Phase 12, D-10) — PUBLIC.
  //
  // Both calls hit the SEPARATE public onboarding group (no jwt.auth). They MUST
  // use bare `$fetch` against the resolved absolute base — NOT `$api`, which
  // attaches the (non-existent) bearer and would try a 401-refresh the very first
  // owner cannot satisfy. Replay safety (409) and the zero-user gate are enforced
  // server-side (Plan 05); the SPA status check is convenience only.
  // ---------------------------------------------------------------

  /** Whether a first-run owner still needs to be created (zero-user gate, D-10). */
  async function fetchOnboardingStatus() {
    const baseURL = resolveApiUrl(inventoryBase())
    const res = await $fetch<OnboardingStatusResponse>('/onboarding/status', { baseURL })
    return res.needs_onboarding === true
  }

  /**
   * Create the first owner + organisation #1 (D-10). On success persist the
   * returned token via the auth store's setSession helper (the same path login
   * uses) and return the user; the page navigates. The server error message is
   * surfaced verbatim on failure so the onboarding card can render it inline.
   */
  async function bootstrapOnboarding(form: OnboardingBootstrapForm) {
    const baseURL = resolveApiUrl(inventoryBase())
    const res = await $fetch<OnboardingBootstrapResponse>('/onboarding/bootstrap', {
      baseURL,
      method: 'POST',
      body: form,
    })
    if (res.token && res.user) {
      await useAuthStore().setSession(res.token, res.user)
    }
    return res.user
  }

  // ---------------------------------------------------------------
  // Cross-Area grouped Location cache for the Item-form pickers (D-08)
  // ---------------------------------------------------------------
  async function loadLocationsForPickers() {
    // Memoize: skip the fan-out if the cache is already populated.
    if (Object.keys(locationsByArea.value).length > 0) return locationsByArea.value

    const { $api } = useNuxtApp()
    const baseURL = inventoryBase()
    isLoading.value = true
    error.value = null
    try {
      const areasRes = await $api<{ data: Area[] }>('/areas', { baseURL })
      // Bounded fan-out at personal scale (RESEARCH Gap 2): one call per Area.
      await Promise.all(
        areasRes.data.map(async (a) => {
          const locRes = await $api<{ data: Location[] }>(`/areas/${a.id}/locations`, { baseURL })
          locationsByArea.value[a.id] = locRes.data
        }),
      )
      return locationsByArea.value
    }
    catch (err: unknown) {
      error.value = t('inventory.error.loadFailed')
      toast.error(error.value)
      throw err
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    // State
    locationsByArea,
    categories,
    tags,
    isLoading,
    error,
    // Actions
    saveArea,
    deleteArea,
    saveLocation,
    deleteLocation,
    saveCategory,
    createTag,
    saveItem,
    deleteItem,
    removePhoto,
    attachLocationPhotoEdit,
    removeLocationPhoto,
    attachAreaPhoto,
    removeAreaPhoto,
    recognize,
    bulkSaveItems,
    attachLocationPhoto,
    loadLocationsForPickers,
    mintToken,
    revokeToken,
    saveAiCredential,
    testAiConnection,
    saveOrgAiCredential,
    testOrgAiConnection,
    addMember,
    removeMember,
    fetchOnboardingStatus,
    bootstrapOnboarding,
  }
})
