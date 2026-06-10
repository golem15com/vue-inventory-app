import { Centrifuge } from 'centrifuge'
import type { Subscription } from 'centrifuge'
import { createEventHook } from '@vueuse/core'
import { ref, onScopeDispose } from 'vue'

/**
 * Singleton Centrifugo realtime composable (VUE-03).
 *
 * Lifted from horoskopia's `useCentrifugo` (module-singleton + event-hook +
 * onScopeDispose shape) and RE-POINTED to the canonical backend token endpoint:
 *   GET /api/realtime/token  (jwt.auth) → 200 { token } directly.
 *
 * PITFALL 1 — the canonical endpoint returns `{ token }` DIRECTLY, NOT a
 * nested success-envelope (horoskopia's app-specific `/my/ws-token` wraps it
 * one level deeper). Read the `.token` field directly off the response root.
 *
 * PITFALL 2 — `centrifugoWsUrl` is environment-specific and may be unset. When
 * empty the demo degrades gracefully (warn + no-op) so the app still boots
 * without a running Centrifugo (dev value: ws://localhost:8000/connection/websocket).
 *
 * Security (T-17-05 / T-17-14 / T-17-15): the connection token is read straight
 * into `new Centrifuge(..., { token })` and NEVER logged; it is minted per-connect
 * (no persistence/reuse). The reconnect/backoff is owned by the `centrifuge`
 * client (T-17-16 — no hand-rolled retry loop). The channel is `user:{auth.user.id}`,
 * authorized server-side by the subscribe-proxy (T-17-17 — the frontend cannot
 * grant itself access).
 *
 * Usage:
 *   const { isConnected, connect, disconnect, onEvent } = useCentrifugo()
 *   onEvent((evt) => { console.log('live event', evt) })
 *   await connect()
 */

/** Typed payload shape for a Centrifugo publication event (channel-agnostic). */
export type CentrifugoEvent = Record<string, unknown>

// Module-level singleton state — shared across all consumers in the same app
// instance so connect() is idempotent and the live feed is a single source.
const client = ref<Centrifuge | null>(null)
const subscription = ref<Subscription | null>(null)
const isConnected = ref(false)
const eventHook = createEventHook<CentrifugoEvent>()

export function useCentrifugo() {
  async function connect() {
    // Guard: client-only (SSR has no WebSocket / no event loop to keep it).
    if (!import.meta.client || client.value) return

    // Guard: only connect for an authenticated user (channel needs user.id).
    const auth = useAuthStore()
    if (!auth.isLoggedIn || !auth.user) return

    // PITFALL 2 — graceful-degrade when the WS URL is unset so the app boots
    // without Centrifugo. Never throw; just warn + no-op.
    const wsUrl = useRuntimeConfig().public.centrifugoWsUrl as string
    if (!wsUrl) {
      console.warn('[useCentrifugo] centrifugoWsUrl not set — realtime disabled (graceful-degrade)')
      return
    }

    // PITFALL 1 — canonical endpoint returns { token } DIRECTLY.
    // Read `.token` straight off the response root (no nested envelope).
    const { $api } = useNuxtApp()
    let token: string
    try {
      const response = await ($api as typeof $fetch)<{ token: string }>('/api/realtime/token')
      if (!response?.token) {
        console.warn('[useCentrifugo] no token returned from /api/realtime/token')
        return
      }
      token = response.token
    }
    catch (err) {
      // 401 {error:'Unauthorized'} or 503 {error:'WebSocket not configured'} —
      // degrade gracefully. NEVER log the token (it is undefined here anyway).
      console.warn('[useCentrifugo] failed to obtain realtime token:', err)
      return
    }

    // Hand the token straight to the client; never log it (T-17-15).
    const c = new Centrifuge(wsUrl, { token })
    c.on('connected', () => { isConnected.value = true })
    c.on('disconnected', () => { isConnected.value = false })

    // Default demo channel — backend subscribe-proxy authorizes (T-17-17).
    const channel = `user:${auth.user.id}`
    const sub = c.newSubscription(channel)
    sub.on('publication', (ctx) => {
      eventHook.trigger(ctx.data as CentrifugoEvent)
    })

    sub.subscribe()
    c.connect()

    client.value = c
    subscription.value = sub
  }

  function disconnect() {
    if (subscription.value) {
      subscription.value.unsubscribe()
      subscription.value = null
    }
    if (client.value) {
      client.value.disconnect()
      client.value = null
    }
    isConnected.value = false
  }

  // Auto-cleanup when the calling component/scope is disposed.
  onScopeDispose(() => {
    disconnect()
  })

  return {
    isConnected,
    connect,
    disconnect,
    onEvent: eventHook.on,
  }
}
