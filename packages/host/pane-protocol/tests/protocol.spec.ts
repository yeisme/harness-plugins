import { describe, expect, it } from 'vitest'
import {
  ArtifactIntentSchema,
  ArtifactRefSchema,
  PANE_ARTIFACT_SCHEMA,
  PANE_EVENT_SCHEMA,
  PANE_INTENT_SCHEMA,
  PANE_PLUGIN_SCHEMA,
  PaneEventEnvelopeSchema,
  PanePluginDefinitionSchema,
} from '../src/index.js'

const context = {
  workspaceRef: 'workspace:demo',
  sessionRef: 'session:one',
  principalRef: 'principal:local',
  revision: '1',
}

const artifact = {
  schema: PANE_ARTIFACT_SCHEMA,
  owner: 'eikona',
  kind: 'image',
  ref: 'artifact:eikona:1',
  version: '1',
  mediaType: 'image/png',
  title: 'Variant 1',
  summary: 'Safe image summary',
  evidenceRefs: ['evidence:1'],
  capabilities: ['open', 'handoff'],
}

describe('pane protocol', () => {
  it('accepts a complete four-face plugin definition', () => {
    const parsed = PanePluginDefinitionSchema.parse({
      schema: PANE_PLUGIN_SCHEMA,
      id: 'yeisme.notes-preview',
      version: '0.1.0-rc.1',
      owner: { id: 'pinax', label: 'Pinax' },
      faces: {
        host: { provided: true, capabilities: ['notes.snapshot'] },
        client: { provided: true, capabilities: ['pane.view'] },
        composition: { provided: true, capabilities: ['artifact.open'] },
        observation: { provided: true, capabilities: ['pane.event'] },
      },
      capabilities: { required: ['pane.event.v1'], optional: ['notes.graph'] },
      permissions: ['notes.read'],
      views: [{
        kind: 'pinax.note',
        label: 'Note',
        componentKey: 'pinax.note.preview',
        role: 'content',
        preferredRegion: 'right',
        retention: 'snapshot',
        singleton: false,
      }],
      commands: [{ id: 'pinax.open', label: 'Open note', permission: 'notes.read' }],
      artifactKinds: ['pinax.note'],
      compatibility: { dshApiRange: '0.1.0-rc.6', experimental: true },
    })

    expect(parsed.id).toBe('yeisme.notes-preview')
    expect(parsed.faces.observation.provided).toBe(true)
  })

  it('rejects a view without a client face', () => {
    const result = PanePluginDefinitionSchema.safeParse({
      schema: PANE_PLUGIN_SCHEMA,
      id: 'yeisme.invalid',
      version: '0.1.0-rc.1',
      owner: { id: 'demo' },
      faces: {
        host: { provided: true, capabilities: [] },
        client: { provided: false, capabilities: [] },
        composition: { provided: false, capabilities: [] },
        observation: { provided: true, capabilities: [] },
      },
      capabilities: { required: [], optional: [] },
      permissions: [],
      views: [{
        kind: 'demo.view',
        label: 'Demo',
        componentKey: 'demo.view',
        role: 'general',
        preferredRegion: 'either',
        retention: 'recreate',
        singleton: false,
      }],
      commands: [],
      artifactKinds: [],
      compatibility: { dshApiRange: '*', experimental: true },
    })

    expect(result.success).toBe(false)
  })

  it('rejects unsafe artifact fields and absolute paths', () => {
    expect(ArtifactRefSchema.safeParse({ ...artifact, ref: '/private/project/image.png' }).success).toBe(false)
    expect(ArtifactRefSchema.safeParse({ ...artifact, rawPrompt: 'private' }).success).toBe(false)
  })

  it('requires a target owner for mutation-like handoff intents', () => {
    const result = ArtifactIntentSchema.safeParse({
      schema: PANE_INTENT_SCHEMA,
      intent: 'handoff',
      source: artifact,
      context,
      idempotencyKey: 'handoff-0001',
    })
    expect(result.success).toBe(false)
  })

  it('accepts bounded snapshots and rejects unsafe generic payloads', () => {
    const base = {
      schema: PANE_EVENT_SCHEMA,
      stream: 'pinax.notes',
      cursor: '0',
      sequence: -1,
      context,
      occurredAt: new Date(0).toISOString(),
      observedAt: new Date(0).toISOString(),
      freshness: 'fresh' as const,
    }
    expect(PaneEventEnvelopeSchema.safeParse({
      ...base,
      op: 'snapshot',
      payload: { entities: [], timeline: [] },
    }).success).toBe(true)
    expect(PaneEventEnvelopeSchema.safeParse({
      ...base,
      op: 'append',
      sequence: 0,
      payload: { value: { providerPayload: 'private' } },
    }).success).toBe(false)
  })
})
