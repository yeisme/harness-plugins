/**
 * Resolve `toolHub` Remote: existing namespace, else `$mount`, else undefined.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client/remote
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { toolHubRemoteContribution } from './remote-contribution.ts'
import type { ToolHubCatalogAnswerV1, ToolHubConnectDocAnswerV1, ToolHubRediscoverAnswerV1, ToolHubRemoteFace, ToolHubSetEnabledAnswerV1, ToolHubSetEnabledInputV1 } from './wire.ts'

interface RemoteResultLike<T> {
  readonly ok: boolean
  readonly value?: T
  readonly error?: unknown
}

export type ToolHubClientErrorCode =
  | 'endpoint_not_found'
  | 'host_unavailable'
  | 'contract_mismatch'
  | 'storage_unavailable'
  | 'catalog_unavailable'
  | 'unknown'

export type ToolHubAuthCause = 'unauthenticated' | 'permission_denied'

export class ToolHubClientError extends Error {
  readonly code: ToolHubClientErrorCode

  /**
   * Additive structured auth cause: preserves the 401-vs-403 distinction the
   * legacy `accessDenied` boolean dropped. Optional and never consumed by
   * existing call sites; absent means the distinction was not recoverable.
   */
  constructor(code: ToolHubClientErrorCode, readonly accessDenied = false, readonly authCause?: ToolHubAuthCause) {
    super(code)
    this.name = 'ToolHubClientError'
    this.code = code
  }
}

function transportText(error: unknown): string {
  if (typeof error === 'string') return error
  if (typeof error !== 'object' || error === null) return ''
  const source = error as { code?: unknown; message?: unknown; status?: unknown }
  return [source.code, source.message, source.status].filter(value => typeof value === 'string' || typeof value === 'number').join(' ')
}

export function normalizeToolHubClientError(error: unknown): ToolHubClientError {
  if (error instanceof ToolHubClientError) return error
  const text = transportText(error).toLowerCase()
  // Additive structured causes keep the 401/403 distinction; `code`/`accessDenied`
  // semantics are unchanged for every existing consumer.
  if (/\b401\b|unauthorized|token[ _-]?invalid/.test(text)) return new ToolHubClientError('unknown', true, 'unauthenticated')
  if (/\b403\b|permission[ _-]?denied|forbidden/.test(text)) return new ToolHubClientError('unknown', true, 'permission_denied')
  if (/\b404\b|not[ _-]?found/.test(text)) return new ToolHubClientError('endpoint_not_found')
  if (/contract|schema|codec|specversion|incompatible/.test(text)) return new ToolHubClientError('contract_mismatch')
  if (/storage/.test(text)) return new ToolHubClientError('storage_unavailable')
  if (/network|fetch|refused|unavailable|timeout|\b5\d\d\b/.test(text)) return new ToolHubClientError('host_unavailable')
  return new ToolHubClientError('unknown')
}

function optionalLookup(ctx: ClientContext, name: string): Record<string, unknown> | undefined {
  try {
    const optionalGet = (ctx as { get?: unknown } | null)?.get
    const direct = typeof optionalGet === 'function'
      ? (optionalGet as (n: string) => unknown).call(ctx, name)
      : (ctx as unknown as Record<string, unknown>)[name]
    return direct === undefined || direct === null ? undefined : direct as Record<string, unknown>
  } catch {
    return undefined
  }
}

type ReadableToolHubFace = Pick<ToolHubRemoteFace, 'list'> & Partial<Pick<ToolHubRemoteFace, 'setEnabled' | 'connectDoc' | 'rediscover'>>

function isRemoteFace(candidate: unknown): candidate is ReadableToolHubFace {
  return typeof candidate === 'object' && candidate !== null
    && typeof (candidate as ToolHubRemoteFace).list === 'function'
}

