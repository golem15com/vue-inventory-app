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

/**
 * Embedded Location carried on Item.location — like InventoryRef but with the
 * optional attached photos (D-05 location-photo fallback). The serializer emits
 * `location.photos` so View Item / SearchResultRow can fall back to a Location
 * cover when the Item has no photo of its own.
 */
export interface EmbeddedLocation {
  id: number
  name: string
  photos?: Photo[]
}

export interface Area {
  id: number
  name: string
  description: string | null
  is_owner: boolean | null
  /** Present after Plan 05-01 serializer change — drives totals + delete copy. */
  location_count?: number
  item_count?: number
  /** Attached Area photos (D-09) — present after the serializer change. */
  photos?: Photo[]
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
  location: EmbeddedLocation | null
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

// ---------------------------------------------------------------------------
// Personal API tokens (Phase 8) — the SPA Integrations surface.
//
// Mirrors the JZ.Inventory backend contract on the JWT/cookie group (Plan 03):
//   POST   /_inventory/api/v1/tokens   -> 201 { token: 'inv_…', meta: TokenMeta }
//   GET    /_inventory/api/v1/tokens   -> 200 { data: TokenMeta[] }
//   DELETE /_inventory/api/v1/tokens/{id} -> 200 { data: { revoked: true } }
//
// `TokenMeta` is SECRET-FREE by construction — the backend never emits the raw
// secret or the hash in the list/meta. The plaintext `inv_…` value arrives ONLY
// in the mint response's `token` field and is shown once (held in local
// component state, never persisted, never re-fetched).
// ---------------------------------------------------------------------------

/** The three mintable scopes (in:read,write,ai) — matches ApiTokenManager. */
export type TokenScope = 'read' | 'write' | 'ai'

/** Secret-free token metadata as returned by list/mint `meta`. */
export interface TokenMeta {
  id: number
  name: string
  scopes: TokenScope[]
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

/** The mint form payload (name + chosen scopes + optional expiry). */
export interface TokenMintForm {
  name: string
  scopes: TokenScope[]
  expires_at?: string | null
}

/** Mint response: the raw secret ONCE + the secret-free meta. */
export interface TokenMintResponse {
  token: string
  meta: TokenMeta
}

// ---------------------------------------------------------------------------
// BYOK AI credential (Phase 11) — the SPA AI-settings surface.
//
// Mirrors the JZ.Inventory backend contract on the JWT/cookie group (Plan 03):
//   GET  /_inventory/api/v1/ai-credential      -> 200 { configured, provider?, model?, base_url? }
//   POST /_inventory/api/v1/ai-credential       -> 200 { configured: true, provider } | 422 { error, errors }
//   POST /_inventory/api/v1/ai-credential/test  -> 200 { ok: boolean, error? }
//
// SECRET DISCIPLINE: the stored key is NEVER round-tripped to the SPA — the GET
// returns only `{ configured }` + non-secret provider/model/base_url. The
// plaintext key exists only in the request body of save/test; the SPA holds it
// transiently in the form field and clears it after a successful save.
// ---------------------------------------------------------------------------

/** The two supported BYOK providers (D-05) — matches the backend validator. */
export type AiProvider = 'claude' | 'openai'

/** The save/test request body — the api_key is sent, never echoed back. */
export interface AiCredentialForm {
  provider: AiProvider
  api_key: string
  model?: string
  base_url?: string
}

/** Secret-free credential status as returned by the GET read. */
export interface AiCredentialResponse {
  configured: boolean
  provider?: AiProvider
  model?: string | null
  base_url?: string | null
}

/** Test-connection result — `{ ok: false, error }` carries the verbatim provider message (D-08). */
export interface TestConnectionResult {
  ok: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Phase 12 — Organisation, shared (org) BYOK credential, members, onboarding.
//
// The org-credential share is the per-user AiCredentialResponse contract with
// the SAME secret discipline (the key is sent, never echoed back). Member rows
// and the onboarding bootstrap response are likewise secret-free (no password
// is ever round-tripped — Plan 05 backend).
// ---------------------------------------------------------------------------

/** A member's role inside their organisation (D-01/D-02 — owner is non-removable). */
export type OrganisationRole = 'owner' | 'admin' | 'member'

/** The org-credential save/test request body — mirrors AiCredentialForm exactly. */
export type OrgAiCredentialForm = AiCredentialForm

/** Secret-free org-credential status (GET /org-ai-credential) — mirrors AiCredentialResponse. */
export type OrgAiCredentialResponse = AiCredentialResponse

/** A single organisation member row (GET /org/members) — secret-free, never the password. */
export interface OrganisationMember {
  id: number
  email: string
  organisation_role: OrganisationRole
}

export type OrganisationMembersResponse = { data: OrganisationMember[] }

/** Add-member request body (POST /org/members) — `role` is member|admin (never owner). */
export interface OrganisationMemberForm {
  email: string
  password: string
  role: 'member' | 'admin'
}

/** First-run onboarding gate (GET /onboarding/status) — true only on a zero-user deploy. */
export interface OnboardingStatusResponse {
  needs_onboarding: boolean
}

/** First-run owner bootstrap body (POST /onboarding/bootstrap) — PUBLIC, no auth header. */
export interface OnboardingBootstrapForm {
  org_name: string
  email: string
  password: string
}

/** Bootstrap response — the new owner's session token + user (Plan 05). */
export interface OnboardingBootstrapResponse {
  token?: string
  user?: import('./auth').AuthUser
}
