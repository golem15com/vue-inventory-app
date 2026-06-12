/**
 * Inventory types.
 *
 * Mirror the backend JZ.Inventory plugin contract at `/_inventory/api/v1`
 * (verified against the SerializesInventory trait — see 05-RESEARCH.md). List
 * endpoints return `{ data: T[], meta?: Meta }`; detail endpoints return
 * `{ data: T }`. The embedded Item shape carries one level of relations
 * (location/area/category/tags/photos) with no follow-up calls (D-06).
 *
 * Count flags (`location_count`/`item_count`/`is_general`/`is_owner`) drive the
 * dashboard totals, the delete-consequence dialogs, and the owner-only/General
 * affordance gating — they are optional here and present after Plan 05-01's
 * serializer change.
 *
 * Nuxt 4 `shared/` convention: importable from both SSR and client.
 */

export interface Photo {
  id: number
  url: string
  thumb_url: string
}

/** Minimal embedded reference (one level deep, no relations). */
export interface InventoryRef {
  id: number
  name: string
}

export interface Area {
  id: number
  name: string
  description: string | null
  is_owner: boolean | null
  /** Present after Plan 05-01 serializer change — drives totals + delete copy. */
  location_count?: number
  item_count?: number
  created_at: string
  updated_at: string
}

export interface Location {
  id: number
  name: string
  area: InventoryRef | null
  /** True for the auto-created catch-all Location — hides the delete affordance. */
  is_general?: boolean
  item_count?: number
  /** Attached Location photos (D-14) — present after the serializer change. */
  photos?: Photo[]
  created_at: string
  updated_at: string
}

export interface Item {
  id: number
  name: string
  quantity: number | null
  description: string | null
  location: InventoryRef | null
  area: InventoryRef | null
  category: InventoryRef | null
  tags: InventoryRef[]
  photos: Photo[]
  created_at: string
  updated_at: string
}

export interface ItemCategory {
  id: number
  name: string
  slug: string
}

export interface Tag {
  id: number
  name: string
  slug: string
}

/** Pagination envelope returned alongside `data` on list endpoints. */
export interface Meta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}
