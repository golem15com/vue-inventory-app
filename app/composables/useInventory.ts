/**
 * Inventory composable — SSR-compatible reads against the Golem15.Inventory API.
 *
 * Mirrors the blog composable's keyed-`useFetch` read pattern but RE-POINTED to
 * the Inventory contract `/_inventory/api/v1` (runtimeConfig.public.inventoryApiBase).
 *
 * NOTE (RESEARCH A5): the Inventory API has no language query parameter — the
 * active UI language only drives `t()` display strings, never the data. So unlike
 * useBlog this composable does NOT inject the i18n state or re-fetch on a language
 * switch; every read is keyed by resource id only.
 *
 * Contract (verified Golem15.Inventory routes.php — see 05-RESEARCH.md):
 *   GET /areas                       → { data: Area[] }
 *   GET /areas/{id}/locations        → { data: Location[] }
 *   GET /locations/{id}/items        → { data: Item[], meta: Meta }   (paginated)
 *   GET /items/{id}                  → { data: Item }                 · 404 { error }
 *   GET /items/search?q=&per_page=N  → { data: Item[], meta: Meta }   (recent, scoped)
 *   GET /categories                  → { data: ItemCategory[] }
 *   GET /tags                        → { data: Tag[] }
 *
 * Every response is permission-scoped server-side (jwt.auth + accessibleBy); a
 * foreign/missing resource 404s identically (no enumeration). `inventoryApiBase`
 * is single-owned by Plan 05-02's nuxt.config and reached through the dev proxy.
 */
import type { Area, Location, Item, ItemCategory, Tag, Meta, TokenMeta, AiCredentialResponse, OrgAiCredentialResponse, OrganisationMembersResponse } from '~~/shared/types/inventory'
// NOTE: the embedded-reference type is exported as `InventoryRef` (not `Ref`) to
// avoid shadowing Nuxt's auto-imported `Ref` from vue — see shared/types/inventory.ts.
//
// READS use useFetch (SSR, keyed); writes live in stores/inventory.ts via $api.

export type AreasResponse = { data: Area[] }
export type AreaResponse = { data: Area }
/**
 * me/areas envelope (Plan 01, D-14): the caller's accessible Areas PLUS the
 * explicit `can_use_ai` boolean computed server-side from AiGate::allows($user).
 * The SPA READS this flag — it NEVER infers AI access from a differential 403.
 */
export type MeAreasResponse = { data: Area[]; can_use_ai: boolean }
export type LocationsResponse = { data: Location[] }
export type LocationResponse = { data: Location }
export type ItemsResponse = { data: Item[]; meta: Meta }
export type ItemResponse = { data: Item }
export type CategoriesResponse = { data: ItemCategory[] }
export type TagsResponse = { data: Tag[] }
export type TokensResponse = { data: TokenMeta[] }

/** Default page size for a Location's Items list. */
const DEFAULT_PER_PAGE = 20
/** Default count for the dashboard "Recent items" widget. */
const RECENT_PER_PAGE = 8

