import { describe, expect, it, vi } from 'vitest'
import { addCapabilityReference } from '../src/client/draft-reference.ts'
import type { ToolHubItemV1 } from '../src/client/wire.ts'

const item: ToolHubItemV1 = { id: 'tool:read', family: 'native', origin: 'native', name: 'read', label: 'read', description: 'Read a file', source: 'session.tools', availability: 'available', enabled: true, canToggle: false }
const reference = { id: 'tool:read', kind: 'tool' as const, intent: 'capability' as const, owner: 'dsh.tools', ref: 'read', version: '1', label: 'read', scope: 'tool/available', digest: 'proof-a', freshness: 'fresh' as const }

describe('bound draft capability references', () => {
  it('captures inactive A and never redirects the receipt to active B', async () => {
    const insertReference = vi.fn(async detail => ({ requestId: detail.requestId, ok: true, target: detail.target, reference: { id: detail.reference.id } }))
    const bridge = {
      targetFor: vi.fn(async conversationId => ({ status: 'available' as const, snapshot: { target: { workspaceId: `workspace-${conversationId}`, conversationId, draftRevision: 7 }, references: [] } })),
      insertReference,
    }
    const resolver = { resolve: vi.fn(async () => ({ status: 'available' as const, reference })) }
    const ctx = { get: (key: string) => ({ composerReferenceBridge: bridge, composerReferenceCapabilityResolver: resolver })[key] }
    await expect(addCapabilityReference(ctx as never, 'A', item)).resolves.toEqual({ status: 'added' })
    expect(bridge.targetFor).toHaveBeenCalledWith('A', expect.any(AbortSignal))
    expect(resolver.resolve).toHaveBeenCalledWith({ sessionId: 'A', family: 'native', name: 'read' }, expect.any(AbortSignal))
    expect(insertReference).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ conversationId: 'A', workspaceId: 'workspace-A' }), reference }), expect.any(AbortSignal))
  })

  it('does not send, navigate, or duplicate when the target already contains the exact owner proof', async () => {
    const insertReference = vi.fn()
    const bridge = { targetFor: async () => ({ status: 'available' as const, snapshot: { target: { workspaceId: 'workspace-A', conversationId: 'A', draftRevision: 7 }, references: [reference] } }), insertReference }
    const resolver = { resolve: async () => ({ status: 'available' as const, reference }) }
    const ctx = { get: (key: string) => ({ composerReferenceBridge: bridge, composerReferenceCapabilityResolver: resolver })[key] }
    await expect(addCapabilityReference(ctx as never, 'A', item)).resolves.toEqual({ status: 'already-added' })
    expect(insertReference).not.toHaveBeenCalled()
  })

  it('keeps failure truthful when the Host denies the stale bound target', async () => {
    const bridge = { targetFor: async () => ({ status: 'available' as const, snapshot: { target: { workspaceId: 'workspace-A', conversationId: 'A', draftRevision: 7 }, references: [] } }), insertReference: async detail => ({ requestId: detail.requestId, ok: false, target: detail.target, reason: 'target draft changed' }) }
    const resolver = { resolve: async () => ({ status: 'available' as const, reference }) }
    const ctx = { get: (key: string) => ({ composerReferenceBridge: bridge, composerReferenceCapabilityResolver: resolver })[key] }
    await expect(addCapabilityReference(ctx as never, 'A', item)).resolves.toEqual({ status: 'unavailable', reason: 'target draft changed' })
  })

  it('settles a hung owner call on timeout and ignores any late success', async () => {
    let resolveInsert!: (value: { requestId: string; ok: boolean; target: { workspaceId: string; conversationId: string }; reference: { id: string } }) => void
    const bridge = {
      targetFor: async () => ({ status: 'available' as const, snapshot: { target: { workspaceId: 'workspace-A', conversationId: 'A', draftRevision: 7 }, references: [] } }),
      insertReference: (detail: { requestId: string; target: { workspaceId: string; conversationId: string }; reference: { id: string } }) => new Promise<typeof detail extends never ? never : { requestId: string; ok: boolean; target: { workspaceId: string; conversationId: string }; reference: { id: string } }>(done => { resolveInsert = done }),
    }
    const resolver = { resolve: async () => ({ status: 'available' as const, reference }) }
    const ctx = { get: (key: string) => ({ composerReferenceBridge: bridge, composerReferenceCapabilityResolver: resolver })[key] }
    await expect(addCapabilityReference(ctx as never, 'A', item, undefined, 1)).resolves.toMatchObject({ status: 'unavailable', reason: 'The Host did not confirm insertion in time.' })
    resolveInsert({ requestId: 'late', ok: true, target: { workspaceId: 'workspace-A', conversationId: 'A' }, reference: { id: reference.id } })
  })

  it('rejects a missing or mismatched Host request receipt', async () => {
    for (const requestId of [undefined, 'other']) {
      const bridge = { targetFor: async () => ({ status: 'available' as const, snapshot: { target: { workspaceId: 'workspace-A', conversationId: 'A', draftRevision: 7 }, references: [] } }), insertReference: async (detail: { requestId: string; target: { workspaceId: string; conversationId: string }; reference: { id: string } }) => ({ ...(requestId === undefined ? {} : { requestId }), ok: true, target: detail.target, reference: { id: detail.reference.id } }) }
      const resolver = { resolve: async () => ({ status: 'available' as const, reference }) }
      const ctx = { get: (key: string) => ({ composerReferenceBridge: bridge, composerReferenceCapabilityResolver: resolver })[key] }
      await expect(addCapabilityReference(ctx as never, 'A', item)).resolves.toMatchObject({ status: 'unavailable' })
    }
  })
})
