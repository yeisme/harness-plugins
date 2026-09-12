import { createEikonaReviewAdapter, type EikonaReviewSelection } from './eikona-review-adapter.ts'
import { eikonaSelectionQuerySchema, type EikonaSelectionResult } from './eikona-selection-contract.ts'
import { eikonaReviewResultSchema } from './eikona-review-contract.ts'
import { validateCreatorStudioContext } from './validation.ts'
import type { EikonaDiscoveryClient } from './eikona-discovery-client.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'

const contextFields = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
const scopeKey = (context: CreatorStudioContextV1) => JSON.stringify(contextFields.map(key => context[key]))

/** Optional Host UI state. Domain decisions and execution remain in Eikona. */
export function createSelectableEikonaReviewAdapter(client: EikonaDiscoveryClient, configured = false): CreatorOwnerAdapterV1 {
  const selections = new Map<string, { selection?: EikonaReviewSelection }>()
  const base = createEikonaReviewAdapter(client, async context => selections.get(scopeKey(context))?.selection, configured)
  return {
    ...base,
    async selectEikonaCandidate(raw, context): Promise<EikonaSelectionResult> {
      const scope = validateCreatorStudioContext(context)
      if (!scope) return { status: 'permission_denied' }
      const key = scopeKey(scope), current: { selection?: EikonaReviewSelection } = {}
      // Invalidate the previous selection immediately, including pending reads.
      selections.delete(key)
      selections.set(key, current)
      while (selections.size > 64) selections.delete(selections.keys().next().value!)
      const query = eikonaSelectionQuerySchema.safeParse(raw)
      if (!query.success) return { status: 'invalid_input' }
      if (query.data.selection === null) return { status: 'cleared' }
      const selection = query.data.selection
      const runId = selection.artifactRef.split('/')[3]!
      try {
        const rawReview = await client.readReview(scope, runId)
        if (selections.get(key) !== current) return { status: 'superseded' }
        const parsed = eikonaReviewResultSchema.safeParse(rawReview)
        if (!parsed.success) return { status: 'needs_contract' }
        const review = parsed.data
        if (review.status !== 'ready') return review
        if (review.runId !== runId || !review.candidates.some(candidate => candidate.artifactRef === selection.artifactRef && candidate.contentDigest === selection.contentDigest)) return { status: 'unconfirmed' }
        current.selection = { ...selection }
        return { status: 'selected', selection: { ...selection } }
      } catch {
        return { status: selections.get(key) === current ? 'unconfirmed' : 'superseded' }
      }
    },
  }
}
