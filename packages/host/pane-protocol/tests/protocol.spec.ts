import { describe, expect, it } from 'vitest'
import {
  ArtifactIntentSchema,
  ArtifactRefSchema,
  PANE_ACTION_DESCRIPTOR_SCHEMA,
  PANE_ACTION_REQUEST_SCHEMA,
  PANE_ARTIFACT_SCHEMA,
  PANE_EVENT_SCHEMA,
  PANE_INTENT_SCHEMA,
  PANE_PLUGIN_SCHEMA,
  PaneContextSchema,
  PaneEventEnvelopeSchema,
  PaneActionDescriptorSchema,
  PaneActionRequestSchema,
  PaneActionReceiptSchema,
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
      commands: [{
        id: 'pinax.open',
        label: 'Open note',
        permission: 'notes.read',
        slash: { name: 'pinax', aliases: ['notes'], category: 'pane' },
      }],
      artifactKinds: ['pinax.note'],
      compatibility: { dshApiRange: '0.1.0-rc.6', experimental: true },
    })

    expect(parsed.id).toBe('yeisme.notes-preview')
    expect(parsed.faces.observation.provided).toBe(true)
    expect(parsed.commands[0]?.slash).toEqual({ name: 'pinax', aliases: ['notes'], category: 'pane' })
  })

  it('accepts commands without slash and rejects unsafe slash names', () => {
    const base = {
      schema: PANE_PLUGIN_SCHEMA,
      id: 'yeisme.notes-preview',
      version: '0.1.0-rc.1',
      owner: { id: 'pinax' },
      faces: {
        host: { provided: true, capabilities: [] },
        client: { provided: true, capabilities: ['pane.view'] },
        composition: { provided: false, capabilities: [] },
        observation: { provided: false, capabilities: [] },
      },
      capabilities: { required: [], optional: [] },
      permissions: [],
      views: [],
      artifactKinds: [],
      compatibility: { dshApiRange: '*', experimental: true },
    }
    expect(PanePluginDefinitionSchema.safeParse({
      ...base,
      commands: [{ id: 'pinax.open', label: 'Open note' }],
    }).success).toBe(true)
    expect(PanePluginDefinitionSchema.safeParse({
      ...base,
      commands: [{ id: 'pinax.open', label: 'Open note', slash: { name: 'Open Note' } }],
    }).success).toBe(false)
  })

  it('accepts an optional project ref without requiring it from old contexts', () => {
    expect(PaneContextSchema.parse({ workspaceRef: 'workspace:one', revision: '1' })).toEqual({ workspaceRef: 'workspace:one', revision: '1' })
    expect(PaneContextSchema.parse({ workspaceRef: 'workspace:one', projectRef: 'project:one', revision: '1' })).toEqual({ workspaceRef: 'workspace:one', projectRef: 'project:one', revision: '1' })
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

  it('validates server-authored action descriptors and ephemeral request values', () => {
    const descriptor = PaneActionDescriptorSchema.parse({
      schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
      descriptorRef: 'action:eikona:preview:1',
      owner: 'eikona',
      actionId: 'generate.preview',
      label: 'Generate preview',
      targetRef: 'project:one',
      targetVersion: '7',
      context: { ...context, tenantRef: 'tenant:one', membershipRevision: '3', installationRef: 'install:web', pluginDigest: 'digest:creator', policyRevision: '5', runtimeGeneration: 'runtime:1' },
      risk: 'medium',
      confirmation: 'confirm',
      expiresAt: '2026-08-22T00:00:00Z',
      preview: { summary: 'Creates a bounded image preview.', cost: { currency: 'USD', amount: 0.04, estimate: true } },
      fields: [{ key: 'prompt', label: 'Prompt', kind: 'textarea', required: true, maxLength: 2000 }],
      presentation: { task: 'image', owner: 'eikona', group: 'create', order: 20 },
    })
    expect(descriptor.fields[0]?.key).toBe('prompt')

    const request = PaneActionRequestSchema.parse({
      schema: PANE_ACTION_REQUEST_SCHEMA,
      descriptorRef: descriptor.descriptorRef,
      owner: descriptor.owner,
      actionId: descriptor.actionId,
      expectedTargetRef: descriptor.targetRef,
      expectedTargetVersion: descriptor.targetVersion,
      context: descriptor.context,
      idempotencyKey: 'generate-preview-0001',
      values: { prompt: 'A quiet painted city after rain' },
    })
    expect(request.values.prompt).toBe('A quiet painted city after rain')
    expect(PaneActionDescriptorSchema.safeParse({ ...descriptor, rawPrompt: 'private' }).success).toBe(false)
  })

  it('accepts extended owner receipts without dropping legacy statuses', () => {
    expect(PaneActionReceiptSchema.parse({
      status: 'completed',
      receiptRef: 'receipt:eikona:1',
      owner: 'eikona',
      actionId: 'generate.preview',
      summary: 'Preview completed.',
      outputArtifacts: [artifact],
      evidenceRefs: ['evidence:render:1'],
    }).status).toBe('completed')
    expect(PaneActionReceiptSchema.parse({ status: 'accepted', receiptRef: 'receipt:legacy:1' }).status).toBe('accepted')
  })
})
