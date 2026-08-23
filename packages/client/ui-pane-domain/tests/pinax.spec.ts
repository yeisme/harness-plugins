import { describe, expect, it } from 'vitest'
import { PaneEventEnvelopeSchema, parsePaneActionDescriptor } from '@yeisme/dsh-pane-protocol'
import {
  PINAX_STREAM,
  createPinaxActionChannel,
  pinaxHandwrittenMetadataRead,
  pinaxNegativeRead,
  pinaxSnapshotRead,
  type PinaxNotesProjectionLike,
} from '../src/pinax.ts'

const context = { workspaceRef: 'workspace:pinax-demo', sessionRef: 'session:one', principalRef: 'principal:local', revision: '1' }

function notes(overrides: Partial<PinaxNotesProjectionLike> = {}): PinaxNotesProjectionLike {
  return {
    notes: [
      { id: 'note-8f14e45f', title: 'Inbox capture plan', kind: 'note', status: 'active', tags: ['inbox'] },
      { id: 'note-2c6242cb', title: 'Sync run log', tags: ['sync'] },
    ],
    ...overrides,
  }
}

describe('pinaxSnapshotRead', () => {
  it('builds a contract-shaped snapshot envelope with note entities and defaults', () => {
    const read = pinaxSnapshotRead(notes(), context)
    const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
    expect(parsed.stream).toBe(PINAX_STREAM)
    expect(parsed.status).toBe('ready')
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities.map(entity => entity.value)).toEqual([
        { title: 'Inbox capture plan', kind: 'note', status: 'active', tags: ['inbox'] },
        { title: 'Sync run log', kind: 'note', status: 'active', tags: ['sync'] },
      ])
    }
  })

  it('publishes only capture/sync gated actions that must run through the Pinax CLI/service', () => {
    const read = pinaxSnapshotRead(notes(), context)
    expect(read.actions).toEqual([{ id: 'inbox.capture', gated: true }, { id: 'sync.run', gated: true }])
  })

  it('rejects note refs by the owner allowlist (paths, URLs, credential shapes)', () => {
    const read = pinaxSnapshotRead({
      notes: [
        { id: '/home/user/notes/a.md', title: 'path', tags: [] },
        { id: 'https://example.com/note', title: 'url', tags: [] },
        { id: 'note-bearer-token', title: 'credential', tags: [] },
        { id: 'note:colon', title: 'colon', tags: [] },
        { id: 'note-clean.1', title: 'Clean', tags: [] },
      ],
    }, context)
    const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities).toHaveLength(1)
      expect(parsed.payload.entities[0]?.ref).toBe('note-clean.1')
    }
    expect(JSON.stringify(read)).not.toContain('/home/user')
    expect(JSON.stringify(read)).not.toContain('bearer')
  })

  it('maps a failed owner projection to offline, never an empty ready pane', () => {
    for (const status of ['failed', 'error', 'offline']) {
      const read = pinaxSnapshotRead(notes({ status }), context)
      const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
      expect(parsed.status, status).toBe('offline')
    }
    const denied = pinaxSnapshotRead(notes({ status: 'permission_denied' }), context)
    expect(PaneEventEnvelopeSchema.parse(denied.snapshot).status).toBe('permission_denied')
  })
})

describe('pinaxNegativeRead', () => {
  it('maps offline and permission_denied honestly', () => {
    const offline = PaneEventEnvelopeSchema.parse(pinaxNegativeRead('offline', context).snapshot)
    expect(offline.status).toBe('offline')
    expect(offline.freshness).toBe('unknown')
    const denied = PaneEventEnvelopeSchema.parse(pinaxNegativeRead('permission_denied', context).snapshot)
    expect(denied.status).toBe('permission_denied')
  })

  it('fails closed on handwritten metadata instead of accepting the blob', () => {
    const read = pinaxHandwrittenMetadataRead(context)
    const parsed = PaneEventEnvelopeSchema.parse(read.snapshot)
    expect(parsed.status).toBe('contract_mismatch')
    expect(read.actions).toEqual([])
  })
})

describe('createPinaxActionChannel', () => {
  it('previews server-authored descriptors naming the owner command', async () => {
    const channel = createPinaxActionChannel({ submit: async () => ({ status: 'accepted', receiptRef: 'receipt:1', summary: 'Captured' }) })
    const raw = await channel.preview({ actionId: 'inbox.capture' })
    const descriptor = parsePaneActionDescriptor(raw)
    expect(descriptor.actionId).toBe('inbox.capture')
    expect(descriptor.preview.summary).toContain('pinax inbox capture')
  })

  it('returns not_available for actions outside the owner contract', async () => {
    const channel = createPinaxActionChannel({ submit: async () => ({ status: 'accepted', receiptRef: 'receipt:1' }) })
    await expect(channel.preview({ actionId: 'note.edit.raw' })).resolves.toEqual({
      negative: 'not_available',
      reason: 'owner did not publish this action',
    })
  })

  it('refuses handwritten metadata blobs before they reach the owner', async () => {
    const submit = async () => ({ status: 'accepted', receiptRef: 'receipt:1' })
    const channel = createPinaxActionChannel({ submit })
    const raw = await channel.preview({ actionId: 'inbox.capture' })
    const descriptor = parsePaneActionDescriptor(raw)
    const outcome = await channel.submit({
      schema: 'pane.action-request.v1alpha1',
      descriptorRef: descriptor.descriptorRef,
      owner: 'pinax',
      actionId: 'inbox.capture',
      expectedTargetRef: descriptor.targetRef,
      expectedTargetVersion: descriptor.targetVersion,
      context,
      idempotencyKey: 'idem-0003',
      values: { metadata: 'schema_version: pinax.note.v1' },
    })
    expect(outcome).toEqual({ negative: 'not_available', reason: 'handwritten_metadata_rejected' })
  })

  it('forwards clean decisions to the Pinax service untouched', async () => {
    let seen: unknown
    const channel = createPinaxActionChannel({ submit: async request => { seen = request; return { status: 'accepted', receiptRef: 'receipt:2', summary: 'Synced' } } })
    const raw = await channel.preview({ actionId: 'sync.run' })
    const descriptor = parsePaneActionDescriptor(raw)
    const result = await channel.submit({
      schema: 'pane.action-request.v1alpha1',
      descriptorRef: descriptor.descriptorRef,
      owner: 'pinax',
      actionId: 'sync.run',
      expectedTargetRef: descriptor.targetRef,
      expectedTargetVersion: descriptor.targetVersion,
      context,
      idempotencyKey: 'idem-0002',
      values: {},
    })
    expect(result).toMatchObject({ status: 'accepted' })
    expect(seen).toMatchObject({ actionId: 'sync.run' })
  })
})