function unwrapNamespace(namespace: Record<string, unknown>): ToolHubRemoteFace {
  const invoke = async (method: 'list' | 'setEnabled' | 'connectDoc' | 'rediscover', input?: ToolHubSetEnabledInputV1): Promise<unknown> => {
    const fn = namespace[method]
    if (typeof fn !== 'function') throw new ToolHubClientError('contract_mismatch')
    const response: unknown = await fn.call(namespace, ...(input === undefined ? [] : [input]))
    if (typeof response !== 'object' || response === null) throw new ToolHubClientError('contract_mismatch')
    const envelope = response as RemoteResultLike<unknown>
    // Released direct ports return the domain answer; Gateway namespaces wrap it.
    if ('value' in response || 'error' in response) {
      if (!envelope.ok) throw normalizeToolHubClientError(envelope.error)
      return envelope.value
    }
    return response
  }
  const codec = (method: 'list' | 'setEnabled') => toolHubRemoteContribution.descriptors.find(item => item.method === method)!.result.schema
  return {
    async list() {
      const answer = codec('list').parse(await invoke('list')) as ToolHubCatalogAnswerV1
      return answer.ok && typeof namespace.setEnabled !== 'function'
        ? { ...answer, items: answer.items.map(item => ({ ...item, canToggle: false })) } : answer
    },
    async setEnabled(input) {
      if (typeof namespace.setEnabled !== 'function') return { ok: false, code: 'toggle-unsupported', message: 'Enablement is not exposed by this owner' }
      return codec('setEnabled').parse(await invoke('setEnabled', input)) as ToolHubSetEnabledAnswerV1
    },
    // Additive probes: forwarded only when the namespace already exposes them;
    // there is no contribution descriptor yet, so answers pass through as-is
    // and the connect-doc controller validates the wire shape client-side.
    ...(typeof namespace.connectDoc === 'function' ? { connectDoc: async (): Promise<ToolHubConnectDocAnswerV1> => await invoke('connectDoc') as ToolHubConnectDocAnswerV1 } : {}),
    ...(typeof namespace.rediscover === 'function' ? { rediscover: async (): Promise<ToolHubRediscoverAnswerV1> => await invoke('rediscover') as ToolHubRediscoverAnswerV1 } : {}),
  }
}

const pendingMounts = new WeakMap<object, Promise<boolean>>()
export async function resolveToolHubRemote(ctx: ClientContext, override?: ToolHubRemoteFace): Promise<ToolHubRemoteFace | undefined> {
  if (override !== undefined) return override
  const remote = optionalLookup(ctx, 'remote')
  const lookup = () => optionalLookup(ctx, 'remote.toolHub') ?? remote?.toolHub as Record<string, unknown> | undefined
  const existing = lookup()
  if (isRemoteFace(existing)) return unwrapNamespace(existing as unknown as Record<string, unknown>)
  if (remote === undefined || typeof remote.$mount !== 'function') return undefined
  let pending = pendingMounts.get(ctx)
  if (!pending) {
    pending = (async () => {
      let released = false
      let unmount: (() => Promise<void>) | undefined
      ctx.effect?.(() => () => { released = true; void unmount?.() })
      const dispose = await (remote.$mount as (contribution: unknown) => Promise<() => Promise<void>>).call(remote, toolHubRemoteContribution)
      unmount = dispose
      if (released) await dispose()
      return !released
    })()
    pendingMounts.set(ctx, pending)
  }
  try { if (!await pending) return undefined } catch (error) { throw normalizeToolHubClientError(error) }
  finally { if (pendingMounts.get(ctx) === pending) pendingMounts.delete(ctx) }
  const mounted = lookup()
  return isRemoteFace(mounted) ? unwrapNamespace(mounted as unknown as Record<string, unknown>) : undefined
}

/** Every query probes again, so a missing namespace is recoverable without remounting the view. */
export function reconnectingToolHubRemote(ctx: ClientContext): ToolHubRemoteFace {
  const connect = async () => {
    const remote = await resolveToolHubRemote(ctx)
    if (!remote) throw new ToolHubClientError('host_unavailable')
    return remote
  }
  return {
    list: async () => (await connect()).list(),
    setEnabled: async input => (await connect()).setEnabled(input),
  }
}
