import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  PipelineRunProjectionSchema,
  PROJECT_CANVAS_SCHEMA,
  type ProjectCanvasDocument,
} from '@yeisme/dsh-pane-protocol'
import {
  decodeCreativePipelineEdgeProjectionV1,
  decodeCreativePipelineNodeProjectionV1,
  decodeCreativePipelineRunProjectionV1,
  decodeWorkSurfaceCapsuleV1,
} from '@yeisme/dsh-plugin-contracts'
import {
  CREATIVE_PIPELINE_EXPECTED_CONTEXT,
  CREATIVE_PIPELINE_RUN_OWNER,
  CREATIVE_PIPELINE_RUN_OWNER_SNAPSHOT_SCHEMA,
  CREATIVE_PIPELINE_SNAPSHOT_SCHEMA,
  CreativePipelineGateway,
  validateCreativePipelineContext,
  type CreativePipelineContextV1,
  type CreativePipelineWorkbenchSnapshotV1,
} from '../src/pipeline-gateway.js'

const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })

function pipelineContext(overrides: Partial<CreativePipelineContextV1> = {}): CreativePipelineContextV1 {
  return {
    schema: 'dsh.creative-pipeline-context.v1alpha1',
    tenantRef: 'tenant:one',
    workspaceRef: 'workspace:one',
    projectRef: 'project:one',
    projectTitle: 'Night Rain',
    ...overrides,
  }
}

function artifact(owner: string, kind: string, ref: string, version: string) {
  return { schema: 'pane.artifact.v1alpha1', owner, kind, ref, version, mediaType: 'image/png', title: ref, evidenceRefs: [], capabilities: ['preview'] }
}

function canvasDocument(overrides: Partial<ProjectCanvasDocument> = {}): ProjectCanvasDocument {
  return {
    schema: PROJECT_CANVAS_SCHEMA,
    scope: { workspaceRef: 'workspace:one', projectRef: 'project:one' },
    id: 'main',
    revision: 1,
    camera: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: 'node:asset-poster', kind: 'asset', title: 'Poster frame', position: { x: 40, y: 40 }, size: { width: 220, height: 140 }, domainRef: 'asset:poster-frame', version: 'v2', artifact: artifact('eikona', 'image', 'asset:poster-frame', 'v2') },
      { id: 'node:char-lin', kind: 'character', title: 'Lin (lead)', position: { x: 40, y: 240 }, size: { width: 220, height: 140 }, domainRef: 'character:lin', version: 'v5' },
      { id: 'node:scene-rooftop', kind: 'scene', title: 'Rooftop night rain', position: { x: 330, y: 140 }, size: { width: 240, height: 150 }, domainRef: 'scene:rooftop', version: 'v4' },
      { id: 'node:shot04', kind: 'shot', title: 'Shot 04 · rooftop chase', position: { x: 620, y: 140 }, size: { width: 240, height: 150 }, domainRef: 'shot:episode01-04', version: 'v6' },
      { id: 'node:op-image-gen', kind: 'operation', title: 'Image generation', position: { x: 620, y: 340 }, size: { width: 240, height: 140 }, owner: 'eikona', actionRef: 'action:generate-image', controls: {} },
      { id: 'node:candidate-c2', kind: 'candidate', title: 'Candidate C2', position: { x: 910, y: 60 }, size: { width: 220, height: 140 }, domainRef: 'candidate:shot04-c2', version: 'v3', artifact: artifact('eikona', 'image', 'candidate:shot04-c2', 'v3'), operationId: 'node:op-image-gen' },
    ],
    edges: [
      { id: 'edge:cast', kind: 'reference', source: 'node:char-lin', target: 'node:scene-rooftop', label: 'cast' },
      { id: 'edge:exec', kind: 'execution', source: 'node:shot04', target: 'node:op-image-gen', output: 'selected', input: 'reference-image', purpose: 'reference-image' },
      // Operation output edge: endpoints are not both domain nodes, so it stays out of the pipeline projection.
      { id: 'edge:out', kind: 'reference', source: 'node:op-image-gen', target: 'node:candidate-c2', label: 'output' },
    ],
    ...overrides,
  }
}

const KEY = JSON.stringify(['tenant:one', 'workspace:one', 'project:one', 'main'])

function row(document: ProjectCanvasDocument, inflight?: unknown) {
  return { document, receipts: [], ...(inflight === undefined ? {} : { inflight }) }
}

function storageWith(rows: Map<string, unknown>, onGet?: () => void) {
  const table = { get: (key: string) => { onGet?.(); return rows.get(key) }, put: vi.fn(async () => {}) }
  return { open: vi.fn(async () => ({ table: () => table, close: vi.fn(async () => {}) })) }
}

