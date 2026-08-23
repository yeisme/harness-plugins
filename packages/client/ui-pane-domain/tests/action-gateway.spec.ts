import { describe, expect, it, vi } from 'vitest'
import { parsePaneActionDescriptor, type PaneActionDescriptorV1, type PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import { DomainActionGateway, type DomainActionOwnerChannel } from '../src/action-gateway.ts'

const context: PaneContextV1 = {
  workspaceRef: 'workspace:sonora-demo',
  sessionRef: 'session:one',
  principalRef: 'principal:local',
  revision: '1',
}

function descriptor(overrides: Record<string, unknown> = {}): unknown {
  return {
    schema: 'pane.action-descriptor.v1alpha1',
    descriptorRef: 'descriptor:render-1',
    owner: 'sonora',
    actionId: 'render.take',
    label: 'Render take',
    targetRef: 'take:voice-a',
    targetVersion: '3',
    context,
    risk: 'medium',
    confirmation: 'approval',
    expiresAt: '2999-01-01T00:00:00.000Z',
    preview: {
      summary: 'Render voice take A',
      cost: { currency: 'USD', amount: 0.12, estimate: true },
      rights: { status: 'clear', summary: 'Workspace rights cover this take.' },
    },
    fields: [],
    ...overrides,
  }
}

function receipt(status: string, extra: Record<string, unknown> = {}): unknown {
  return { status, receiptRef: 'receipt:1', actionId: 'render.take', summary: 'Owner settled.', ...extra }
}

describe('DomainActionGateway preview', () => {
  it('returns the server-authored descriptor after schema validation', async () => {
    const gateway = new DomainActionGateway({ preview: async () => descriptor(), submit: async () => receipt('accepted') })
    const outcome = await gateway.preview({ actionId: 'render.take', targetRef: 'take:voice-a' })
    expect(outcome.kind).toBe('descriptor')
    if (outcome.kind === 'descriptor') {
      expect(parsePaneActionDescriptor(outcome.descriptor)).toMatchObject({ actionId: 'render.take', owner: 'sonora' })
    }
  })

  it('fails visible when the owner requires approval or publishes no preview', async () => {
    const approval = new DomainActionGateway({ preview: async () => ({ negative: 'approval_required', reason: 'rights_or_cost_preview_missing' }), submit: async () => receipt('accepted') })
    await expect(approval.preview({ actionId: 'render.take' })).resolves.toEqual({ kind: 'approval_required', reason: 'rights_or_cost_preview_missing' })

    const unavailable = new DomainActionGateway({ preview: async () => ({ negative: 'not_available', reason: 'owner did not open this action' }), submit: async () => receipt('accepted') })
    await expect(unavailable.preview({ actionId: 'render.take' })).resolves.toEqual({ kind: 'not_available', reason: 'owner did not open this action' })
  })

  it('treats a malformed descriptor as contract mismatch, never as renderable', async () => {
    const gateway = new DomainActionGateway({ preview: async () => ({ schema: 'pane.action-descriptor.v1alpha1', bogus: true }), submit: async () => receipt('accepted') })
    await expect(gateway.preview({ actionId: 'render.take' })).resolves.toEqual({ kind: 'contract_mismatch' })
  })

  it('requires configured preview facets (cost/rights) before a mutation becomes possible', async () => {
    const noRights = descriptor({ preview: { summary: 'Render take', cost: { currency: 'USD', amount: 0.12, estimate: true } } })
    const gateway = new DomainActionGateway({ preview: async () => noRights, submit: async () => receipt('accepted') }, { requirePreviewFields: ['cost', 'rights'] })
    await expect(gateway.preview({ actionId: 'render.take' })).resolves.toEqual({ kind: 'approval_required', reason: 'rights_preview_missing' })
  })

  it('reconciles on owner errors and timeouts instead of guessing', async () => {
    const failing = new DomainActionGateway({ preview: async () => { throw new Error('owner down') }, submit: async () => receipt('accepted') })
    await expect(failing.preview({ actionId: 'render.take' })).resolves.toEqual({ kind: 'reconcile_required', reason: 'owner_unreachable' })

    const hanging = new DomainActionGateway({ preview: () => new Promise(() => {}), submit: async () => receipt('accepted') }, { deadlineMs: 5 })
    await expect(hanging.preview({ actionId: 'render.take' })).resolves.toEqual({ kind: 'reconcile_required', reason: 'timeout' })
  })

  it('rejects an expired descriptor without touching the owner', async () => {
    const submit = vi.fn(async () => receipt('accepted'))
    const gateway = new DomainActionGateway({ preview: async () => descriptor({ expiresAt: '2000-01-01T00:00:00.000Z' }), submit })
    await expect(gateway.preview({ actionId: 'render.take' })).resolves.toEqual({ kind: 'reconcile_required', reason: 'descriptor_expired' })
    expect(submit).not.toHaveBeenCalled()
  })
})

describe('DomainActionGateway submit', () => {
  it('builds the request only from the server-authored descriptor and declared fields', async () => {
    const withFields = descriptor({ fields: [{ key: 'voiceStyle', label: 'Voice style', kind: 'select', required: true, options: [{ value: 'warm', label: 'Warm' }] }] })
    const parsed = parsePaneActionDescriptor(withFields)
    let seen: unknown
    const gateway = new DomainActionGateway({
      preview: async () => withFields,
      submit: async request => { seen = request; return receipt('accepted') },
    })
    const outcome = await gateway.submit(parsed as PaneActionDescriptorV1, { voiceStyle: 'warm', rogueField: 'drop me' } as never, context)
    expect(outcome.kind).toBe('receipt')
    expect(seen).toMatchObject({
      schema: 'pane.action-request.v1alpha1',
      descriptorRef: 'descriptor:render-1',
      owner: 'sonora',
      actionId: 'render.take',
      expectedTargetRef: 'take:voice-a',
      expectedTargetVersion: '3',
      values: { voiceStyle: 'warm' },
    })
    expect(JSON.stringify(seen)).not.toContain('rogueField')
  })

  it('maps an owner receipt verbatim and never upgrades unknown to success', async () => {
    const accepted = new DomainActionGateway({ preview: async () => descriptor(), submit: async () => receipt('accepted') })
    const ok = await accepted.submit(parsePaneActionDescriptor(descriptor()) as PaneActionDescriptorV1, {}, context)
    expect(ok).toMatchObject({ kind: 'receipt', receipt: { status: 'accepted' } })

    const unknown = new DomainActionGateway({ preview: async () => descriptor(), submit: async () => receipt('unknown') })
    await expect(unknown.submit(parsePaneActionDescriptor(descriptor()) as PaneActionDescriptorV1, {}, context))
      .resolves.toEqual({ kind: 'reconcile_required', reason: 'unknown_receipt' })

    const malformed = new DomainActionGateway({ preview: async () => descriptor(), submit: async () => ({ nope: true }) })
    await expect(malformed.submit(parsePaneActionDescriptor(descriptor()) as PaneActionDescriptorV1, {}, context))
      .resolves.toEqual({ kind: 'reconcile_required', reason: 'unknown_receipt' })
  })

  it('reconciles on submit timeout without optimistic success', async () => {
    const gateway = new DomainActionGateway({ preview: async () => descriptor(), submit: () => new Promise(() => {}) }, { deadlineMs: 5 })
    await expect(gateway.submit(parsePaneActionDescriptor(descriptor()) as PaneActionDescriptorV1, {}, context))
      .resolves.toEqual({ kind: 'reconcile_required', reason: 'timeout' })
  })

  it('is idempotent per idempotency key: the owner channel sees one submit', async () => {
    const submit = vi.fn(async () => receipt('accepted'))
    const gateway = new DomainActionGateway({ preview: async () => descriptor(), submit })
    const key = 'idem-key-0001'
    const first = await gateway.submit(parsePaneActionDescriptor(descriptor()) as PaneActionDescriptorV1, {}, context, key)
    const second = await gateway.submit(parsePaneActionDescriptor(descriptor()) as PaneActionDescriptorV1, {}, context, key)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })
})
