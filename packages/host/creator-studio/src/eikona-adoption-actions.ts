import type { CreatorStudioContextV1 } from './types.ts'
import type { EikonaDiscoveryClient } from './eikona-discovery-client.ts'
import { prepareEikonaAdoption } from './eikona-adoption.ts'
import { EIKONA_ADOPT_ACTION, parseEikonaAdoptionRequest } from './eikona-adoption-request.ts'
import { eikonaAdoptionPaneReceipt } from './eikona-pane-receipt.ts'
import { PaneActionReconcileRequestSchema } from '@yeisme/dsh-pane-protocol'

/** Action methods consumed by the registered owner adapter, behind Gateway admission. */
export function createEikonaAdoptionActions(client: EikonaDiscoveryClient, stillSelected?: (artifactRef: string, contentDigest: string, context: CreatorStudioContextV1) => Promise<boolean>) {
  return {
    async dispatch(raw: unknown, context: CreatorStudioContextV1) {
      const scope = { ...context }, parsed = parseEikonaAdoptionRequest(raw, scope)
      if (!parsed) return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: 'invalid_input' })
      const discovery = await client.inspect(scope)
      if (discovery.status !== 'inspected') return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: 'needs_contract' })
      const review = await client.readReview(scope, parsed.values.run_id)
      const prepared = prepareEikonaAdoption(discovery, review, { artifactRef: parsed.artifactRef, contentDigest: parsed.values.content_digest })
      if (prepared.status !== 'prepared') return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: prepared.status === 'permission_denied' ? 'permission_denied' : 'needs_contract' })
      const version = 'expected_version' in prepared.request ? Number(prepared.request.expected_version) : 0
      if (version !== parsed.values.decision_version) return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: 'invalid_input' })
      if (stillSelected && !await stillSelected(parsed.artifactRef, parsed.values.content_digest, scope)) return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: 'permission_denied' })
      return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, await client.submitAdoption(scope, { request: prepared.request, idempotencyKey: parsed.request.idempotencyKey, confirmed: true }))
    },
    async reconcile(raw: unknown, context: CreatorStudioContextV1) {
      const scope = { ...context }, parsed = parseEikonaAdoptionRequest(raw, scope)
      if (!parsed) {
        const lookup = PaneActionReconcileRequestSchema.safeParse(raw)
        if (!lookup.success || lookup.data.owner !== 'eikona' || lookup.data.actionId !== EIKONA_ADOPT_ACTION
          || Object.keys(scope).some(key => lookup.data.context[key as keyof typeof scope] !== scope[key as keyof typeof scope])) return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: 'unconfirmed' }, 'reconcile')
        const match = /^eikona:\/\/artifacts\/([A-Za-z0-9][A-Za-z0-9._-]{0,159})\/([A-Za-z0-9][A-Za-z0-9._-]{0,159})$/u.exec(lookup.data.expectedTargetRef)
        if (!match) return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: 'unconfirmed' }, 'reconcile')
        const review = await client.readReview(scope, match[1]!)
        if (review.status !== 'ready') return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: 'unconfirmed' }, 'reconcile')
        return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, await client.recoverAdoption(scope, { runId: match[1]!, candidateId: match[2]!, projectId: review.projectId, idempotencyKey: lookup.data.idempotencyKey }), 'reconcile')
      }
      // Current read resolves owner project authorization; its candidate version never replaces the original.
      const review = await client.readReview(scope, parsed.values.run_id)
      if (review.status !== 'ready') return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: 'unconfirmed' }, 'reconcile')
      return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, await client.reconcileAdoption(scope, {
        runId: parsed.values.run_id, candidateId: parsed.values.candidate_id, decisionVersion: parsed.values.decision_version,
        idempotencyKey: parsed.request.idempotencyKey, projectId: review.projectId,
      }), 'reconcile')
    },
  }
}