function runOwnerSnapshot() {
  return {
    schema: CREATIVE_PIPELINE_RUN_OWNER_SNAPSHOT_SCHEMA,
    runs: [{
      run_ref: 'run:shot04',
      revision: 'r7',
      freshness: 'fresh',
      state: { state: 'running', reason: 'Generating shot variants', impact: 'Shot 04 candidates', next_action: 'Review candidate C2' },
      actions: [
        { action: 'pause', available: true, action_ref: 'action:pause-shot04', expected_revision: 'r7' },
        { action: 'resume', available: false, disabled_reason_code: 'not_paused', action_ref: 'action:resume-shot04', expected_revision: 'r7' },
      ],
      progress: { completed: 3, total: 8 },
    }],
    runProjections: [{
      schema: 'dsh.pipeline-run.v1alpha1',
      runRef: 'run:shot04',
      executionEdgeRef: 'edge:exec',
      status: 'running',
      freshness: 'fresh',
      actions: [
        { action: 'pause', enabled: true },
        { action: 'resume', enabled: false, disabledReason: 'Run is not paused.' },
      ],
      evidenceRefs: [],
      version: 'r7',
    }],
  }
}

async function harness(input?: { context?: CreativePipelineContextV1; storage?: unknown; runOwner?: unknown }) {
  const ctx = new Context()
  contexts.push(ctx)
  if (input?.context !== undefined) ctx.provide(CREATIVE_PIPELINE_EXPECTED_CONTEXT, input.context)
  if (input?.storage !== undefined) ctx.provide('storageDomain', input.storage)
  if (input?.runOwner !== undefined) ctx.provide(CREATIVE_PIPELINE_RUN_OWNER, input.runOwner)
  await ctx.plugin(CreativePipelineGateway)
  return { ctx, gateway: ctx.get('creativePipeline') as CreativePipelineGateway }
}

function expectEnvelope(result: unknown): CreativePipelineWorkbenchSnapshotV1 {
  expect(result).toMatchObject({ schema: CREATIVE_PIPELINE_SNAPSHOT_SCHEMA })
  const envelope = result as CreativePipelineWorkbenchSnapshotV1
  expect(envelope.status === 'ready' || envelope.status === 'partial').toBe(true)
  return envelope
}

describe('pipeline context validation', () => {
  it('accepts a bound context and rejects unsafe or foreign shapes', () => {
    expect(validateCreativePipelineContext(pipelineContext())).toEqual(pipelineContext())
    expect(validateCreativePipelineContext(pipelineContext({ projectTitle: undefined }))).toMatchObject({ projectRef: 'project:one' })
    expect(validateCreativePipelineContext(undefined)).toBeUndefined()
    expect(validateCreativePipelineContext({})).toBeUndefined()
    expect(validateCreativePipelineContext(pipelineContext({ schema: 'other' as never }))).toBeUndefined()
    expect(validateCreativePipelineContext(pipelineContext({ projectRef: '/etc/passwd' }))).toBeUndefined()
    expect(validateCreativePipelineContext(pipelineContext({ projectRef: 'project with spaces' }))).toBeUndefined()
    expect(validateCreativePipelineContext(pipelineContext({ projectTitle: 'see https://example.com' }))).toBeUndefined()
  })
})

