import { describe, expect, it, vi } from 'vitest'
import { CreatorStudioOwnerDirectory } from '../src/directory.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = {
  tenantRef: 'tenant:one',
  workspaceRef: 'workspace:one',
  sessionRef: 'session:one',
  principalRef: 'principal:one',
  revision: '1',
  membershipRevision: '1',
  installationRef: 'install:web',
  pluginDigest: 'digest:creator',
  policyRevision: '1',
  runtimeGeneration: 'runtime:1',
}

function adapter(transport: 'local' | 'service', configured = false): CreatorOwnerAdapterV1 {
  return {
    owner: 'eikona',
    transport,
    configured,
    snapshot: vi.fn(async () => ({
      schemaVersion: 'creator.owner.snapshot.v1alpha1' as const,
      owner: 'eikona' as const,
      transport,
      snapshotRef: `eikona:${transport}:1`,
      snapshotVersion: 1,
      cursor: `cursor:eikona:${transport}:1`,
      sequence: -1,
      generatedAt: '2026-08-21T00:00:00Z',
      context,
      status: 'ready' as const,
      freshness: 'fresh' as const,
      summary: 'Ready',
      resources: [],
      actions: [],
    })),
    dispatch: vi.fn(async () => ({ status: 'accepted' as const, receiptRef: `receipt:${transport}:1` })),
  }
}

describe('CreatorStudioOwnerDirectory', () => {
  it('prefers an explicitly configured service and otherwise uses local', () => {
    const directory = new CreatorStudioOwnerDirectory()
    const local = adapter('local')
    const service = adapter('service')
    directory.register(local)
    directory.register(service)
    expect(directory.selected('eikona')).toBe(local)
    const configured = new CreatorStudioOwnerDirectory()
    configured.register(local)
    const configuredService = adapter('service', true)
    configured.register(configuredService)
    expect(configured.selected('eikona')).toBe(configuredService)
  })

  it('never falls back to another transport after a selection', async () => {
    const directory = new CreatorStudioOwnerDirectory({ default: 'service' })
    const local = adapter('local')
    const service = adapter('service', true)
    service.dispatch = vi.fn(async () => { throw new Error('uncertain') })
    directory.register(local)
    directory.register(service)
    await expect(directory.dispatch('eikona', {
      schema: 'pane.action-request.v1alpha1', descriptorRef: 'action:1', owner: 'eikona', actionId: 'generate.preview', expectedTargetRef: 'project:1', expectedTargetVersion: '1', context, idempotencyKey: 'generate-0001', values: {},
    }, context)).rejects.toThrow('uncertain')
    expect(local.dispatch).not.toHaveBeenCalled()
  })
})