export function useInventory() {
  // SSR-aware base: relative (/_inventory/api/v1) in the browser (nginx routes it),
  // but absolute (internalApiOrigin) during SSR — otherwise useFetch resolves the
  // relative path against the Nitro server itself (502/empty → "no areas" on F5).
  // Mirrors plugins/api.ts's write path; resolveApiUrl is a no-op on the client.
  const baseURL = resolveApiUrl(useRuntimeConfig().public.inventoryApiBase as string)

  // The Inventory API is JWT-protected (jwt.auth). The JWT lives in the
  // `auth_token` cookie (set by the auth store on login); plugins/api.ts attaches
  // it as a Bearer header for WRITES. These useFetch READS must do the same — the
  // backend returns 401 without it and the page would otherwise look empty/first-run.
  // SSR reads the cookie from the request via useCookie; the client reads
  // document.cookie directly (each useCookie() ref is independent and can be stale
  // after login — mirrors plugins/api.ts onRequest).
  function authHeaders(): Record<string, string> {
    let token: string | null = null
    if (import.meta.server) {
      token = (useCookie('auth_token').value as string | null) ?? null
    }
    else {
      const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/)
      token = match?.[1] ? decodeURIComponent(match[1]) : null
    }
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  /** All Areas the current user can access (owner or editor). */
  function fetchAreas() {
    return useFetch<AreasResponse>('/areas', { baseURL, key: 'inv:areas', headers: authHeaders() })
  }

  /**
   * The me/areas envelope (Plan 01) — the single source of truth for
   * `can_use_ai` (D-14). The auth store hydrates `auth.canUseAi` from this read
   * so the AI affordances can be hidden via `v-if`; the SPA NEVER infers AI
   * access by catching a 403 (the server 403 is the real boundary, not a signal).
   */
  function fetchMe() {
    return useFetch<MeAreasResponse>('/me/areas', { baseURL, key: 'inv:me', headers: authHeaders() })
  }

  /**
   * Single Area by id (embedded attached photos, D-09). 404 → { error }.
   *
   * The 6-line mirror of fetchLocation — valid now that the 10-02 serializer
   * carries `area.photos[]`. Keyed `inv:area:{id}` (distinct from the
   * `inv:area:{id}:locations` list key) so Edit Area's photo mutations can
   * refresh just this read.
   */
  function fetchArea(id: number) {
    return useFetch<AreaResponse>(`/areas/${id}`, {
      baseURL,
      key: `inv:area:${id}`,
      headers: authHeaders(),
    })
  }

  /** Locations within a single Area. */
  function fetchLocations(areaId: number) {
    return useFetch<LocationsResponse>(`/areas/${areaId}/locations`, {
      baseURL,
      key: `inv:area:${areaId}:locations`,
      headers: authHeaders(),
    })
  }

  /** Single Location by id (embedded area + attached photos, D-14). 404 → { error }. */
  function fetchLocation(id: number) {
    return useFetch<LocationResponse>(`/locations/${id}`, {
      baseURL,
      key: `inv:loc:${id}`,
      headers: authHeaders(),
    })
  }

  /** Paginated Items within a single Location. */
  function fetchItems(locationId: number, page = 1) {
    return useFetch<ItemsResponse>(`/locations/${locationId}/items`, {
      baseURL,
      query: { page, per_page: DEFAULT_PER_PAGE },
      key: `inv:loc:${locationId}:items:${page}`,
      headers: authHeaders(),
    })
  }

  /** Single Item by id (embedded relations). 404 → { error }. */
  function fetchItem(id: number) {
    return useFetch<ItemResponse>(`/items/${id}`, {
      baseURL,
      key: `inv:item:${id}`,
      headers: authHeaders(),
    })
  }

  /**
   * Recent items for the dashboard — reuses the empty-query scoped search
   * endpoint (RESEARCH Gap 2); no query box, no filters (that is Phase 6).
   */
  function fetchRecent(perPage = RECENT_PER_PAGE) {
    return useFetch<ItemsResponse>('/items/search', {
      baseURL,
      query: { q: '', per_page: perPage },
      key: `inv:recent:${perPage}`,
      headers: authHeaders(),
    })
  }

  /**
   * Scoped item search — the Phase 6 search box + filters read.
   *
   * Accepts a reactive (MaybeRefOrGetter) query carrying all seven backend
   * params (q/area/location/category/tag/page/per_page). The reactive `query`
   * drives useFetch to re-run AND auto-abort the prior in-flight request on
   * change (RESEARCH Pattern 1A), so callers just mutate the source and the
   * key stays stable at `inv:search`.
   *
   * Param names are exact, singular ints (area/location/category/tag); the
   * backend trims `q` ('' → browse) and caps per_page at 50 (default 20).
   * Reuses authHeaders() + the exported ItemsResponse envelope — fetchRecent's
   * `inv:recent:${perPage}` key is left untouched (it is targeted by
   * refreshNuxtData in stores/inventory.ts — Pitfall 7).
   */
  function fetchSearch(query: MaybeRefOrGetter<{
    q: string
    area: number | null
    location: number | null
    category: number | null
    tag: number | null
    page: number
    per_page: number
  }>) {
    return useFetch<ItemsResponse>('/items/search', {
      baseURL,
      query,
      key: 'inv:search',
      headers: authHeaders(),
    })
  }

  /** Global category pool (create-only taxonomy, D-12). */
  function fetchCategories() {
    return useFetch<CategoriesResponse>('/categories', {
      baseURL,
      key: 'inv:categories',
      headers: authHeaders(),
    })
  }

  /** Global tag pool (create-only taxonomy, D-12). */
  function fetchTags() {
    return useFetch<TagsResponse>('/tags', {
      baseURL,
      key: 'inv:tags',
      headers: authHeaders(),
    })
  }

  /**
   * The caller's personal API tokens (Phase 8 Integrations surface). Reads the
   * JWT/cookie group — token CRUD lives on the same group as mint/revoke (D-02);
   * the response is secret-free (name/scopes/last-used/expiry only).
   */
  function fetchTokens() {
    return useFetch<TokensResponse>('/tokens', { baseURL, key: 'inv:tokens', headers: authHeaders() })
  }

  /**
   * The caller's BYOK AI credential STATUS (Phase 11 AI-settings surface). Reads
   * the JWT/cookie group; the response is secret-free by construction — only
   * `{ configured }` + the non-secret provider/model/base_url, NEVER the key
   * (UI-SPEC secret discipline / D-02).
   */
  function fetchAiCredential() {
    return useFetch<AiCredentialResponse>('/ai-credential', { baseURL, key: 'inv:ai-credential', headers: authHeaders() })
  }

  /**
   * The ORGANISATION's shared BYOK credential STATUS (Phase 12, D-09/D-13). Reads
   * the JWT/cookie group; secret-free by construction — only `{ configured }` +
   * non-secret provider/model/base_url, NEVER the org key. Readable by any org
   * member (D-13 transparency); the WRITE is owner/admin-guarded server-side.
   * Mirrors fetchAiCredential exactly, key `inv:org-ai-credential`.
   */
  function fetchOrgAiCredential() {
    return useFetch<OrgAiCredentialResponse>('/org-ai-credential', { baseURL, key: 'inv:org-ai-credential', headers: authHeaders() })
  }

  /**
   * The organisation's member roster (Phase 12, owner/admin only server-side —
   * D-09). Secret-free (id/email/role, never a password). Keyed `inv:org-members`
   * so the store's add/remove mutations can refresh exactly this read.
   */
  function fetchMembers() {
    return useFetch<OrganisationMembersResponse>('/org/members', { baseURL, key: 'inv:org-members', headers: authHeaders() })
  }

  return {
    fetchAreas,
    fetchMe,
    fetchArea,
    fetchLocations,
    fetchLocation,
    fetchItems,
    fetchItem,
    fetchRecent,
    fetchSearch,
    fetchCategories,
    fetchTags,
    fetchTokens,
    fetchAiCredential,
    fetchOrgAiCredential,
    fetchMembers,
  }
}
