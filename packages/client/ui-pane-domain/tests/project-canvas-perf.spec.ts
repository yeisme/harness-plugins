/**
 * dsh-project-canvas-continuity-v1 5.5 前半：300 混合节点性能采样框架。
 *
 * This is a real sampling run, not an empty match: it builds a deterministic
 * 300-node mixed document (five node families, all six material reference
 * kinds, both edge kinds), drives the actual editor/controller input paths and
 * the cached-document re-entry path, and records p50/p95/max latencies next to
 * the design thresholds (input p95 ≤ 100ms, cached switch p95 ≤ 200ms). The
 * sustained 60-minute workload with DOM/heap/subscription trends stays with
 * parent task 5.5; this harness is the repeatable kernel/controller sample.
 */
import { describe, expect, it, vi } from 'vitest'
import { PROJECT_CANVAS_SCHEMA, PANE_ARTIFACT_SCHEMA, type ArtifactRefV1, type ProjectCanvasDocument, type ProjectCanvasNode } from '@yeisme/dsh-pane-protocol'
import { createProjectCanvasEditor, editProjectCanvas, searchProjectCanvas } from '../src/project-canvas.js'
import { inspectCanvasRunScope } from '../src/project-canvas-workflow.js'
import { ProjectCanvasController, type ProjectCanvasRemote } from '../src/project-canvas-controller.js'

const scope = { workspaceRef: 'workspace:one', projectRef: 'project:one' }
const target = { ...scope, documentId: 'canvas-perf' }
const NODE_COUNT = 300

/** Deterministic LCG so every run samples the same mixed workload. */
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 0x1_0000_0000 }
}

function artifactOf(cycle: number): ArtifactRefV1 {
  const families = [
    { kind: 'image', mediaType: 'image/png' },
    { kind: 'video', mediaType: 'video/mp4' },
    { kind: 'audio', mediaType: 'audio/mpeg' },
    { kind: 'file', mediaType: 'application/pdf' },
    { kind: 'shot', mediaType: 'application/vnd.scaena.shot+json' },
    { kind: 'prompt', mediaType: 'text/markdown' },
  ] as const
  const family = families[cycle % families.length]!
  return { schema: PANE_ARTIFACT_SCHEMA, owner: 'eikona', kind: family.kind, ref: `eikona://asset/${family.kind}/${cycle}`, version: String(cycle % 7 + 1), mediaType: family.mediaType, title: `Material ${cycle}`, evidenceRefs: [], capabilities: ['preview'] }
}

/** 300 mixed nodes: groups + six material reference kinds + drafts + operations + results, with both edge kinds. */
function mixedDocument(): ProjectCanvasDocument {
  const random = lcg(2026_09_14)
  const nodes: ProjectCanvasNode[] = []
  const operations: string[] = []
  const materials: string[] = []
  const drafts: string[] = []
  for (let index = 0; nodes.length < NODE_COUNT; index++) {
    const id = `node-${index}`
    const position = { x: Math.round(random() * 4_000), y: Math.round(random() * 3_000) }
    const size = { width: 240, height: 160 }
    const base = { id, title: `Node ${index}`, position, size }
    const bucket = index % 10
    if (bucket === 0) nodes.push({ ...base, kind: 'group', collapsed: false })
    else if (bucket <= 6) { nodes.push({ ...base, kind: 'material', artifact: artifactOf(index) }); materials.push(id) }
    else if (bucket === 7) { nodes.push({ ...base, kind: 'draft', text: `草稿 ${index}` }); drafts.push(id) }
    else if (bucket === 8) { nodes.push({ ...base, kind: 'operation', owner: 'eikona', actionRef: 'action:generate', controls: { count: index % 4 } }); operations.push(id) }
    else nodes.push({ ...base, kind: 'result', artifact: artifactOf(index) })
  }
  const edges = []
  let executionInputCounter = 0
  for (let index = 0; index < 200 && materials.length > 0 && operations.length > 0; index++) {
    const source = materials[index % materials.length]!
    const operation = operations[index % operations.length]!
    // Distinct input names keep document-level drafts valid while exercising many bindings.
    edges.push({ id: `exec-${index}`, kind: 'execution', source, target: operation, input: `in-${executionInputCounter++}`, output: 'selected', purpose: index % 2 ? 'reference-image' : 'asset' })
  }
  for (let index = 0; index < 100 && drafts.length > 0; index++) {
    edges.push({ id: `ref-${index}`, kind: 'reference', source: drafts[index % drafts.length]!, target: materials[index % materials.length]! })
  }
  return { schema: PROJECT_CANVAS_SCHEMA, scope, id: target.documentId, revision: 1, camera: { x: 120, y: -80, zoom: 0.75 }, nodes, edges }
}

function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!
}

function summarize(label: string, samples: number[]): { readonly count: number; readonly p50: number; readonly p95: number; readonly max: number } {
  const summary = { count: samples.length, p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), max: Math.max(...samples) }
  // Recorded evidence line; copy into the change implementation baseline.
  console.info(`[project-canvas-perf] ${label}: count=${summary.count} p50=${summary.p50.toFixed(2)}ms p95=${summary.p95.toFixed(2)}ms max=${summary.max.toFixed(2)}ms`)
  return summary
}

