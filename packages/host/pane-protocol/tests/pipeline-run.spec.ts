import { describe, expect, it } from 'vitest'
import {
  PIPELINE_RUN_SCHEMA,
  PROJECT_CANVAS_SCHEMA,
  PANE_ARTIFACT_SCHEMA,
  PipelineRunProjectionSchema,
  ProjectCanvasDocumentSchema,
  ProjectCanvasReadResultSchema,
  ProjectCanvasSaveResultSchema,
  parsePipelineRunProjection,
  parseProjectCanvasDocument,
} from '../src/index.js'

const artifact = {
  schema: PANE_ARTIFACT_SCHEMA,
  owner: 'eikona',
  kind: 'image',
  ref: 'artifact:eikona:1',
  version: '1',
  mediaType: 'image/png',
  title: 'Variant 1',
  evidenceRefs: ['evidence:1'],
  capabilities: ['open'],
}

const runProjection = {
  schema: PIPELINE_RUN_SCHEMA,
  runRef: 'run:ordo:1',
  executionEdgeRef: 'edge:canvas:7',
  status: 'running',
  freshness: 'fresh',
  actions: [
    { action: 'pause', enabled: true },
    { action: 'resume', enabled: false, disabledReason: 'Run is not paused.' },
    { action: 'reconcile', enabled: true },
  ],
  evidenceRefs: ['evidence:run:1'],
  version: '3',
  cursor: 'c3',
}

const canvasBase = {
  schema: PROJECT_CANVAS_SCHEMA,
  scope: { workspaceRef: 'workspace:demo', projectRef: 'project:one' },
  id: 'canvas:one',
  revision: 1,
  camera: { x: 0, y: 0, zoom: 1 },
}

const creativeNodes = [
  { id: 'n-asset', kind: 'asset', title: 'Poster asset', position: { x: 0, y: 0 }, size: { width: 120, height: 80 }, domainRef: 'domain:asset:1', version: '2', artifact },
  { id: 'n-char', kind: 'character', title: 'Lead', position: { x: 10, y: 0 }, size: { width: 120, height: 80 }, domainRef: 'domain:character:1', version: '1', summary: 'Bounded character summary' },
  { id: 'n-scene', kind: 'scene', title: 'Rooftop', position: { x: 20, y: 0 }, size: { width: 120, height: 80 }, domainRef: 'domain:scene:1', version: '4' },
  { id: 'n-shot', kind: 'shot', title: 'Shot 12', position: { x: 30, y: 0 }, size: { width: 120, height: 80 }, domainRef: 'domain:shot:12', version: '1' },
  { id: 'n-cand', kind: 'candidate', title: 'Candidate A', position: { x: 40, y: 0 }, size: { width: 120, height: 80 }, domainRef: 'domain:candidate:1', version: '1', artifact, operationId: 'op-1' },
  { id: 'op-1', kind: 'operation', title: 'Render', position: { x: 50, y: 0 }, size: { width: 120, height: 80 }, owner: 'eikona', actionRef: 'action:eikona:render:1', controls: {} },
]

