import { createHash } from 'node:crypto'
import { symbols } from '@deepseek-ai/cordis'

export interface SkillReferenceReadInputV1 {
  readonly itemId: string
  readonly source: string
  readonly scope: 'profile'
  readonly expectedRevision?: string
  readonly cursor?: string
}

export type SkillReferenceReadAnswerV1 = {
  readonly specVersion: '1.0'
  readonly status: 'ready' | 'partial'
  readonly resourceRef: string
  readonly revision: string
  readonly mediaType: 'text/markdown'
  readonly content: string
  readonly startLine: number
  readonly continuedLine: boolean
  readonly nextCursor?: string
} | {
  readonly specVersion: '1.0'
  readonly status: 'disabled' | 'denied' | 'stale' | 'error'
  readonly reason: string
}

/** The original Skills registry owns discovery, scope and file authorization. */
export interface SkillReferenceOwner {
  list(options: { signal: AbortSignal }): Promise<readonly unknown[]>
  /** Owner-proven file origin; generic get() is not a document provenance contract. */
  getDocument?(name: string, options: { signal: AbortSignal }): Promise<unknown>
}

const sources = new Set(['project-dsh', 'project-agents', 'user-dsh', 'user-agents', 'custom', 'bundled'])
const record = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const failure = (status: 'disabled' | 'denied' | 'stale' | 'error', reason: string): SkillReferenceReadAnswerV1 => ({ specVersion: '1.0', status, reason })
// Compare underlying identity only; reads must retain Cordis's scoped proxy.
const ownerIdentity = (owner: SkillReferenceOwner | undefined): unknown => owner === undefined ? undefined : (owner as unknown as Record<symbol, unknown>)[symbols.original] ?? owner

function waitForOwner<T>(read: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('cancelled'))
    read.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

function fileIdentity(value: unknown): { name: string; source: string; provider: string; directory: string } | undefined {
  const item = record(value), base = record(item?.resourceBase)
  if (!item || typeof item.name !== 'string' || typeof item.source !== 'string' || !sources.has(item.source)
    || item.provider !== 'filesystem' || base?.kind !== 'directory' || typeof base.path !== 'string' || !base.path) return
  return { name: item.name, source: item.source, provider: item.provider, directory: base.path }
}

/** Explicit document reads only. No tool invocation, disk traversal, links or persistent body cache. */
export class SkillReferenceReader {
  constructor(private readonly owner: () => SkillReferenceOwner | undefined) {}

  async readSkill(input: SkillReferenceReadInputV1, signal: AbortSignal): Promise<SkillReferenceReadAnswerV1> {
    const request = record(input)
    if (!request || request.scope !== 'profile' || typeof request.itemId !== 'string' || !/^skill:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.itemId)
      || request.itemId.length > 206 || typeof request.source !== 'string' || !sources.has(request.source)
      || (request.expectedRevision !== undefined && (typeof request.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(request.expectedRevision)))
      || (request.cursor !== undefined && (typeof request.cursor !== 'string' || request.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(request.cursor)))) return failure('denied', 'invalid_request')
    try {
      signal.throwIfAborted()
      const owner = this.owner()
      if (!owner || typeof owner.list !== 'function' || typeof owner.getDocument !== 'function') return failure('disabled', 'reader_unavailable')
      const name = input.itemId.slice(6)
      const catalog = await waitForOwner(owner.list({ signal }), signal)
      signal.throwIfAborted()
      const matches = catalog.filter(item => record(item)?.name === name)
      const summary = matches.length === 1 ? fileIdentity(matches[0]) : undefined
      if (!summary || summary.source !== input.source) return failure('denied', 'source_not_readable')
      const loaded = record(await waitForOwner(owner.getDocument(name, { signal }), signal))
      signal.throwIfAborted()
      if (!loaded) return failure('denied', 'document_not_readable')
      const identity = fileIdentity(loaded)
      if (!identity || JSON.stringify(identity) !== JSON.stringify(summary) || typeof loaded?.content !== 'string') return failure('stale', 'source_changed')
      const current = (await waitForOwner(owner.list({ signal }), signal)).filter(item => record(item)?.name === name)
      signal.throwIfAborted()
      if (ownerIdentity(this.owner()) !== ownerIdentity(owner)) return failure('denied', 'source_no_longer_visible')
      if (current.length !== 1 || JSON.stringify(fileIdentity(current[0])) !== JSON.stringify(identity)) return failure('denied', 'source_no_longer_visible')
      const resourceRef = `skill-document:${digest(JSON.stringify(identity))}`
      const revision = createHash('sha256').update(JSON.stringify(identity)).update('\0').update(loaded.content).digest('hex')
      if (input.expectedRevision !== undefined && input.expectedRevision !== revision) return failure('stale', 'revision_changed')
      let offset = 0
      if (input.cursor !== undefined) {
        let cursor: unknown
        try { cursor = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')) } catch { return failure('denied', 'invalid_cursor') }
        if (!Array.isArray(cursor) || cursor.length !== 3 || cursor[0] !== resourceRef || cursor[1] !== revision
          || !Number.isSafeInteger(cursor[2]) || cursor[2] < 0 || cursor[2] > loaded.content.length) return failure('stale', 'cursor_mismatch')
        offset = cursor[2]
        // A cursor must start on a Unicode code point boundary.
        if (offset > 0 && /[\uDC00-\uDFFF]/.test(loaded.content[offset] ?? '') && /[\uD800-\uDBFF]/.test(loaded.content[offset - 1]!)) return failure('denied', 'invalid_cursor')
      }
      let end = offset, bytes = 0, newlines = 0
      while (end < loaded.content.length) {
        const point = String.fromCodePoint(loaded.content.codePointAt(end)!)
        const size = Buffer.byteLength(point)
        if (bytes + size > 256 * 1024 || newlines >= 5000) break
        bytes += size
        if (point === '\n') newlines += 1
        end += point.length
      }
      const partial = end < loaded.content.length
      let startLine = 1
      for (let index = 0; index < offset; index += 1) if (loaded.content[index] === '\n') startLine += 1
      return { specVersion: '1.0', status: partial ? 'partial' : 'ready', resourceRef, revision, mediaType: 'text/markdown',
        content: loaded.content.slice(offset, end), startLine,
        continuedLine: offset > 0 && loaded.content[offset - 1] !== '\n',
        ...(partial ? { nextCursor: Buffer.from(JSON.stringify([resourceRef, revision, end])).toString('base64url') } : {}),
      }
    } catch (error) {
      if (signal.aborted) return failure('disabled', 'cancelled')
      if (['FS_PERMISSION_DENIED', 'EACCES', 'EPERM'].includes(String(record(error)?.code))) return failure('denied', 'permission_denied')
      return failure('error', 'owner_read_failed')
    }
  }
}
