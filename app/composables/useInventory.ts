/**
 * Inventory composable — SSR-compatible reads against the JZ.Inventory API.
 *
 * Mirrors the blog composable's keyed-`useFetch` read pattern but RE-POINTED to
 * the Inventory contract `/_inventory/api/v1` (runtimeConfig.public.inventoryApiBase).
 *
 * NOTE (RESEARCH A5): the Inventory API has no language query parameter — the
 * active UI language only drives `t()` display strings, never the data. So unlike
 * useBlog this composable does NOT inject the i18n state or re-fetch on a language
 * switch; every read is keyed by resource id only.
 *
 * Contract (verified JZ.Inventory routes.php — see 05-RESEARCH.md):
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
import type { Area, Location, Item, ItemCategory, Tag, Meta } from '~~/shared/types/inventory'
// NOTE: the embedded-reference type is exported as `InventoryRef` (not `Ref`) to
// avoid shadowing Nuxt's auto-imported `Ref` from vue — see shared/types/inventory.ts.
//
// READS use useFetch (SSR, keyed); writes live in stores/inventory.ts via $api.

export type AreasResponse = { data: Area[] }
export type LocationsResponse = { data: Location[] }
export type ItemsResponse = { data: Item[]; meta: Meta }
export type ItemResponse = { data: Item }
export type CategoriesResponse = { data: ItemCategory[] }
export type TagsResponse = { data: Tag[] }

/** Default page size for a Location's Items list. */
const DEFAULT_PER_PAGE = 20
/** Default count for the dashboard "Recent items" widget. */
const RECENT_PER_PAGE = 8

export function useInventory() {
  const baseURL = useRuntimeConfig().public.inventoryApiBase as string // /_inventory/api/v1

  /** All Areas the current user can access (owner or editor). */
  function fetchAreas() {
    return useFetch<AreasResponse>('/areas', { baseURL, key: 'inv:areas' })
  }

  /** Locations within a single Area. */
  function fetchLocations(areaId: number) {
    return useFetch<LocationsResponse>(`/areas/${areaId}/locations`, {
      baseURL,
      key: `inv:area:${areaId}:locations`,
    })
  }

  /** Paginated Items within a single Location. */
  function fetchItems(locationId: number, page = 1) {
    return useFetch<ItemsResponse>(`/locations/${locationId}/items`, {
      baseURL,
      query: { page, per_page: DEFAULT_PER_PAGE },
      key: `inv:loc:${locationId}:items:${page}`,
    })
  }

  /** Single Item by id (embedded relations). 404 → { error }. */
  function fetchItem(id: number) {
    return useFetch<ItemResponse>(`/items/${id}`, {
      baseURL,
      key: `inv:item:${id}`,
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
    })
  }

  /** Global category pool (create-only taxonomy, D-12). */
  function fetchCategories() {
    return useFetch<CategoriesResponse>('/categories', {
      baseURL,
      key: 'inv:categories',
    })
  }

  /** Global tag pool (create-only taxonomy, D-12). */
  function fetchTags() {
    return useFetch<TagsResponse>('/tags', {
      baseURL,
      key: 'inv:tags',
    })
  }

  return {
    fetchAreas,
    fetchLocations,
    fetchItems,
    fetchItem,
    fetchRecent,
    fetchCategories,
    fetchTags,
  }
}
