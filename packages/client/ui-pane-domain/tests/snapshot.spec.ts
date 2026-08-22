import { describe, expect, it } from 'vitest'
import { PaneEventEnvelopeSchema } from '@yeisme/dsh-pane-protocol'
import { ArtifactIntentSchema } from '@yeisme/dsh-pane-protocol'
import { domainArtifact, domainIntent, domainSnapshotEvent, normalizeDomainSnapshot } from '../src/snapshot.ts'
import { admitDomainAction, admitOrdoClientAction, interpretTimeout } from '../src/actions.ts'
import type { DomainSnapshotV1 } from '../src/snapshot.ts'

const context = {
  workspaceRef: 'workspace:demo',
  sessionRef: 'session:one',
  principalRef: 'principal:local',
  revision: '1',
}

function gallery(): DomainSnapshotV1 {
  return {
    owner: 'eikona',
    status: 'ready',
    freshness: 'fresh',
    items: [
      { ref: 'artifact:eikona:1', title: 'Variant 1', version: '1', kind: 'image', status: 'accepted' },
      { ref: '/etc/passwd', title: 'bad', version: '1', kind: 'image', status: 'accepted' },
    ],
    allowedActions: [{ id: 'generate.preview', gated: true }, { id: 'review.accept', gated: true }],
  }
}

describe('domain snapshot mapping', () => {
  it('redacts unsafe refs and defaults the Eikona model', () => {
    const snapshot = normalizeDomainSnapshot(gallery())
    expect(snapshot.items).toHaveLength(1)
    expect(snapshot.modelRef).toBe('openai/gpt-5.4-image-2')
    expect(JSON.stringify(snapshot)).not.toContain('/etc/passwd')
  })

  it('emits a Pane snapshot envelope the protocol accepts', () => {
    const event = domainSnapshotEvent(gallery(), context)
    const parsed = PaneEventEnvelopeSchema.parse(event)
    expect(parsed.op).toBe('snapshot')
    expect(parsed.status).toBe('ready')
    if (parsed.op === 'snapshot') {
      expect(parsed.payload.entities[0]?.ref).toBe('artifact:eikona:1')
    }
  })

  it('builds an ArtifactRef without mutating owner state', () => {
    const snapshot = normalizeDomainSnapshot(gallery())
    const artifact = domainArtifact(snapshot, snapshot.items[0]!)
    expect(artifact.owner).toBe('eikona')
    expect(artifact.ref).toBe('artifact:eikona:1')
  })

  it('builds a handoff intent that names the target owner', () => {
    const snapshot = normalizeDomainSnapshot(gallery())
    const intent = domainIntent(snapshot, snapshot.items[0]!, 'handoff', context, 'anatomia')
    const parsed = ArtifactIntentSchema.parse(intent)
    expect(parsed.targetOwner).toBe('anatomia')
    expect(parsed.source.owner).toBe('eikona')
  })
})

describe('domain action admission', () => {
  it('requires owner-authored actions and pauses on reconcile', () => {
    const ready = normalizeDomainSnapshot(gallery())
    expect(admitDomainAction(ready, 'generate.preview')).toEqual({ kind: 'approval_required', actionId: 'generate.preview' })
    expect(admitDomainAction(ready, 'run.launch')).toMatchObject({ kind: 'not_available' })
    expect(admitDomainAction({ ...ready, status: 'reconcile_required' }, 'generate.preview')).toMatchObject({ kind: 'paused', reason: 'reconcile_required' })
    expect(interpretTimeout('review.accept')).toMatchObject({ kind: 'paused', reason: 'unknown' })
  })

  it('keeps Ordo launch/cancel/lease.release unavailable even if a snapshot lists them', () => {
    const ordo: DomainSnapshotV1 = {
      owner: 'ordo',
      status: 'ready',
      freshness: 'fresh',
      items: [{ ref: 'run:1', title: 'Team run', version: '1', kind: 'run', status: 'running' }],
      allowedActions: [
        { id: 'ordo.reconcile.request', gated: true },
        { id: 'run.launch', gated: false },
      ],
    }
    expect(admitOrdoClientAction(ordo, 'run.launch')).toMatchObject({ kind: 'not_available', reason: 'not_available' })
    expect(admitOrdoClientAction(ordo, 'lease.release')).toMatchObject({ kind: 'not_available' })
    expect(admitOrdoClientAction(ordo, 'ordo.reconcile.request')).toEqual({ kind: 'approval_required', actionId: 'ordo.reconcile.request' })
  })
})

