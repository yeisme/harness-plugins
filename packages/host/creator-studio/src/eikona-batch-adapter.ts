import { PaneActionReconcileRequestSchema } from '@yeisme/dsh-pane-protocol'
import { eikonaBatchInputQuerySchema } from './eikona-batch-input.ts'
import { createEikonaBatchDescriptor, parseEikonaBatchRequest, eikonaBatchPaneReceipt, EIKONA_BATCH_ACTION } from './eikona-batch-action.ts'
import type { EikonaDiscoveryClient } from './eikona-discovery-client.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'

/** Selection is a scoped draft reference; all execution facts remain with Eikona. */
export function withEikonaBatch(base: CreatorOwnerAdapterV1, client: EikonaDiscoveryClient, selection: (context: CreatorStudioContextV1) => Promise<unknown>): CreatorOwnerAdapterV1 {
  async function resolve(context: CreatorStudioContextV1) {
    try {
      const selected = eikonaBatchInputQuerySchema.safeParse(await selection(context))
      if (!selected.success) return undefined
      const pinned = await client.pin(context)
      if (!pinned || !await pinned.batchExecutionAvailable(context)) return undefined
      const plan = await pinned.readBatchPlan(context, selected.data)
      if (plan.status !== 'ready') return undefined
      const latest = eikonaBatchInputQuerySchema.safeParse(await selection(context))
      if (!latest.success || JSON.stringify(latest.data) !== JSON.stringify(selected.data)) return undefined
      const built = createEikonaBatchDescriptor(plan, context, plan.projectRef)
      return built ? { pinned, ...built } : undefined
    } catch { return undefined }
  }
  return {
    ...base,
    async snapshot(context) {
      const snapshot = await base.snapshot(context), ready = await resolve(context)
      return ready ? { ...snapshot, status: 'ready', freshness: 'fresh', actions: [...snapshot.actions, ready.descriptor] } : snapshot
    },
    async dispatch(raw, context) {
      if (raw.actionId !== EIKONA_BATCH_ACTION) return base.dispatch(raw, context)
      const parsed = parseEikonaBatchRequest(raw, context)
      if (!parsed) return eikonaBatchPaneReceipt({ status: 'invalid_input' })
      const ready = await resolve(context)
      if (!ready || ready.descriptor.descriptorRef !== parsed.request.descriptorRef) return eikonaBatchPaneReceipt({ status: 'needs_contract' })
      return eikonaBatchPaneReceipt(await ready.pinned.submitBatch(context, parsed.input))
    },
    async reconcile(raw, context) {
      if (raw.actionId !== EIKONA_BATCH_ACTION) return base.reconcile?.(raw, context) ?? eikonaBatchPaneReceipt({ status: 'unconfirmed' }, 'reconcile')
      const parsed = PaneActionReconcileRequestSchema.safeParse(raw)
      if (!parsed.success || parsed.data.owner !== 'eikona' || Object.keys(context).some(key => parsed.data.context[key as keyof typeof context] !== context[key as keyof typeof context])) return eikonaBatchPaneReceipt({ status: 'unconfirmed' }, 'reconcile')
      // The original actor/project/key identifies the immutable owner operation;
      // a refreshed plan or current selection must not replace that identity.
      return eikonaBatchPaneReceipt(await client.lookupBatch(context, { batchRef: parsed.data.expectedTargetRef, idempotencyKey: parsed.data.idempotencyKey }), 'reconcile')
    },
  }
}
