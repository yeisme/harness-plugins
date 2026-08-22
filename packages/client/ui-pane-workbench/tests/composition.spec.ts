import { describe, expect, it, vi } from 'vitest'
import {
  PANE_ARTIFACT_SCHEMA,
  PANE_INTENT_SCHEMA,
  type ArtifactIntentV1,
} from '@yeisme/dsh-pane-protocol'
import { PaneCommandRegistry, PaneIntentDispatcher } from '../src/composition.ts'

const intent: ArtifactIntentV1 = {
  schema: PANE_INTENT_SCHEMA,
  intent: 'handoff',
  source: {
    schema: PANE_ARTIFACT_SCHEMA,
    owner: 'eikona',
    kind: 'image',
    ref: 'artifact:image:1',
    version: '1',
    mediaType: 'image/png',
    title: 'Frame one',
    evidenceRefs: [],
    capabilities: ['handoff'],
  },
  targetOwner: 'scaena',
  context: { workspaceRef: 'workspace:one', revision: '1' },
  idempotencyKey: 'handoff-image-0001',
}

describe('pane composition registries', () => {
  it('orders and executes local commands without remote code registration', async () => {
    const registry = new PaneCommandRegistry()
    const later = vi.fn(() => 'later')
    registry.register({
      descriptor: { id: 'creator.video', label: 'Video', presentation: { order: 20, task: 'video' } },
      execute: later,
    })
    registry.register({
      descriptor: { id: 'creator.text', label: 'Text', presentation: { order: 10, task: 'text' } },
      execute: () => 'text',
    })
    expect(registry.snapshot().map(item => item.descriptor.id)).toEqual(['creator.text', 'creator.video'])
    await expect(registry.execute('creator.video')).resolves.toBe('later')
    expect(later).toHaveBeenCalledOnce()
  })

  it('routes one artifact intent and fails closed when no provider remains', async () => {
    const dispatcher = new PaneIntentDispatcher()
    const handle = vi.fn(async () => ({
      status: 'accepted' as const,
      receiptRef: 'receipt:scaena:1',
      owner: 'scaena',
      actionId: 'asset.attach',
      summary: 'Asset attached.',
    }))
    const dispose = dispatcher.register({ id: 'creator.scaena-handoff', intents: ['handoff'], targetOwners: ['scaena'], handle })
    await expect(dispatcher.dispatch(intent)).resolves.toMatchObject({ status: 'accepted', owner: 'scaena' })
    expect(handle).toHaveBeenCalledWith(intent)
    dispose()
    await expect(dispatcher.dispatch(intent)).resolves.toMatchObject({ status: 'reconcile_required', reconcileReason: 'intent_handler_unavailable' })
  })

  it('turns handler exceptions into unknown receipts without retrying', async () => {
    const dispatcher = new PaneIntentDispatcher()
    const handle = vi.fn(() => { throw new Error('private transport detail') })
    dispatcher.register({ id: 'creator.unknown', handle })
    await expect(dispatcher.dispatch(intent)).resolves.toMatchObject({ status: 'unknown', reconcileReason: 'intent_settlement_unknown' })
    expect(handle).toHaveBeenCalledOnce()
  })
})