describe('CreativePipelineGateway snapshot', () => {
  it('fails closed when no pipeline context is provided', async () => {
    const rows = new Map<string, unknown>([[KEY, row(canvasDocument())]])
    const { gateway } = await harness({ storage: storageWith(rows) })
    expect(await gateway.snapshot()).toEqual({
      schema: CREATIVE_PIPELINE_SNAPSHOT_SCHEMA,
      status: 'needs_contract',
      reasonCode: 'context_unavailable',
      safeMessage: expect.any(String),
    })
    expect(await gateway.canvasRead({ scope: { workspaceRef: 'workspace:one', projectRef: 'project:one' }, documentId: 'main' })).toEqual({ status: 'unavailable' })
  })

  it('reports unavailable when the storage domain is not mounted', async () => {
    const { gateway } = await harness({ context: pipelineContext() })
    expect(await gateway.snapshot()).toMatchObject({ status: 'unavailable', reasonCode: 'storage_unavailable' })
  })

  it('projects layout, capsule, and safe references from the stored canvas document', async () => {
    const rows = new Map<string, unknown>([[KEY, row(canvasDocument())]])
    const { gateway } = await harness({ context: pipelineContext(), storage: storageWith(rows) })
    const envelope = expectEnvelope(await gateway.snapshot())
    // No run owner mounted: the run layer degrades honestly instead of fabricating state.
    expect(envelope.status).toBe('partial')
    expect(envelope.availability).toEqual({ canvas: 'ready', runs: 'needs_contract' })
    expect(envelope.project).toEqual({ ref: 'project:one', label: 'Night Rain' })
    expect(envelope.runs).toEqual([])
    expect(envelope.runProjections).toEqual([])
    expect(envelope.canvas?.revision).toBe(1)
    expect(envelope.capsule.unsaved_draft).toBe(false)
    expect(envelope.capsule.menu.run_state).toBe('needs_contract')
    // Every emitted item passes the same fail-closed decoders the browser controller uses.
    expect(decodeWorkSurfaceCapsuleV1(envelope.capsule).ok).toBe(true)
    expect(envelope.nodes.map(node => node.id)).toEqual(['node:asset-poster', 'node:char-lin', 'node:scene-rooftop', 'node:shot04', 'node:candidate-c2'])
    for (const node of envelope.nodes) expect(decodeCreativePipelineNodeProjectionV1(node).ok).toBe(true)
    expect(envelope.edges.map(edge => edge.id)).toEqual(['edge:cast', 'edge:exec'])
    for (const edge of envelope.edges) expect(decodeCreativePipelineEdgeProjectionV1(edge).ok).toBe(true)
    const execution = envelope.edges.find(edge => edge.kind === 'execution')
    expect(execution).toMatchObject({ owner_projection_ref: 'edge:exec', input_purpose: 'reference-image', output_version: 'selected' })
    expect(envelope.nodes.find(node => node.id === 'node:shot04')).toMatchObject({ kind: 'shot', ref: 'shot:episode01-04', version: 'v6', status: 'ready' })
  })

  it('marks a missing canvas document honestly without fabricating nodes', async () => {
    const { gateway } = await harness({ context: pipelineContext(), storage: storageWith(new Map()) })
    const envelope = expectEnvelope(await gateway.snapshot())
    expect(envelope.status).toBe('partial')
    expect(envelope.availability.canvas).toBe('missing')
    expect(envelope.nodes).toEqual([])
    expect(envelope.edges).toEqual([])
    expect(envelope.canvas).toBeUndefined()
    expect(envelope.capsule.unsaved_draft).toBe(false)
  })

  it('surfaces a journaled draft only as the unsaved-draft flag, never as the committed canvas', async () => {
    const pending = canvasDocument({ revision: 0 })
    const rows = new Map<string, unknown>([[KEY, row(pending, { requestId: 'req:one', digest: `sha256:${'0'.repeat(64)}`, baseRevision: 0, document: pending })]])
    const { gateway } = await harness({ context: pipelineContext(), storage: storageWith(rows) })
    const envelope = expectEnvelope(await gateway.snapshot())
    expect(envelope.canvas).toBeUndefined()
    expect(envelope.availability.canvas).toBe('missing')
    expect(envelope.capsule.unsaved_draft).toBe(true)
  })

  it('reports unavailable when the stored row violates the shared row schema', async () => {
    const rows = new Map<string, unknown>([[KEY, { garbage: true }]])
    const { gateway } = await harness({ context: pipelineContext(), storage: storageWith(rows) })
    expect(await gateway.snapshot()).toMatchObject({ status: 'unavailable', reasonCode: 'canvas_read_failed' })
  })

  it('fails the whole snapshot when a stored node cannot cross the projection contract', async () => {
    const bad = canvasDocument()
    const character = bad.nodes.find(node => node.kind === 'character')
    if (character === undefined || character.kind !== 'character') throw new Error('fixture broken')
    // A 200-char ref passes the pane-protocol canvas schema (<=512) but violates the SDK projection bound (<=160).
    ;(character as { domainRef: string }).domainRef = `character:${'a'.repeat(190)}`
    const rows = new Map<string, unknown>([[KEY, row(bad)]])
    const { gateway } = await harness({ context: pipelineContext(), storage: storageWith(rows) })
    expect(await gateway.snapshot()).toMatchObject({ status: 'contract_mismatch', reasonCode: 'node_contract_mismatch' })
  })

  it('composes owner run projections joined by the canvas execution edge id', async () => {
    const rows = new Map<string, unknown>([[KEY, row(canvasDocument())]])
    const runOwner = { snapshot: vi.fn(async () => runOwnerSnapshot()) }
    const { gateway } = await harness({ context: pipelineContext(), storage: storageWith(rows), runOwner })
    const envelope = expectEnvelope(await gateway.snapshot())
    expect(envelope.status).toBe('ready')
    expect(envelope.availability).toEqual({ canvas: 'ready', runs: 'ready' })
    expect(envelope.runs.map(run => run.run_ref)).toEqual(['run:shot04'])
    for (const run of envelope.runs) expect(decodeCreativePipelineRunProjectionV1(run).ok).toBe(true)
    for (const projection of envelope.runProjections) expect(PipelineRunProjectionSchema.safeParse(projection).success).toBe(true)
    expect(envelope.runProjections[0]).toMatchObject({ executionEdgeRef: 'edge:exec', runRef: 'run:shot04', status: 'running' })
    expect(envelope.capsule.menu.run_state).toBe('running')
    expect(envelope.capsule.run).toEqual({ state: 'running', progress: { completed: 3, total: 8 } })
    expect(runOwner.snapshot).toHaveBeenCalledWith(pipelineContext())
  })

  it.each([
    ['a wrong envelope schema', { schema: 'wrong', runs: [], runProjections: [] }],
    ['a run projection pointing at an unknown edge', { ...runOwnerSnapshot(), runProjections: [{ ...runOwnerSnapshot().runProjections[0], executionEdgeRef: 'edge:unknown' }] }],
    ['a duplicate run ref', { ...runOwnerSnapshot(), runs: [...runOwnerSnapshot().runs, ...runOwnerSnapshot().runs] }],
    ['a run projection that fails the transport schema', { ...runOwnerSnapshot(), runProjections: [{ schema: 'dsh.pipeline-run.v1alpha1' }] }],
  ])('degrades the run layer only when the owner returns %s', async (_label, ownerResult) => {
    const rows = new Map<string, unknown>([[KEY, row(canvasDocument())]])
    const runOwner = { snapshot: vi.fn(async () => ownerResult) }
    const { gateway } = await harness({ context: pipelineContext(), storage: storageWith(rows), runOwner })
    const envelope = expectEnvelope(await gateway.snapshot())
    expect(envelope.status).toBe('partial')
    expect(envelope.availability).toEqual({ canvas: 'ready', runs: 'contract_mismatch' })
    expect(envelope.runs).toEqual([])
    expect(envelope.runProjections).toEqual([])
    expect(envelope.nodes.length).toBeGreaterThan(0)
    expect(envelope.capsule.menu.run_state).toBe('needs_contract')
  })

  it('degrades the run layer when the owner throws, without retrying', async () => {
    const rows = new Map<string, unknown>([[KEY, row(canvasDocument())]])
    const runOwner = { snapshot: vi.fn(async () => { throw new Error('private owner failure') }) }
    const { gateway } = await harness({ context: pipelineContext(), storage: storageWith(rows), runOwner })
    const envelope = expectEnvelope(await gateway.snapshot())
    expect(envelope.availability.runs).toBe('contract_mismatch')
    expect(envelope.runs).toEqual([])
    expect(runOwner.snapshot).toHaveBeenCalledTimes(1)
  })

  it('fences a context change that lands during the storage read', async () => {
    const mutable = pipelineContext()
    const rows = new Map<string, unknown>([[KEY, row(canvasDocument())]])
    const storage = storageWith(rows, () => { mutable.projectRef = 'project:other' })
    const { gateway } = await harness({ context: mutable, storage })
    expect(await gateway.snapshot()).toMatchObject({ status: 'needs_contract', reasonCode: 'context_changed' })
  })

  it('never throws when the storage domain open fails', async () => {
    const storage = { open: vi.fn(async () => { throw new Error('private storage failure') }) }
    const { gateway } = await harness({ context: pipelineContext(), storage })
    expect(await gateway.snapshot()).toMatchObject({ status: 'unavailable', reasonCode: 'canvas_read_failed' })
  })
})

describe('CreativePipelineGateway canvasRead', () => {
  const read = { scope: { workspaceRef: 'workspace:one', projectRef: 'project:one' }, documentId: 'main' }

  it('rejects malformed input and foreign scopes', async () => {
    const rows = new Map<string, unknown>([[KEY, row(canvasDocument())]])
    const { gateway } = await harness({ context: pipelineContext(), storage: storageWith(rows) })
    expect(await gateway.canvasRead({ documentId: 'main' })).toEqual({ status: 'invalid' })
    expect(await gateway.canvasRead({ scope: { workspaceRef: 'workspace:two', projectRef: 'project:one' }, documentId: 'main' })).toEqual({ status: 'forbidden' })
    expect(await gateway.canvasRead(read)).toMatchObject({ status: 'ready', document: { revision: 1 } })
  })

  it('re-fences after the storage read settles', async () => {
    const mutable = pipelineContext()
    const rows = new Map<string, unknown>([[KEY, row(canvasDocument())]])
    const storage = storageWith(rows, () => { mutable.projectRef = 'project:other' })
    const { gateway } = await harness({ context: mutable, storage })
    expect(await gateway.canvasRead(read)).toEqual({ status: 'forbidden' })
  })
})
