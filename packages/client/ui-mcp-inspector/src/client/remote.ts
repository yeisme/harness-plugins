/**
 * Resolve `toolHub` Remote: existing namespace, else `$mount`, else undefined.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client/remote
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { toolHubRemoteContribution } from './remote-contribution.ts'
import type { ToolHubCatalogAnswerV1, ToolHubRemoteFace, ToolHubSetEnabledAnswerV1, ToolHubSetEnabledInputV1 } from './wire.ts'

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

export class ToolHubClientError extends Error {
  readonly code: ToolHubClientErrorCode

  constructor(code: ToolHubClientErrorCode) {
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

function isRemoteFace(candidate: unknown): candidate is ToolHubRemoteFace {
  return typeof candidate === 'object' && candidate !== null
    && typeof (candidate as ToolHubRemoteFace).list === 'function'
    && typeof (candidate as ToolHubRemoteFace).setEnabled === 'function'
}

function unwrapNamespace(namespace: Record<string, unknown>): ToolHubRemoteFace {
  const list = namespace.list as (() => Promise<RemoteResultLike<ToolHubCatalogAnswerV1>>) | undefined
  const setEnabled = namespace.setEnabled as ((input: ToolHubSetEnabledInputV1) => Promise<RemoteResultLike<ToolHubSetEnabledAnswerV1>>) | undefined
  if (typeof list !== 'function' || typeof setEnabled !== 'function') {
    throw new Error('tool-hub client: mounted toolHub namespace lacks list/setEnabled')
  }
  return {
    async list() {
      const answered = await list()
      if (!answered.ok) throw normalizeToolHubClientError(answered.error)
      return answered.value as ToolHubCatalogAnswerV1
    },
    async setEnabled(input) {
      const answered = await setEnabled(input)
      if (!answered.ok) throw normalizeToolHubClientError(answered.error)
      return answered.value as ToolHubSetEnabledAnswerV1
    },
  }
}

export async function resolveToolHubRemote(ctx: ClientContext, override?: ToolHubRemoteFace): Promise<ToolHubRemoteFace | undefined> {
  if (override !== undefined) return override
  const remote = optionalLookup(ctx, 'remote')
  if (isRemoteFace(remote?.toolHub)) return remote.toolHub as ToolHubRemoteFace
  if (remote !== undefined && typeof (remote as { $mount?: unknown }).$mount === 'function') {
    try {
      await (remote as { $mount(contribution: unknown): Promise<() => Promise<void>> }).$mount(toolHubRemoteContribution)
    } catch {
      return undefined
    }
    const mounted = optionalLookup(ctx, 'remote.toolHub')
    if (mounted !== undefined) return unwrapNamespace(mounted)
  }
  return undefined
}
