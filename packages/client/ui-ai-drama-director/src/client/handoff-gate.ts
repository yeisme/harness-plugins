/**
 * WorkbenchHandoffV1 consumption gate.
 *
 * Verification order is fixed: contract (including a strict payload key
 * allowlist — a handoff carrying content fields is rejected) → expiry →
 * digest integrity → nonce safety → nonce replay → intent whitelist. Only a
 * handoff that passes every stage consumes its nonce; rejections never burn
 * one. There is no auto-retry and no fuzzy-open fallback: every failure is
 * fail-closed with a redacted evidence record.
 */

import {
  WORKBENCH_HANDOFF_INTENTS,
  verifyWorkbenchHandoff,
  type DramaPaneId,
  type SignedWorkbenchHandoffV1,
  type WorkbenchHandoffIntentV1,
  type WorkbenchHandoffV1,
} from '@yeisme/dsh-ai-drama-director'
import { handoffRejectionEvidence, type DramaEvidenceEmitter } from './evidence.js'
import { createDramaNonceStore, type BoundedDedupStore } from './nonce-store.js'

export type DramaHandoffRejectionCategory =
  | 'contract'
  | 'payload'
  | 'expired'
  | 'digest'
  | 'nonce_unsafe'
  | 'nonce_replay'
  | 'intent'
  | 'target_missing'

export type DramaHandoffGateResult =
  | { readonly ok: true; readonly handoff: WorkbenchHandoffV1; readonly intent: WorkbenchHandoffIntentV1 }
  | { readonly ok: false; readonly category: DramaHandoffRejectionCategory; readonly reason: string }

/** Own-key allowlist: anything beyond refs/versions/intent is content. */
export const DRAMA_HANDOFF_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'schema',
  'contextRef',
  'artifactRef',
  'receiptRef',
  'targetSurface',
  'presentationIntent',
  'expiresAt',
  'nonce',
])

/** Declared intent → in-repo target view routing. */
export const DRAMA_HANDOFF_TARGET_VIEWS: Readonly<Record<WorkbenchHandoffIntentV1, DramaPaneId>> = {
  open_show: 'Context',
  open_episode: 'Context',
  open_review: 'Review',
  open_artifact: 'Visual',
  open_evidence: 'Review',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function rejection(
  category: DramaHandoffRejectionCategory,
  reason: string,
): DramaHandoffGateResult {
  return { ok: false, category, reason }
}

const VERIFY_REASON_CATEGORY: Readonly<Record<string, DramaHandoffRejectionCategory>> = {
  'handoff failed contract validation': 'contract',
  'handoff expired': 'expired',
  'handoff digest mismatch': 'digest',
  'handoff nonce is unsafe': 'nonce_unsafe',
}

export interface DramaHandoffGateOptions {
  readonly nonceStore?: BoundedDedupStore
  readonly emitter?: DramaEvidenceEmitter
  readonly now?: () => number
}

export interface DramaHandoffGate {
  consume(input: unknown): DramaHandoffGateResult
  readonly nonceStore: BoundedDedupStore
}

export function createDramaHandoffGate(options: DramaHandoffGateOptions = {}): DramaHandoffGate {
  const nonceStore = options.nonceStore ?? createDramaNonceStore({ ...(options.now === undefined ? {} : { now: options.now }) })
  const now = options.now ?? Date.now

  const reject = (category: DramaHandoffRejectionCategory, reason: string): DramaHandoffGateResult => {
    const evidence = handoffRejectionEvidence(category)
    options.emitter?.emit(evidence.kind, { reasonCategory: evidence.reasonCategory })
    return rejection(category, reason)
  }

  return {
    nonceStore,
    consume(input) {
      // Stage 1 — contract: signed envelope shape, payload key allowlist,
      // then the host contract validator.
      if (!isRecord(input) || !isRecord(input.handoff) || typeof input.digest !== 'string') {
        return reject('contract', 'handoff envelope is not a signed handoff')
      }
      for (const key of Object.keys(input.handoff)) {
        if (!DRAMA_HANDOFF_ALLOWED_KEYS.has(key)) {
          return reject('payload', 'handoff payload carries content fields; only opaque refs are accepted')
        }
      }
      const signed = input as unknown as SignedWorkbenchHandoffV1

      // Stages 2–4 — expiry, digest integrity, nonce safety (host order).
      const verified = verifyWorkbenchHandoff(signed, now())
      if (!verified.ok) {
        return reject(VERIFY_REASON_CATEGORY[verified.reason] ?? 'contract', verified.reason)
      }

      // Stage 5 — intent whitelist (before consuming the nonce, so a
      // rejected handoff never burns it).
      const intent = signed.handoff.presentationIntent
      if (!WORKBENCH_HANDOFF_INTENTS.includes(intent as WorkbenchHandoffIntentV1)) {
        return reject('intent', `handoff intent ${intent} is not in the whitelist`)
      }

      // Stage 6 — nonce replay (bounded session dedup; sweeps expired
      // entries). This is the only stage that consumes a nonce.
      if (nonceStore.mark(signed.handoff.nonce, signed.handoff.expiresAt) === 'replay') {
        return reject('nonce_replay', 'handoff nonce was already consumed')
      }

      return { ok: true, handoff: signed.handoff, intent: intent as WorkbenchHandoffIntentV1 }
    },
  }
}

export type DramaHandoffTargetResolution =
  | { readonly ok: true; readonly view: DramaPaneId }
  | { readonly ok: false; readonly category: 'target_missing'; readonly reason: string }

/**
 * Resolves the in-repo target view for an accepted intent. A missing or
 * dependency-disabled target fails closed with install guidance — never an
 * approximate substitute page.
 */
export function resolveDramaHandoffTarget(
  intent: WorkbenchHandoffIntentV1,
  isViewAvailable: (view: DramaPaneId) => { readonly disabled: boolean; readonly reason?: string },
): DramaHandoffTargetResolution {
  const view = DRAMA_HANDOFF_TARGET_VIEWS[intent]
  const availability = isViewAvailable(view)
  if (availability.disabled) {
    return {
      ok: false,
      category: 'target_missing',
      reason: `handoff target ${view} is unavailable (${availability.reason ?? 'not installed'}); install or enable the owning bundle, then retry from the source`,
    }
  }
  return { ok: true, view }
}
