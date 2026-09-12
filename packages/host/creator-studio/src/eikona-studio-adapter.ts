import { withEikonaBatch } from './eikona-batch-adapter.ts'
import { eikonaBatchInputQuerySchema } from './eikona-batch-input.ts'
import { createSelectableEikonaReviewAdapter } from './eikona-selection-adapter.ts'
import { withEikonaGeneration } from './eikona-generation-adapter.ts'
import { eikonaApprovalResultSchema, type EikonaApprovalResult } from './eikona-preparation-approval.ts'
import { validateCreatorStudioContext } from './validation.ts'
import type { EikonaDiscoveryClient } from './eikona-discovery-client.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'

const fields = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
const keyOf = (context: CreatorStudioContextV1) => JSON.stringify(fields.map(field => context[field]))

/** Ephemeral selection of owner-returned approvals, never a new approval ledger. */
export function createEikonaStudioAdapter(client: EikonaDiscoveryClient, configured = false, existingBase?: CreatorOwnerAdapterV1): CreatorOwnerAdapterV1 {
  type Selection = { approval?: Extract<EikonaApprovalResult, { status: 'approved' }> }
  const selections = new Map<string, Selection>()
  const base = existingBase ?? createSelectableEikonaReviewAdapter(client, configured)
  if (base.owner !== 'eikona') throw new Error('Eikona studio requires an Eikona base adapter')
  const batchSelections = new Map<string, { selected?: { batchRef: string; digest: string } }>()
  const generated = withEikonaGeneration(base, client, async context => selections.get(keyOf(context))?.approval)
  const invalidate = (context: CreatorStudioContextV1) => {
    const key = keyOf(context), selection: Selection = {}
    selections.delete(key); selections.set(key, selection)
    while (selections.size > 64) selections.delete(selections.keys().next().value!)
    return { key, selection }
  }
  return {
    ...withEikonaBatch(generated, client, async context => batchSelections.get(keyOf(context))?.selected),
    async readEikonaBatchPlan(input, context) {
      const scope = validateCreatorStudioContext(context), query = eikonaBatchInputQuerySchema.safeParse(input)
      if (!scope || !query.success) return { status: 'invalid_input' }
      const key = keyOf(scope), entry: { selected?: { batchRef: string; digest: string } } = {}
      batchSelections.delete(key); batchSelections.set(key, entry)
      while (batchSelections.size > 64) batchSelections.delete(batchSelections.keys().next().value!)
      const result = await client.readBatchPlan(scope, query.data)
      if (batchSelections.get(key) !== entry) return { status: 'unconfirmed' }
      if (result.status === 'ready' && result.planStatus === 'ready') entry.selected = query.data
      return result
    },
    async prepareEikonaGeneration(input, context) {
      invalidate(context)
      return client.prepareGeneration(context, input)
    },
    async approveEikonaPreparation(input, context) {
      const scope = validateCreatorStudioContext(context)
      if (!scope) return { status: 'permission_denied' }
      const { key, selection } = invalidate(scope)
      try {
        const result = eikonaApprovalResultSchema.safeParse(await client.approvePreparation(scope, input))
        if (selections.get(key) !== selection || !result.success) return { status: 'unconfirmed' }
        if (result.data.status === 'approved') selection.approval = result.data
        return result.data
      } catch { return { status: 'unconfirmed' } }
    },
    async revokeEikonaPreparationApproval(input, context) {
      invalidate(context)
      return client.revokePreparationApproval(context, input)
    },
  }
}
