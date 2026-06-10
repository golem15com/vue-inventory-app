/**
 * Blog/Journal types.
 *
 * Mirror the backend Golem15.Journal plugin contract at `/_journal/api/v1`
 * (verified against `journal/PostApiController.php::serializePost`).
 * List endpoints return `{ data: BlogPost[], meta: BlogMeta }`; detail returns
 * `{ data: BlogPost & { previous_post, next_post, related_posts } }`.
 *
 * Nuxt 4 `shared/` convention: importable from both SSR and client.
 */

export interface BlogAuthor {
  id: number
  first_name: string | null
  last_name: string | null
  login: string
}

export interface BlogCategory {
  id: number
  name: string
  slug: string
  description?: string | null
  parent_id?: number | null
  nest_depth?: number
  post_count: number
  children?: BlogCategory[]
}

export interface BlogTag {
  id: number
  name: string
  slug: string
  post_count?: number
}

export interface BlogImage {
  id: number
  url: string
  file_name: string
  file_size: number
}

export interface BlogPost {
  id: number
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  content_html: string | null
  reading_time: number | null
  published: boolean
  published_at: string | null
  is_pinned: boolean
  author: BlogAuthor | null
  categories: BlogCategory[]
  tags: BlogTag[]
  featured_images: BlogImage[]
  featured_image_url: string | null
  created_at: string
  updated_at: string
  /** Detail-only relations (present on `/posts/{slug}`). */
  previous_post?: Pick<BlogPost, 'id' | 'title' | 'slug'> | null
  next_post?: Pick<BlogPost, 'id' | 'title' | 'slug'> | null
  related_posts?: BlogPost[]
}

/** Pagination envelope returned alongside `data` on list endpoints. */
export interface BlogMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}
