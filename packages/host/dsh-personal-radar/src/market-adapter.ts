import { projectMarketBrief, projectMarketReader, projectMarketCatchup, type MarketBriefProjection, type MarketReaderProjection, type MarketCatchupProjection } from './market-contracts.js'
import { projectSelectedMarketSignal, projectMarketCompare, type MarketSignalProjection, type MarketCompareProjection } from './market-contracts.js'
import { isSafeRadarRef } from './contracts.js'

/** Inject the host's existing connection; this adapter never resolves a binary or spawns a process. */
export interface ConnectedMarketTransport {
  readResource(input: { uri: string }, options?: { signal: AbortSignal }): Promise<unknown>
}
export type MarketReadResult =
  | { ok: true; brief: MarketBriefProjection; reader: MarketReaderProjection }
  | { ok: false; reason: 'offline' | 'timeout' | 'cancelled' | 'capability_unavailable' | 'contract_mismatch' | 'policy_changed' | 'state_changed' | 'brief_absent' | 'reference_unavailable' | 'content_blocked'; recovery: string }
type MarketReadFailure = Extract<MarketReadResult, { ok: false }>
export type MarketCatchupReadResult = { ok: true; page: MarketCatchupProjection; reader: MarketReaderProjection } | MarketReadFailure
export type MarketSignalReadResult = { ok: true; signal: MarketSignalProjection; reader: MarketReaderProjection } | MarketReadFailure
export type MarketCompareReadResult = { ok: true; compare: MarketCompareProjection; reader: MarketReaderProjection } | MarketReadFailure

function resourceData(input: unknown, uri: string): unknown {
  if (!input || typeof input !== 'object') throw new Error('contract_mismatch')
  const contents = (input as { contents?: unknown }).contents
  if (!Array.isArray(contents) || contents.length !== 1) throw new Error('contract_mismatch')
  const row = contents[0] as { uri?: unknown; text?: unknown }
  if (!row || row.uri !== uri || typeof row.text !== 'string' || row.text.length > 1_000_000) throw new Error('contract_mismatch')
  try { return JSON.parse(row.text) } catch { throw new Error('contract_mismatch') }
}

