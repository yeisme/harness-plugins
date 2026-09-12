/**
 * Explicit, receipt-backed capability references for a bound conversation.
 * The pane captures the target before any async work, so shell focus changes
 * cannot redirect an insertion to another conversation.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolHubItemV1 } from './wire.ts'

interface Target {
  readonly workspaceId: string
  readonly conversationId: string
  readonly draftRevision?: number
  readonly title?: string
  readonly caret?: { readonly start: number; readonly end: number }
}

interface Reference {
  readonly id: string
  readonly kind: 'skill' | 'tool'
  readonly intent: 'guidance' | 'capability'
  readonly owner: string
  readonly ref: string
  readonly version: string
  readonly label: string
  readonly scope: string
  readonly digest: string
  readonly freshness: 'fresh' | 'stale' | 'frozen' | 'unavailable'
}

interface ReferenceBridge {
  targetFor?(conversationId: string, signal?: AbortSignal): Promise<
    | { readonly status: 'available'; readonly snapshot: { readonly target: Target; readonly references: readonly Reference[] } }
    | { readonly status: 'unavailable'; readonly reason: string }
  >
  insertReference?(detail: { readonly version: 1; readonly requestId: string; readonly target: Target; readonly reference: Reference }, signal?: AbortSignal): Promise<{
    readonly requestId: string
    readonly target: Target
    readonly ok: boolean
    readonly reason?: string
    readonly reference?: { readonly id: string }
  }>
}

interface CapabilityResolver {
  resolve(input: { readonly sessionId: string; readonly family: 'skill' | 'native' | 'mcp'; readonly name: string }, signal?: AbortSignal): Promise<
    | { readonly status: 'available'; readonly reference: Reference }
    | { readonly status: 'unavailable'; readonly reason: string }
  >
}

export type DraftReferenceResult =
  | { readonly status: 'added' }
  | { readonly status: 'already-added' }
  | { readonly status: 'unavailable'; readonly reason: string }

function optionalService<T>(ctx: ClientContext, key: string): T | undefined {
  try { return ctx.get(key as never) as T | undefined } catch { return undefined }
}

function sameReference(left: Reference, right: Reference): boolean {
  return left.owner === right.owner && left.ref === right.ref && left.kind === right.kind
    && left.intent === right.intent && left.version === right.version && left.scope === right.scope && left.digest === right.digest
}

function requestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `tools-reference-${crypto.randomUUID()}`
    : `tools-reference-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

class OwnerTimeout extends Error {}

async function settle<T>(promise: Promise<T>, controller: AbortController, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new OwnerTimeout()) }, timeoutMs) }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Resolve from the authoritative session owner and add only after a Host receipt. */
export async function addCapabilityReference(ctx: ClientContext, sessionId: string, item: ToolHubItemV1, signal?: AbortSignal, timeoutMs = 5_000): Promise<DraftReferenceResult> {
  if (signal?.aborted === true) return { status: 'unavailable', reason: 'Adding the reference was cancelled.' }
  if (item.availability !== 'available') return { status: 'unavailable', reason: item.disabledReason ?? 'This capability is unavailable to the bound conversation.' }
  const bridge = optionalService<ReferenceBridge>(ctx, 'composerReferenceBridge')
  const resolver = optionalService<CapabilityResolver>(ctx, 'composerReferenceCapabilityResolver')
  if (bridge?.targetFor === undefined || bridge.insertReference === undefined || resolver === undefined) {
    return { status: 'unavailable', reason: 'The Host does not provide a bound conversation draft reference capability.' }
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const [targetResult, referenceResult] = await settle(Promise.all([
      bridge.targetFor(sessionId, controller.signal),
      resolver.resolve({ sessionId, family: item.family, name: item.name }, controller.signal),
    ]), controller, timeoutMs)
    if (targetResult.status !== 'available') return { status: 'unavailable', reason: targetResult.reason }
    if (referenceResult.status !== 'available') return { status: 'unavailable', reason: referenceResult.reason }
    if (controller.signal.aborted) return { status: 'unavailable', reason: 'The Host did not confirm insertion in time.' }
    const { target, references } = targetResult.snapshot
    if (target.conversationId !== sessionId) return { status: 'unavailable', reason: 'The Host returned a different bound conversation target.' }
    const expected = item.family === 'skill'
      ? { kind: 'skill', intent: 'guidance', owner: 'dsh.skills' }
      : { kind: 'tool', intent: 'capability', owner: 'dsh.tools' }
    if (referenceResult.reference.kind !== expected.kind || referenceResult.reference.intent !== expected.intent
      || referenceResult.reference.owner !== expected.owner || referenceResult.reference.ref !== item.name) {
      return { status: 'unavailable', reason: 'The Host capability proof does not match the selected catalog item.' }
    }
    if (references.some(existing => sameReference(existing, referenceResult.reference))) return { status: 'already-added' }
    const id = requestId()
    const receipt = await settle(bridge.insertReference({ version: 1, requestId: id, target, reference: referenceResult.reference }, controller.signal), controller, timeoutMs)
    if (controller.signal.aborted) return { status: 'unavailable', reason: 'The Host did not confirm insertion in time.' }
    if (!receipt.ok || receipt.requestId !== id || receipt.target.workspaceId !== target.workspaceId || receipt.target.conversationId !== target.conversationId || receipt.reference?.id !== referenceResult.reference.id) {
      return { status: 'unavailable', reason: receipt.reason ?? 'The Host did not confirm insertion into the bound conversation draft.' }
    }
    return { status: 'added' }
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof OwnerTimeout ? 'The Host did not confirm insertion in time.' : controller.signal.aborted ? 'Adding the reference was cancelled.' : 'The bound conversation draft is unavailable.' }
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}
