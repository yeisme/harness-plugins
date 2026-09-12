import type { CreatorOwnerAdapterV1, CreatorOwnerSnapshotV1, CreatorStudioContextV1 } from './types.ts'
import { EikonaDiscoveryClient } from './eikona-discovery-client.ts'

/** Discovery-only slice. Capability rows are not executable action descriptors. */
export function createEikonaDiscoveryAdapter(client: EikonaDiscoveryClient, configured = false,
  selectedPreparation?: (context: CreatorStudioContextV1) => Promise<{ preparationRef: string; digest: string } | undefined>): CreatorOwnerAdapterV1 {
  let sequence = 0
  return {
    owner: 'eikona', transport: 'service', configured,
    listEikonaBatchInputs(input, context) { return client.listBatchInputs(context, input) },
    readEikonaBatchMembers(input, context) { return client.readBatchMembers(context, input) },
    readEikonaBatchPlan(input, context) { return client.readBatchPlan(context, input) },
    readEikonaBatchInput(input, context) { return client.readBatchInput(context, input) },
    readEikonaApprovalStatus(input, context) { return client.readApprovalStatus(context, input.approvalRef) },
    revokeEikonaPreparationApproval(input, context) { return client.revokePreparationApproval(context, input) },
    approveEikonaPreparation(input, context) { return client.approvePreparation(context, input) },
    prepareEikonaGeneration(input, context) { return client.prepareGeneration(context, input) },
    readEikonaReview(query, context) { return client.readReview(context, query.runId) },
    readEikonaCandidateImage(query, context) { return client.readCandidateImage(context, query) },
    readEikonaAssetPage(query, context) { return client.listAssets(context, query) },
    async snapshot(context): Promise<CreatorOwnerSnapshotV1> {
      const scope = { ...context }
      const result = await client.inspect(scope)
      const inspected = result.status === 'inspected' ? result : undefined
      const selected = inspected && selectedPreparation ? await selectedPreparation(scope) : undefined
      const fixed = selected ? await client.readPreparation(scope, selected.preparationRef) : undefined
      const latest = selected && selectedPreparation ? await selectedPreparation(scope) : undefined
      const ready = fixed?.status === 'ready' && fixed.digest === selected?.digest
        && latest?.preparationRef === selected?.preparationRef && latest?.digest === selected?.digest ? fixed : undefined
      const current = ++sequence
      return {
        schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'eikona', transport: 'service',
        snapshotRef: `eikona:discovery:${current}`, snapshotVersion: current, cursor: `eikona:discovery:${current}`, sequence: current,
        generatedAt: inspected?.observedAt ?? new Date().toISOString(), context: scope,
        status: result.status === 'permission_denied' ? 'permission_denied' : inspected ? 'attention_required' : result.status === 'needs_contract' ? 'contract_mismatch' : 'unknown',
        freshness: inspected ? 'fresh' : 'unknown',
        summary: inspected ? 'Eikona capabilities were inspected. Generation configuration and execution are not connected.' : 'Eikona discovery could not be verified. Check the owner connection and contract admission.',
        resources: [...(inspected?.operations.map(operation => ({
          ref: `eikona:capability:${operation.action}`, version: inspected.schemaDigest, kind: 'owner-capability',
          title: operation.action, status: operation.readiness,
          summary: operation.reasonCode ?? 'An authorized action descriptor and owner input preview are required.', evidenceRefs: [],
        })) ?? []), ...(inspected?.preparationAvailable ? [{ ref: 'eikona:capability:preparation', version: inspected.schemaDigest, kind: 'preparation-capability',
          title: 'Fixed preparation', status: 'available', summary: 'Preparation is available; execution requires separate approval.', evidenceRefs: [] }] : []), ...(inspected?.approvalAvailable ? [{ ref: 'eikona:capability:approval', version: inspected.schemaDigest, kind: 'approval-capability', title: 'Budget approval', status: 'available', evidenceRefs: [] }] : []), ...(ready ? [{ ref: ready.preparationRef, version: ready.digest, kind: 'generation-preparation',
          title: 'Fixed generation preparation', status: 'review_required',
          summary: `Model: ${ready.modelRef}; candidates: 1; cost: unknown; execution: not authorized. ${Object.entries(ready.controls).filter(([key]) => key !== 'model_ref' && key !== 'candidate_count').map(([key, value]) => `${key}: ${String(value)}`).join('; ')}`,
          evidenceRefs: [] }] : [])],
        actions: [],
      }
    },
    dispatch() {
      return { owner: 'eikona', actionId: 'discovery', status: 'rejected', receiptRef: 'eikona:discovery:dispatch-unavailable',
        summary: 'This adapter only inspects capabilities; no operation was submitted.' }
    },
  }
}
