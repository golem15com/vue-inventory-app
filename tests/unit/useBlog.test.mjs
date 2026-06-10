#!/usr/bin/env node
/**
 * Source-contract test for app/composables/useBlog.ts (Task 17-03 / VUE-04).
 *
 * useBlog is a thin wrapper over Nuxt's auto-imported useFetch/useI18n/
 * useRuntimeConfig, which only resolve inside a full Nuxt runtime context.
 * The single-owner config surface (nuxt.config.ts, owned by 17-01) forbids
 * adding a vitest + @nuxt/test-utils harness here, and a thin useFetch wrapper
 * yields no meaningful unit coverage anyway. So we assert the composable's
 * BEHAVIOURAL CONTRACT statically against its source — the same properties the
 * plan's acceptance criteria assert — runnable with plain `node`:
 *
 *   node tests/unit/useBlog.test.mjs
 *
 * RED before the composable exists; GREEN once it is implemented to contract.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const composable = resolve(here, '../../app/composables/useBlog.ts')

let failures = 0
function check(name, cond) {
  if (cond) {
    console.log(`  ok  - ${name}`)
  } else {
    console.error(`  FAIL- ${name}`)
    failures++
  }
}

console.log('useBlog source-contract')

check('app/composables/useBlog.ts exists', existsSync(composable))

const src = existsSync(composable) ? readFileSync(composable, 'utf8') : ''
// Strip line comments so assertions test real code, not prose.
const code = src.replace(/\/\/.*$/gm, '')

// Behaviour 1: fetchPosts targets journalApiBase + '/posts' with `per_page`
// (the Journal contract) and `locale` — NOT queststream's `lang`/`/_wc`.
check('reads journalApiBase as baseURL', /public\.journalApiBase/.test(code))
check("fetchPosts calls useFetch('/posts')", /useFetch\(\s*['"`]\/posts['"`]/.test(code))
check('sends per_page query param', /per_page\s*:/.test(code))
check('sends locale query param', /locale\s*:\s*locale\.value/.test(code))
check("does NOT carry queststream's /_wc path", !/_wc/.test(code))
check("does NOT use queststream's `lang` query param", !/\blang\s*:/.test(code))

// Behaviour 2: search shorter than 3 chars is omitted from the query.
check('search guarded to >= 3 chars', /\.length\s*>=\s*3/.test(code))

// Behaviour 3: per_page clamped to <= 30 (default 9).
check('per_page clamped to <= 30 (Math.min(.,30))', /Math\.min\([^)]*,\s*30\s*\)/.test(code))
check('per_page default is 9', /\?\?\s*9/.test(code))

// Behaviour 4: every fetch is keyed (category/page/slug + locale) and
// watch:[locale] so locale switches refetch consistently for SSR/client.
check('stable key includes locale', /key:\s*[`'"].*\$\{locale\.value\}/.test(code))
check('posts key includes category + page', /journal:posts:\$\{[^}]*\}:\$\{[^}]*\}:\$\{locale\.value\}/.test(code))
check('watch: [locale] on every fetch', (code.match(/watch:\s*\[\s*locale\s*\]/g) || []).length >= 3)

// Surface: all three Journal read methods exist and are returned.
check('exposes fetchPosts', /function\s+fetchPosts/.test(code))
check('exposes fetchPost', /function\s+fetchPost/.test(code))
check('exposes fetchCategories', /function\s+fetchCategories/.test(code))
check("fetchPost targets /posts/${slug}", /useFetch\(\s*[`]\/posts\/\$\{slug\}/.test(code))
check("fetchCategories targets /categories", /useFetch\(\s*['"`]\/categories['"`]/.test(code))

if (failures > 0) {
  console.error(`\nuseBlog contract: ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\nuseBlog contract: all assertions passed')
