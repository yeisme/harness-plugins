import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { normalizeToolHubClientError } from './remote.ts'

export interface SkillDocumentInput {
  readonly itemId: string
  readonly source: string
  readonly scope: 'profile'
  readonly expectedRevision?: string
  readonly cursor?: string
}
export interface SkillDocumentPage {
  readonly status: 'ready' | 'partial'
  readonly resourceRef: string
  readonly revision: string
  readonly content: string
  readonly startLine: number
  readonly continuedLine: boolean
  readonly nextCursor?: string
}
export type SkillDocumentAnswer = SkillDocumentPage | { readonly status: 'disabled' | 'denied' | 'stale' | 'error' }
const object = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined

/** Whitelist the separate content response. Never forward arbitrary Remote fields. */
export function parseSkillDocument(value: unknown): SkillDocumentAnswer {
  const item = object(value)
  if (item?.specVersion !== '1.0') throw new Error('reader_contract_mismatch')
  if (['disabled', 'denied', 'stale', 'error'].includes(String(item.status))) return { status: item.status as 'disabled' | 'denied' | 'stale' | 'error' }
  if ((item.status !== 'ready' && item.status !== 'partial') || item.mediaType !== 'text/markdown'
    || typeof item.resourceRef !== 'string' || !/^skill-document:[a-f0-9]{64}$/.test(item.resourceRef)
    || typeof item.revision !== 'string' || !/^[a-f0-9]{64}$/.test(item.revision)
    || typeof item.content !== 'string' || new TextEncoder().encode(item.content).length > 256 * 1024
    || item.content.split('\n').length - (item.content.endsWith('\n') ? 1 : 0) > 5000
    || !Number.isSafeInteger(item.startLine) || Number(item.startLine) < 1 || typeof item.continuedLine !== 'boolean'
    || (item.nextCursor !== undefined && (typeof item.nextCursor !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(item.nextCursor)))
    || (item.status === 'partial') !== (item.nextCursor !== undefined)) throw new Error('reader_contract_mismatch')
  return { status: item.status, resourceRef: item.resourceRef, revision: item.revision, content: item.content,
    startLine: Number(item.startLine), continuedLine: item.continuedLine,
    ...(typeof item.nextCursor === 'string' ? { nextCursor: item.nextCursor } : {}) }
}

const contribution = {
  package: '@yeisme/dsh-tool-hub-host', descriptors: [{
    id: '@yeisme/dsh-tool-hub-host#toolReferences/readSkill', service: 'toolReferences', namespace: 'toolReferences', method: 'readSkill',
    invocation: { kind: 'direct' }, cancellation: { parameter: 'signal' },
    parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'strict', typeSymbol: 'SkillReferenceReadInputV1', schema: {
      parse(value: unknown) {
        const input = object(value)
        if (input?.scope !== 'profile' || typeof input.itemId !== 'string' || !/^skill:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.itemId)
          || input.itemId.length > 206 || typeof input.source !== 'string' || !['project-dsh', 'project-agents', 'user-dsh', 'user-agents', 'custom', 'bundled'].includes(input.source)
          || (input.expectedRevision !== undefined && (typeof input.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedRevision)))
          || (input.cursor !== undefined && (typeof input.cursor !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(input.cursor)))) throw new Error('reader_invalid_request')
        return { itemId: input.itemId, source: input.source, scope: 'profile',
          ...(input.expectedRevision === undefined ? {} : { expectedRevision: input.expectedRevision }),
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }) }
      },
    } } }],
    result: { mode: 'strict', typeSymbol: 'SkillReferenceReadAnswerV1', schema: { parse: (value: unknown) => ({ specVersion: '1.0', mediaType: 'text/markdown', ...parseSkillDocument(value) }) } },
  }],
}
const mounts = new WeakMap<object, Promise<boolean>>()
function transportFailure(error: unknown): SkillDocumentAnswer {
  const failure = normalizeToolHubClientError(error)
  return { status: failure.accessDenied ? 'denied' : ['endpoint_not_found', 'host_unavailable'].includes(failure.code) ? 'disabled' : 'error' }
}

/** Resolve on every explicit read; never load a document while selecting a catalog row. */
export async function readSkillDocument(ctx: ClientContext, input: SkillDocumentInput, signal: AbortSignal): Promise<SkillDocumentAnswer> {
  const lookup = (key: string) => { try { return object(ctx.get(key as never)) } catch { return undefined } }
  const remote = lookup('remote')
  const port = () => lookup('remote.toolReferences') ?? object(remote?.toolReferences)
  try {
    signal.throwIfAborted()
    if (typeof port()?.readSkill !== 'function' && typeof remote?.$mount === 'function') {
      let pending = mounts.get(ctx)
      if (!pending) {
        pending = (async () => {
          let released = false, unmount: (() => Promise<void>) | undefined
          ctx.effect?.(() => () => { released = true; void unmount?.() })
          unmount = await (remote.$mount as (value: unknown) => Promise<() => Promise<void>>).call(remote, contribution)
          if (released) await unmount()
          return !released
        })()
        mounts.set(ctx, pending)
      }
      try { if (!await pending) return { status: 'disabled' } } finally { if (mounts.get(ctx) === pending) mounts.delete(ctx) }
    }
    signal.throwIfAborted()
    const source = port()
    if (typeof source?.readSkill !== 'function') return { status: 'disabled' }
    const result = object(await (source.readSkill as (input: SkillDocumentInput, signal: AbortSignal) => Promise<unknown>).call(source, input, signal))
    signal.throwIfAborted()
    if (result?.ok !== true) return transportFailure(result?.error)
    return parseSkillDocument(result.value)
  } catch (error) { return signal.aborted ? { status: 'disabled' } : transportFailure(error) }
}