async function readMarketProjection<T extends { policyRevision: string; readerRevision?: number }>(
  transport: ConnectedMarketTransport, path: string, view: string, project: (input: unknown, policyRevision: string) => T,
  timeoutMs: number, signal?: AbortSignal,
): Promise<{ ok: true; value: T; reader: MarketReaderProjection } | MarketReadFailure> {
  type Result = { ok: true; value: T; reader: MarketReaderProjection } | MarketReadFailure
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new Error('invalid_timeout')
  const controller = new AbortController()
  const cancelled: MarketReadFailure = { ok: false, reason: 'cancelled', recovery: 'Read again only in the active connection and conversation context.' }
  if (signal?.aborted) return cancelled
  let onAbort: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let internalReason: 'contract_mismatch' | 'capability_unavailable' | 'policy_changed' | 'state_changed' | undefined
  const work = async (): Promise<Result> => {
    const read = async (path: string) => {
      if (controller.signal.aborted) throw new Error('aborted')
      const uri = 'radar://market/' + path
      const result = await transport.readResource({ uri }, { signal: controller.signal })
      if (controller.signal.aborted) throw new Error('aborted')
      try { return resourceData(result, uri) } catch { internalReason = 'contract_mismatch'; throw new Error('contract_mismatch') }
    }
    const capability = await read('capabilities') as { spec?: unknown; views?: unknown }
    if (!capability || capability.spec !== 'radar.market_capabilities.v1' || !Array.isArray(capability.views)) {
      internalReason = 'contract_mismatch'; throw new Error('contract_mismatch')
    }
    const views = capability.views
    if (![view, 'market_reader'].every(required => views.includes(required))) {
      internalReason = 'capability_unavailable'; throw new Error('capability_unavailable')
    }
    const beforeRaw = await read('reader')
    let before: MarketReaderProjection
    try { before = projectMarketReader(beforeRaw) } catch { internalReason = 'contract_mismatch'; throw new Error('contract_mismatch') }
    const raw = await read(path)
    const afterRaw = await read('reader')
    let value: T, after: MarketReaderProjection
    try { value = project(raw, before.policyRevision); after = projectMarketReader(afterRaw) }
    catch { internalReason = 'contract_mismatch'; throw new Error('contract_mismatch') }
    if (before.policyRevision !== after.policyRevision || value.policyRevision !== after.policyRevision) {
      internalReason = 'policy_changed'; throw new Error('policy_changed')
    }
    if (value.readerRevision !== undefined && (before.revision !== after.revision || value.readerRevision !== after.revision)) {
      internalReason = 'state_changed'; throw new Error('state_changed')
    }
    return { ok: true, value, reader: after }
  }
  try {
    const cancellation = new Promise<Result>(resolve => {
      onAbort = () => { resolve(cancelled); controller.abort() }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
    return await Promise.race([cancellation, work(), new Promise<Result>(resolve => {
      timer = setTimeout(() => {
        controller.abort()
        resolve({ ok: false, reason: 'timeout', recovery: 'Reconnect to the Radar owner; no collection or mutation was attempted.' })
      }, timeoutMs)
    })])
  } catch (error) {
    const code = error && typeof error === 'object' ? (error as { code?: unknown; data?: { code?: unknown } }).data?.code ?? (error as { code?: unknown }).code : undefined
    const reason = internalReason ?? (code === 'state_conflict' || code === 'cursor_invalid' ? 'state_changed' : code === 'brief_not_found' ? 'brief_absent'
      : code === 'signal_not_found' || code === 'evidence_not_found' ? 'reference_unavailable' : code === 'content_blocked' ? 'content_blocked' : 'offline')
    return { ok: false, reason, recovery: reason === 'state_changed' ? 'Discard the old cursor and restart catch-up from the current owner state.'
      : reason === 'reference_unavailable' ? 'The selected revision or evidence is unavailable; select another stored reference without substituting the latest revision.'
      : reason === 'policy_changed' ? 'Read the current owner policy before showing content.'
      : 'Inspect the connected Radar capabilities. Source configuration and collection run on the Radar owner host, not the client.' }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    if (onAbort) signal?.removeEventListener('abort', onAbort)
  }
}

export async function readConnectedMarketBrief(transport: ConnectedMarketTransport, timeoutMs = 5000, signal?: AbortSignal): Promise<MarketReadResult> {
  const result = await readMarketProjection(transport, 'briefs/latest', 'market_brief', projectMarketBrief, timeoutMs, signal)
  return result.ok ? { ok: true, brief: result.value, reader: result.reader } : result
}
export async function readConnectedMarketCatchup(transport: ConnectedMarketTransport, cursor: string | null = null,
  timeoutMs = 5000, signal?: AbortSignal): Promise<MarketCatchupReadResult> {
  if (cursor !== null && (!/^[A-Za-z0-9_-]+$/.test(cursor) || cursor.length > 2048)) throw new Error('market_cursor_invalid')
  const path = cursor === null ? 'catchup' : 'catchup?cursor=' + encodeURIComponent(cursor)
  const result = await readMarketProjection(transport, path, 'market_catchup', projectMarketCatchup, timeoutMs, signal)
  return result.ok ? { ok: true, page: result.value, reader: result.reader } : result
}

export async function readConnectedMarketSignal(transport: ConnectedMarketTransport, selection: { signalRef: string; revision: number },
  timeoutMs = 5000, signal?: AbortSignal): Promise<MarketSignalReadResult> {
  if (!isSafeRadarRef(selection.signalRef) || !Number.isSafeInteger(selection.revision) || selection.revision < 1) throw new Error('market_selection_invalid')
  const result = await readMarketProjection(transport, `signals/${selection.signalRef}/revisions/${selection.revision}`, 'market_signal',
    (input, policy) => projectSelectedMarketSignal(input, selection, policy), timeoutMs, signal)
  return result.ok ? { ok: true, signal: result.value, reader: result.reader } : result
}
export async function readConnectedMarketCompare(transport: ConnectedMarketTransport, left: { signalRef: string; revision: number }, right: { signalRef: string; revision: number },
  timeoutMs = 5000, signal?: AbortSignal): Promise<MarketCompareReadResult> {
  if (![left, right].every(selection => isSafeRadarRef(selection.signalRef) && Number.isSafeInteger(selection.revision) && selection.revision > 0)) throw new Error('market_selection_invalid')
  const path = `compare/${left.signalRef}/${left.revision}/${right.signalRef}/${right.revision}`
  const result = await readMarketProjection(transport, path, 'market_compare', projectMarketCompare, timeoutMs, signal)
  return result.ok ? { ok: true, compare: result.value, reader: result.reader } : result
}
