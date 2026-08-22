import type { ArtifactRefV1, PaneActionReceiptV1, PaneActionRequestV1 } from '@yeisme/dsh-pane-protocol'
import {
  CREATOR_STUDIO_OWNERS,
  type CreatorMediaAccessV1,
  type CreatorOwnerAdapterV1,
  type CreatorStudioContextV1,
  type CreatorStudioOwner,
  type CreatorStudioTransportPolicyV1,
  type CreatorStudioTransportPreference,
} from './types.ts'

const DEFAULT_POLICY: CreatorStudioTransportPolicyV1 = { default: 'auto' }

function preferenceFor(policy: CreatorStudioTransportPolicyV1, owner: CreatorStudioOwner): CreatorStudioTransportPreference {
  return policy.owners?.[owner] ?? policy.default
}

/** Runtime-scoped adapter directory. Transport choice is deterministic and dispatch never falls back. */
export class CreatorStudioOwnerDirectory {
  private readonly adapters = new Map<CreatorStudioOwner, Map<'local' | 'service', CreatorOwnerAdapterV1>>()
  private revision = 1

  constructor(private readonly policy: CreatorStudioTransportPolicyV1 = DEFAULT_POLICY) {}

  get generation(): number { return this.revision }

  register(adapter: CreatorOwnerAdapterV1): () => void {
    if (!CREATOR_STUDIO_OWNERS.includes(adapter.owner)) throw new TypeError(`Unknown Creator Studio owner: ${adapter.owner}`)
    const byTransport = this.adapters.get(adapter.owner) ?? new Map()
    if (byTransport.has(adapter.transport)) throw new TypeError(`${adapter.owner} already has a ${adapter.transport} Creator Studio adapter`)
    byTransport.set(adapter.transport, adapter)
    this.adapters.set(adapter.owner, byTransport)
    this.revision += 1
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      if (byTransport.get(adapter.transport) !== adapter) return
      byTransport.delete(adapter.transport)
      if (byTransport.size === 0) this.adapters.delete(adapter.owner)
      this.revision += 1
    }
  }

  selected(owner: CreatorStudioOwner): CreatorOwnerAdapterV1 | undefined {
    const choices = this.adapters.get(owner)
    if (choices === undefined) return undefined
    const preference = preferenceFor(this.policy, owner)
    if (preference === 'local') return choices.get('local')
    if (preference === 'service') return choices.get('service')
    const service = choices.get('service')
    if (service?.configured === true) return service
    return choices.get('local') ?? service
  }

  async snapshot(owner: CreatorStudioOwner, context: CreatorStudioContextV1) {
    return this.selected(owner)?.snapshot(context)
  }

  async dispatch(owner: CreatorStudioOwner, request: PaneActionRequestV1, context: CreatorStudioContextV1): Promise<PaneActionReceiptV1 | undefined> {
    return this.selected(owner)?.dispatch(request, context)
  }

  async resolveArtifact(owner: CreatorStudioOwner, artifact: ArtifactRefV1, context: CreatorStudioContextV1): Promise<CreatorMediaAccessV1 | undefined> {
    return this.selected(owner)?.resolveArtifact?.(artifact, context)
  }
}
