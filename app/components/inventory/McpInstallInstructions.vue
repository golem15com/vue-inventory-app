<script setup lang="ts">
/**
 * McpInstallInstructions (Phase 8) — the always-visible "Connect an AI tool (MCP)"
 * panel on the Integrations tab.
 *
 * Universal, token-agnostic setup help: the `curl | bash` installer one-liner
 * plus copy-paste manual config for Claude Code and Codex. The installer itself
 * (served by mcp.whereiput.it) handles global-vs-folder scope and Claude/Codex
 * selection; here we just surface the entry points. The actual `inv_…` secret is
 * never shown here — it appears only once, in the mint reveal (MintTokenDialog).
 *
 * Commands derive from runtimeConfig (`mcpInstallCommand`, `mcpInstallUrl`) so a
 * deployment can repoint them via NUXT_PUBLIC_* without a code change. All text
 * renders via {{ }} interpolation (auto-escaped), never v-html (T-08-spa-xss).
 */
import { computed } from 'vue'
import { Card } from '~/components/ui/card'
import { Copy } from '@lucide/vue'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const config = useRuntimeConfig()

const base = computed(() => config.public.mcpInstallUrl as string)

/** Snippets shown for copy. Order: easiest → most manual. */
const oneLiner = computed(() => config.public.mcpInstallCommand as string)
const claudeCmd = computed(
  () => `claude mcp add inventory --transport http ${base.value}/mcp -H "Authorization: Bearer inv_YOUR_TOKEN"`,
)
const codexToml = computed(
  () => `[mcp_servers.inventory]\nurl = "${base.value}/mcp"\nbearer_token_env_var = "INVENTORY_TOKEN"`,
)

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(t('inventory.settings.copied'))
  }
  catch {
    // Clipboard can be blocked (insecure context) — the text stays selectable.
  }
}
</script>

<template>
  <Card class="space-y-4 p-4" data-testid="mcp-instructions">
    <div class="space-y-1">
      <h3 class="text-base font-semibold tracking-tight">
        {{ t('inventory.settings.mcpInstall.title') }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ t('inventory.settings.mcpInstall.intro') }}
      </p>
    </div>

    <!-- 1) The installer one-liner (handles Claude/Codex + global/folder scope). -->
    <div class="space-y-1.5">
      <p class="text-sm font-medium">{{ t('inventory.settings.mcpInstall.oneLinerLabel') }}</p>
      <p class="text-xs text-muted-foreground">{{ t('inventory.settings.mcpInstall.oneLinerHint') }}</p>
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 rounded-md border bg-muted px-3 py-2 text-left font-mono text-xs hover:bg-muted/70"
        data-testid="mcp-copy-oneliner"
        @click="copy(oneLiner)"
      >
        <span class="truncate">{{ oneLiner }}</span>
        <Copy class="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>

    <!-- 2) Manual Claude Code. -->
    <div class="space-y-1.5">
      <p class="text-sm font-medium">{{ t('inventory.settings.mcpInstall.claudeLabel') }}</p>
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 rounded-md border bg-muted px-3 py-2 text-left font-mono text-xs hover:bg-muted/70"
        data-testid="mcp-copy-claude"
        @click="copy(claudeCmd)"
      >
        <span class="truncate">{{ claudeCmd }}</span>
        <Copy class="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>

    <!-- 3) Manual Codex (~/.codex/config.toml). -->
    <div class="space-y-1.5">
      <p class="text-sm font-medium">{{ t('inventory.settings.mcpInstall.codexLabel') }}</p>
      <button
        type="button"
        class="flex w-full items-start justify-between gap-2 rounded-md border bg-muted px-3 py-2 text-left font-mono text-xs hover:bg-muted/70"
        data-testid="mcp-copy-codex"
        @click="copy(codexToml)"
      >
        <span class="whitespace-pre">{{ codexToml }}</span>
        <Copy class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>

    <p class="text-xs text-muted-foreground">
      {{ t('inventory.settings.mcpInstall.tokenNote') }}
    </p>
  </Card>
</template>
