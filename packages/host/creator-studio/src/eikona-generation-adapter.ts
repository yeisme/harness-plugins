import { PaneActionReconcileRequestSchema } from '@yeisme/dsh-pane-protocol'
import { eikonaApprovalResultSchema } from './eikona-preparation-approval.ts'
import { bindEikonaGeneration } from './eikona-generation-binding.ts'
import { createEikonaGenerationDescriptor } from './eikona-generation-descriptor.ts'
import { EIKONA_GENERATE_ACTION, parseEikonaGenerationRequest } from './eikona-generation-request.ts'
import { eikonaGenerationPaneReceipt } from './eikona-generation-pane-receipt.ts'
import type { EikonaDiscoveryClient } from './eikona-discovery-client.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'

/** Selection comes from the Host's approved binding, never arbitrary UI fields. */
export function withEikonaGeneration(base: CreatorOwnerAdapterV1, client: EikonaDiscoveryClient,
  selection: (context: CreatorStudioContextV1) => Promise<unknown>): CreatorOwnerAdapterV1 {
  async function resolve(context: CreatorStudioContextV1) {
    try {
    const selected = eikonaApprovalResultSchema.safeParse(await selection(context))
    if (!selected.success || selected.data.status !== 'approved') return undefined
    const approved = selected.data, pinned = await client.pin(context)
    if (!pinned) return undefined
    const discovered = await pinned.inspect(context)
    if (discovered.status !== 'inspected' || !discovered.generationAvailable) return undefined
    const preparation = await pinned.readPreparation(context, approved.preparationRef)
    const observation = await pinned.readApprovalStatus(context, approved.approvalRef)
    const latest = eikonaApprovalResultSchema.safeParse(await selection(context))
    if (!latest.success || JSON.stringify(latest.data) !== JSON.stringify(approved)) return undefined
    const bound = bindEikonaGeneration(preparation, approved, observation, approved.projectId)
    const descriptor = createEikonaGenerationDescriptor(preparation, approved, observation, context, Date.now(), approved.projectId)
    return bound && descriptor ? { pinned, bound, ...descriptor } : undefined
    } catch { return undefined }
  }
  return {
    ...base,
    async snapshot(context) {
      const snapshot = await base.snapshot(context)
      const ready = await resolve(context)
      return ready ? { ...snapshot, status: 'ready', freshness: 'fresh', summary: 'The selected fixed Eikona preparation is ready for generation confirmation.', actions: [...snapshot.actions, ready.descriptor] } : snapshot
    },
    async dispatch(raw, context) {
      if (raw.actionId !== EIKONA_GENERATE_ACTION) return base.dispatch(raw, context)
      const parsed = parseEikonaGenerationRequest(raw, context)
      if (!parsed) return eikonaGenerationPaneReceipt({ status: 'invalid_input' })
      const ready = await resolve(context)
      if (!ready || ready.descriptor.descriptorRef !== parsed.request.descriptorRef) return eikonaGenerationPaneReceipt({ status: 'needs_contract' })
      return eikonaGenerationPaneReceipt(await ready.pinned.submitGeneration(context, { request: ready.bound.request, idempotencyKey: parsed.request.idempotencyKey, confirmed: true }))
    },
    async reconcile(raw, context) {
      if (raw.actionId !== EIKONA_GENERATE_ACTION) return base.reconcile?.(raw, context) ?? eikonaGenerationPaneReceipt({ status: 'unconfirmed' }, 'reconcile')
      const query = PaneActionReconcileRequestSchema.safeParse(raw)
      if (!query.success || query.data.owner !== 'eikona' || !/^egp_[a-f0-9]{64}$/u.test(query.data.expectedTargetRef)
        || Object.keys(context).some(key => query.data.context[key as keyof typeof context] !== context[key as keyof typeof context])) return eikonaGenerationPaneReceipt({ status: 'unconfirmed' }, 'reconcile')
      const pinned = await client.pin(context)
      if (!pinned) return eikonaGenerationPaneReceipt({ status: 'unconfirmed' }, 'reconcile')
      const preparation = await pinned.readPreparation(context, query.data.expectedTargetRef)
      if (preparation.status !== 'ready') return eikonaGenerationPaneReceipt({ status: 'unconfirmed' }, 'reconcile')
      return eikonaGenerationPaneReceipt(await pinned.reconcileGeneration(context, { projectId: preparation.projectId, idempotencyKey: query.data.idempotencyKey }), 'reconcile')
    },
  }
}