describe('project canvas 300-node mixed sample (5.5 harness)', () => {
  it('keeps kernel input latency within the design threshold on 300 mixed nodes', () => {
    const random = lcg(4_242)
    let editor = createProjectCanvasEditor(mixedDocument())
    expect(editor.document.nodes).toHaveLength(NODE_COUNT)
    const inputSamples: number[] = []
    const nodeIds = editor.document.nodes.map(node => node.id)
    const draftIds = editor.document.nodes.filter(node => node.kind === 'draft').map(node => node.id)
    for (let sample = 0; sample < 240; sample++) {
      const phase = sample % 4
      const started = performance.now()
      let next = editor
      if (phase === 0) {
        const id = nodeIds[Math.floor(random() * nodeIds.length)]!
        const result = editProjectCanvas(editor, target, editor.editVersion, { type: 'move', ids: [id], dx: sample % 2 ? 1 : -1, dy: 0 })
        if (result.ok) next = result.editor
      } else if (phase === 1) {
        const id = draftIds[sample % draftIds.length]!
        const result = editProjectCanvas(editor, target, editor.editVersion, { type: 'text', id, text: `草稿修订 ${sample}` })
        if (result.ok) next = result.editor
      } else if (phase === 2) {
        const result = editProjectCanvas(editor, target, editor.editVersion, { type: 'undo' })
        if (result.ok) next = result.editor
      } else {
        const result = editProjectCanvas(editor, target, editor.editVersion, { type: 'select', ids: [nodeIds[Math.floor(random() * nodeIds.length)]!] })
        if (result.ok) next = result.editor
      }
      inputSamples.push(performance.now() - started)
      editor = next
    }
    const summary = summarize('kernel input', inputSamples)
    expect(summary.p95).toBeLessThanOrEqual(100)
  })

  it('keeps the controller input path within the design threshold on 300 mixed nodes', async () => {
    const random = lcg(9_77)
    const remote: ProjectCanvasRemote = {
      canvasRead: vi.fn(async () => ({ status: 'ready', document: mixedDocument() })),
      canvasSave: vi.fn(async () => ({ status: 'unknown' as const })),
      canvasReconcile: vi.fn(async () => ({ status: 'unknown' as const })),
    }
    const controller = new ProjectCanvasController(remote, { scope, documentId: target.documentId })
    // Reopen path: a cached document (already owner-confirmed) re-enters through load.
    await controller.load()
    const seeded = controller.getSnapshot().editor!
    expect(seeded.document.nodes).toHaveLength(NODE_COUNT)
    const nodeIds = seeded.document.nodes.map(node => node.id)
    const inputSamples: number[] = []
    for (let sample = 0; sample < 120; sample++) {
      const started = performance.now()
      controller.edit(sample % 2
        ? { type: 'move', ids: [nodeIds[Math.floor(random() * nodeIds.length)]!], dx: 1, dy: 1 }
        : { type: 'camera', camera: { x: sample, y: 0, zoom: 0.75 } })
      inputSamples.push(performance.now() - started)
    }
    const summary = summarize('controller input', inputSamples)
    expect(summary.p95).toBeLessThanOrEqual(100)
  })

  it('keeps cached document switching within the design threshold', () => {
    const document = mixedDocument()
    const switchSamples: number[] = []
    for (let round = 0; round < 30; round++) {
      // Re-entering a cached project replays the owner document through schema
      // parse + deep freeze; structuredClone mimics reading the stored copy.
      const stored = structuredClone(document)
      const started = performance.now()
      createProjectCanvasEditor(stored)
      switchSamples.push(performance.now() - started)
    }
    const summary = summarize('cached switch (schema parse + freeze)', switchSamples)
    expect(summary.p95).toBeLessThanOrEqual(200)
  })

  it('records search and draft inspection samples for the sustained report', () => {
    const editor = createProjectCanvasEditor(mixedDocument())
    const searchSamples: number[] = []
    for (let round = 0; round < 40; round++) {
      const started = performance.now()
      searchProjectCanvas(editor.document, round % 2 ? 'Material' : '草稿')
      searchSamples.push(performance.now() - started)
    }
    const search = summarize('search', searchSamples)
    const inspectionStarted = performance.now()
    const inspection = inspectCanvasRunScope(editor.document, { kind: 'all' })
    const inspectionMs = performance.now() - inspectionStarted
    console.info(`[project-canvas-perf] draft inspection (all): ${inspectionMs.toFixed(2)}ms, operations=${inspection.order.length}`)
    expect(inspection.order.length).toBeGreaterThan(0)
    // Loose regression guards for the recorded extras, well above observed values.
    expect(search.p95).toBeLessThanOrEqual(100)
    expect(inspectionMs).toBeLessThanOrEqual(200)
  })
})
