/**
 * Blog composable — SSR-compatible reads against the Golem15.Journal API.
 *
 * Lifted from queststream's `composables/useBlog.ts` (D-12: "we set up these
 * blogs every damn time") and RE-POINTED from queststream's WinterContent
 * target (the old WC blog API, query `lang`) to the canonical Journal contract
 * `/_journal/api/v1` (query `per_page`/`page`/`category`/`search`/`locale`).
 *
 * Contract (verified journal/PostApiController.php — see 17-RESEARCH.md):
 *   GET /posts        → { data: BlogPost[], meta: BlogMeta }
 *                       query: page, per_page (≤30, def 9), category(id|slug),
 *                       search(≥3 chars), locale, sort, pinned_first
 *   GET /posts/{slug} → { data: BlogPost & { previous_post, next_post, related_posts } }
 *                       slug regex [a-z0-9][a-z0-9\-\/]* or numeric id · 404 { error }
 *   GET /categories   → { data: BlogCategory[] }
 *
 * Anonymous callers see only published posts (drafts 404). Every fetch is keyed
 * (category/page/slug + locale) and `watch:[locale]` so locale switches refetch
 * consistently for SSR/client. `journalApiBase` comes from runtimeConfig.public
 * (single-owned by 17-01) and is reached through the dual dev-proxy in dev.
 */
import type { BlogPost, BlogCategory, BlogMeta } from '~~/shared/types/blog'

export interface BlogListOptions {
  page?: number
  perPage?: number
  category?: string
  search?: string
}

export type BlogListResponse = { data: BlogPost[]; meta: BlogMeta }
export type BlogDetailResponse = {
  data: BlogPost & {
    previous_post: Pick<BlogPost, 'id' | 'title' | 'slug'> | null
    next_post: Pick<BlogPost, 'id' | 'title' | 'slug'> | null
    related_posts: BlogPost[]
  }
}
export type BlogCategoriesResponse = { data: BlogCategory[] }

/** Journal per_page hard cap (backend rejects > 30). */
const MAX_PER_PAGE = 30
/** Journal default page size. */
const DEFAULT_PER_PAGE = 9
/** Backend requires search terms of at least this length. */
const MIN_SEARCH_LEN = 3

export function useBlog() {
  const baseURL = useRuntimeConfig().public.journalApiBase as string // /_journal/api/v1
  const { locale } = useI18n()

  /** Paginated post list with optional category filter + search. */
  function fetchPosts(options: BlogListOptions = {}) {
    const page = options.page ?? 1
    const search = options.search
    return useFetch<BlogListResponse>('/posts', {
      baseURL,
      query: {
        page,
        // Clamp to the backend cap; default 9.
        per_page: Math.min(options.perPage ?? DEFAULT_PER_PAGE, MAX_PER_PAGE),
        ...(options.category && { category: options.category }),
        // Backend requires ≥3 chars; drop shorter terms to avoid wasted calls.
        ...(search && search.length >= MIN_SEARCH_LEN && { search }),
        locale: locale.value,
      },
      key: `journal:posts:${options.category ?? 'all'}:${page}:${locale.value}`,
      watch: [locale],
    })
  }

  /** Single post by slug (or numeric id) with prev/next/related relations. */
  function fetchPost(slug: string) {
    return useFetch<BlogDetailResponse>(`/posts/${slug}`, {
      baseURL,
      key: `journal:post:${slug}:${locale.value}`,
      watch: [locale],
    })
  }

  /** All categories with post counts (+ nested children where present). */
  function fetchCategories() {
    return useFetch<BlogCategoriesResponse>('/categories', {
      baseURL,
      key: `journal:cats:${locale.value}`,
      watch: [locale],
    })
  }

  return { fetchPosts, fetchPost, fetchCategories, locale }
}
