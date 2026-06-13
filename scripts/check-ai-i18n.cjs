#!/usr/bin/env node
/**
 * check-ai-i18n.cjs (Phase 11) — deterministic parity gate for the BYOK AI keyset.
 *
 * Loads both locale files, reads `inventory.settings.ai`, and exits non-zero if
 * the en and pl key sets differ or any of the 28 required keys is missing.
 * Prints `OK <n> keys` on success.
 */
const fs = require('fs')
const path = require('path')

const REQUIRED = [
  'title', 'heading', 'description', 'provider', 'providerClaude', 'providerOpenai',
  'apiKey', 'apiKeyPlaceholder', 'apiKeyConfigured', 'showKey', 'hideKey', 'copyKey',
  'advanced', 'model', 'modelHint', 'baseUrl', 'baseUrlHint', 'save', 'saved', 'test',
  'testing', 'testSuccess', 'testFailure', 'emptyTitle', 'emptyBody', 'providerRequired',
  'keyRequired',
]

function load(locale) {
  const p = path.join(__dirname, '..', 'i18n', 'locales', `${locale}.json`)
  const json = JSON.parse(fs.readFileSync(p, 'utf8'))
  const ai = json?.inventory?.settings?.ai
  if (!ai || typeof ai !== 'object') {
    console.error(`FAIL: ${locale}.json has no inventory.settings.ai object`)
    process.exit(1)
  }
  return ai
}

const en = load('en')
const pl = load('pl')

const enKeys = Object.keys(en).sort()
const plKeys = Object.keys(pl).sort()

const errors = []

// Required-key presence (both locales).
for (const k of REQUIRED) {
  if (!(k in en)) errors.push(`missing en key: ${k}`)
  if (!(k in pl)) errors.push(`missing pl key: ${k}`)
}

// Identical key sets.
if (enKeys.join(',') !== plKeys.join(',')) {
  const onlyEn = enKeys.filter(k => !plKeys.includes(k))
  const onlyPl = plKeys.filter(k => !enKeys.includes(k))
  if (onlyEn.length) errors.push(`keys only in en: ${onlyEn.join(', ')}`)
  if (onlyPl.length) errors.push(`keys only in pl: ${onlyPl.join(', ')}`)
}

if (errors.length) {
  console.error('FAIL: inventory.settings.ai parity check')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(`OK ${enKeys.length} keys`)