describe('pipeline run projection', () => {
  it('accepts a bounded running projection with server-authored actions', () => {
    const parsed = parsePipelineRunProjection(runProjection)
    expect(parsed.status).toBe('running')
    expect(parsed.actions.map(entry => entry.action)).toEqual(['pause', 'resume', 'reconcile'])
  })

  it('accepts every status and requires a blocker or reason for inactive runs', () => {
    for (const status of ['running', 'paused'] as const) {
      expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, status }).success).toBe(true)
    }
    for (const status of ['blocked', 'stale', 'unknown', 'needs_contract', 'partial'] as const) {
      expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, status }).success).toBe(false)
      expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, status, reason: 'Owner adapter unavailable.' }).success).toBe(true)
      expect(PipelineRunProjectionSchema.safeParse({
        ...runProjection,
        status,
        blocker: { code: 'owner.unavailable', reason: 'Owner adapter unavailable.' },
      }).success).toBe(true)
    }
  })

  it('rejects unsafe refs, smuggled fields and contract drift', () => {
    expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, runRef: '/private/run/1' }).success).toBe(false)
    expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, executionEdgeRef: 'https://evil.example/run' }).success).toBe(false)
    expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, rawPrompt: 'private' }).success).toBe(false)
    expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, blocker: { code: 'x', reason: 'https://internal.example/run' } }).success).toBe(false)
    expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, schema: 'dsh.pipeline-run.v2' }).success).toBe(false)
    expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, status: 'completed' }).success).toBe(false)
    expect(PipelineRunProjectionSchema.safeParse({ ...runProjection, reason: 'x'.repeat(2_049) }).success).toBe(false)
    expect(() => parsePipelineRunProjection({ ...runProjection, token: 'secret' })).toThrow()
  })

  it('requires disabled actions to explain why and rejects duplicate action entries', () => {
    expect(PipelineRunProjectionSchema.safeParse({
      ...runProjection,
      actions: [{ action: 'pause', enabled: false }],
    }).success).toBe(false)
    expect(PipelineRunProjectionSchema.safeParse({
      ...runProjection,
      actions: [
        { action: 'pause', enabled: true },
        { action: 'pause', enabled: false, disabledReason: 'Already pausing.' },
      ],
    }).success).toBe(false)
  })
})

describe('project canvas creative node kinds', () => {
  it('accepts creative pipeline nodes alongside the existing generic kinds', () => {
    const parsed = parseProjectCanvasDocument({
      ...canvasBase,
      nodes: creativeNodes,
      edges: [
        { id: 'e-ref', kind: 'reference', source: 'n-char', target: 'n-scene', label: 'appears in' },
        { id: 'e-exec', kind: 'execution', source: 'n-shot', target: 'op-1', output: 'frames', input: 'shot', purpose: 'render' },
      ],
    })
    expect(parsed.nodes.map(node => node.kind)).toEqual(['asset', 'character', 'scene', 'shot', 'candidate', 'operation'])
  })

  it('keeps the existing generic node vocabulary unchanged', () => {
    const parsed = ProjectCanvasDocumentSchema.parse({
      ...canvasBase,
      nodes: [
        { id: 'n-mat', kind: 'material', title: 'Ref', position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, artifact },
        { id: 'n-draft', kind: 'draft', title: 'Draft', position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, text: 'safe draft text' },
        { id: 'n-res', kind: 'result', title: 'Result', position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, artifact },
        { id: 'n-grp', kind: 'group', title: 'Group', position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, collapsed: false },
      ],
      edges: [],
    })
    expect(parsed.nodes).toHaveLength(4)
  })

  it('rejects creative nodes with unsafe refs or undeclared fields', () => {
    const base = { ...canvasBase, edges: [] }
    expect(ProjectCanvasDocumentSchema.safeParse({
      ...base,
      nodes: [{ ...creativeNodes[1], domainRef: '/private/character/1' }],
    }).success).toBe(false)
    expect(ProjectCanvasDocumentSchema.safeParse({
      ...base,
      nodes: [{ ...creativeNodes[2], text: 'domain body must not ride the canvas node' }],
    }).success).toBe(false)
  })

  it('preserves drafts with creative nodes across revision conflicts', () => {
    const document = {
      ...canvasBase,
      nodes: creativeNodes,
      edges: [],
    }
    const conflict = ProjectCanvasSaveResultSchema.parse({ status: 'conflict', revision: 2 })
    expect(conflict).toEqual({ status: 'conflict', revision: 2 })

    const read = ProjectCanvasReadResultSchema.parse({
      status: 'ready',
      document: { ...document, revision: 2 },
      draft: { requestId: 'req-save-1', baseRevision: 1, document },
    })
    expect(read.status).toBe('ready')
    if (read.status === 'ready' || read.status === 'missing') {
      expect(read.draft?.document.nodes.some(node => node.kind === 'shot')).toBe(true)
    }
  })
})
