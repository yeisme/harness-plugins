import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'
import { EikonaDiscoveryClient } from './eikona-discovery-client.ts'
import { createEikonaDiscoveryAdapter } from './eikona-discovery-adapter.ts'
import { createEikonaAdoptionActions } from './eikona-adoption-actions.ts'
import { prepareEikonaAdoption } from './eikona-adoption.ts'
import { createEikonaAdoptionDescriptor } from './eikona-adoption-descriptor.ts'
import { parseEikonaAdoptionRequest, EIKONA_ADOPT_ACTION } from './eikona-adoption-request.ts'
import { eikonaAdoptionPaneReceipt } from './eikona-pane-receipt.ts'

export interface EikonaReviewSelection { readonly artifactRef: string; readonly contentDigest: string }
/** Host selection is an explicit object reference, never a browser-provided owner URL. */
export function createEikonaReviewAdapter(client: EikonaDiscoveryClient, selection: (context: CreatorStudioContextV1) => Promise<EikonaReviewSelection | undefined>, configured = false): CreatorOwnerAdapterV1 {
  const base = createEikonaDiscoveryAdapter(client, configured)
  const same = (left: EikonaReviewSelection | undefined, right: EikonaReviewSelection | undefined) => !!left && !!right && left.artifactRef === right.artifactRef && left.contentDigest === right.contentDigest
  const actions = createEikonaAdoptionActions(client, async (artifactRef, contentDigest, context) => same(await selection(context), { artifactRef, contentDigest }))
  return {
    ...base,
    async snapshot(context) {
      const scope = { ...context }, current = await selection(scope)
      const snapshot = await base.snapshot(scope)
      const runId = current && /^eikona:\/\/artifacts\/([A-Za-z0-9][A-Za-z0-9._-]{0,159})\/[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.exec(current.artifactRef)?.[1]
      if (!current || !runId) return snapshot
      const discovery = await client.inspect(scope)
      if (discovery.status !== 'inspected') return snapshot
      const review = await client.readReview(scope, runId)
      if (!same(current, await selection(scope))) return { ...snapshot, actions: [], freshness: 'stale' }
      const prepared = prepareEikonaAdoption(discovery, review, current)
      const built = createEikonaAdoptionDescriptor(prepared, scope)
      if (!built) return snapshot
      return { ...snapshot, status: 'ready', freshness: 'fresh', summary: 'The selected Eikona candidate is ready for adoption review. Generation remains independently configured.', actions: [built.descriptor] }
    },
    async dispatch(raw, context) {
      const parsed = parseEikonaAdoptionRequest(raw, context)
      const current = await selection({ ...context })
      if (!parsed || !same(current, { artifactRef: parsed.artifactRef, contentDigest: parsed.values.content_digest })) return eikonaAdoptionPaneReceipt(EIKONA_ADOPT_ACTION, { status: 'permission_denied' })
      return actions.dispatch(raw, context)
    },
    reconcile(raw, context) { return actions.reconcile(raw, context) },
  }
}
