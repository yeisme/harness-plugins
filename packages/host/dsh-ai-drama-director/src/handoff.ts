/**
 * Workbench handoff signer/validator. Payload stays refs-only.
 * The digest is a local integrity check, not a secret-bearing signature.
 */

import {
  type WorkbenchHandoffV1,
  isSafeDramaRef,
  validateWorkbenchHandoff,
} from './contracts.js'

export const WORKBENCH_HANDOFF_INTENTS = [
  'open_show',
  'open_episode',
  'open_review',
  'open_artifact',
  'open_evidence',
] as const

export type WorkbenchHandoffIntentV1 = (typeof WORKBENCH_HANDOFF_INTENTS)[number]

export interface SignedWorkbenchHandoffV1 {
  readonly handoff: WorkbenchHandoffV1
  readonly digest: string
}

export function digestWorkbenchHandoff(handoff: WorkbenchHandoffV1): string {
  const body = [
    handoff.schema,
    handoff.contextRef,
    handoff.artifactRef ?? '',
    handoff.receiptRef ?? '',
    handoff.targetSurface,
    handoff.presentationIntent,
    String(handoff.expiresAt),
    handoff.nonce,
  ].join('|')
  let hash = 2_166_136_261
  for (let index = 0; index < body.length; index += 1) {
    hash ^= body.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0).toString(36)
}

export function createWorkbenchHandoff(input: {
  readonly contextRef: string
  readonly targetSurface: string
  readonly presentationIntent: WorkbenchHandoffIntentV1
  readonly nonce: string
  readonly expiresAt: number
  readonly artifactRef?: string
  readonly receiptRef?: string
}): SignedWorkbenchHandoffV1 | undefined {
  const handoff: WorkbenchHandoffV1 = {
    schema: 'drama.workbench-handoff.v1',
    contextRef: input.contextRef,
    targetSurface: input.targetSurface,
    presentationIntent: input.presentationIntent,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
    ...(input.artifactRef === undefined ? {} : { artifactRef: input.artifactRef }),
    ...(input.receiptRef === undefined ? {} : { receiptRef: input.receiptRef }),
  }
  if (!validateWorkbenchHandoff(handoff)) return undefined
  if (!WORKBENCH_HANDOFF_INTENTS.includes(input.presentationIntent)) return undefined
  return { handoff, digest: digestWorkbenchHandoff(handoff) }
}

export function verifyWorkbenchHandoff(
  signed: SignedWorkbenchHandoffV1,
  now = Date.now(),
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (!validateWorkbenchHandoff(signed.handoff)) {
    return { ok: false, reason: 'handoff failed contract validation' }
  }
  if (signed.handoff.expiresAt <= now) {
    return { ok: false, reason: 'handoff expired' }
  }
  if (signed.digest !== digestWorkbenchHandoff(signed.handoff)) {
    return { ok: false, reason: 'handoff digest mismatch' }
  }
  if (!isSafeDramaRef(signed.handoff.nonce)) {
    return { ok: false, reason: 'handoff nonce is unsafe' }
  }
  return { ok: true }
}
