/**
 * Authenticated user shape.
 *
 * Mirrors the backend `User::getApiArray()` payload returned by the WinterCMS
 * Golem15.User plugin at `/_user/api/v1/{login,register,fetch,refresh}`.
 * The index signature lets downstream client projects carry extra per-project
 * fields without redeclaring the interface.
 *
 * Nuxt 4 `shared/` convention: importable from both SSR and client.
 */
export interface AuthUser {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  login: string
  /** Per-project fields appended by individual client backends. */
  [key: string]: unknown
}
