<script setup lang="ts">
/**
 * LanguageSwitcher — reusable icon-triggered language popover.
 *
 * A polished replacement for the bare locale `<select>`. An icon button
 * (lucide `Languages`) opens a lightweight shadcn-vue Popover listing the
 * available locales with a flag emoji + language name; clicking one switches
 * instantly via `setLocale` (writes the `i18n_locale` cookie) and closes the
 * popover. The active locale carries a check + accent.
 *
 * Built to be reused by both the public layout (09-03) and the authed navbar
 * (09-04). Semantic tokens ONLY — `text-foreground`, `text-muted-foreground`,
 * `bg-popover`, `hover:bg-muted`, `text-primary` for the active row — so the
 * central token swap (D-20) keeps working. No hardcoded hex, no vendor accent
 * classes from other apps.
 */
import { computed, ref } from 'vue'
import { Check, Languages } from '@lucide/vue'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'

const { locale, locales, setLocale, t } = useI18n()

const open = ref(false)

// Flag emoji per locale code (🇬🇧 / 🇵🇱), falling back to a globe for any
// future locale we have not mapped yet.
const FLAGS: Record<string, string> = {
  en: '\u{1F1EC}\u{1F1E7}',
  pl: '\u{1F1F5}\u{1F1F1}',
}

const languageOptions = computed(() =>
  (locales.value as Array<{ code: string; name?: string }>).map(l => ({
    code: l.code,
    name: l.name ?? l.code.toUpperCase(),
    flag: FLAGS[l.code] ?? '\u{1F310}',
  })),
)

function selectLanguage(code: string) {
  if (code !== locale.value) {
    setLocale(code as typeof locale.value)
  }
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :aria-label="t('common.language.label')"
        class="inline-flex size-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Languages class="size-5" />
      </button>
    </PopoverTrigger>

    <PopoverContent align="end" class="w-56 p-2">
      <p class="px-2 pb-2 text-sm font-semibold text-foreground">
        {{ t('common.language.title') }}
      </p>
      <button
        v-for="lang in languageOptions"
        :key="lang.code"
        type="button"
        class="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-base transition-colors hover:bg-muted"
        :class="lang.code === locale ? 'text-primary' : 'text-foreground'"
        @click="selectLanguage(lang.code)"
      >
        <span class="text-base leading-none">{{ lang.flag }}</span>
        <span class="flex-1 font-medium">{{ lang.name }}</span>
        <Check v-if="lang.code === locale" class="size-4 shrink-0 text-primary" />
      </button>
    </PopoverContent>
  </Popover>
</template>
