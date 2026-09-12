import { describe, expect, it } from 'vitest'
import { PROJECT_CANVAS_SCHEMA, PANE_ARTIFACT_SCHEMA, type ProjectCanvasDocument, type ProjectCanvasNode } from '@yeisme/dsh-pane-protocol'
import { inspectCanvasRunScope, inspectCanvasImpact, inspectCanvasChangeImpact } from '../src/project-canvas-workflow.js'

const artifact = { schema: PANE_ARTIFACT_SCHEMA, owner: 'eikona', kind: 'image', ref: 'eikona://asset/one', version: '4',
  mediaType: 'image/png', title: 'Image', evidenceRefs: [], capabilities: ['preview'] }
const base = { position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }
function doc(): ProjectCanvasDocument {
  const nodes: ProjectCanvasNode[] = ['a', 'b', 'c', 'unrelated'].map(id => ({ ...base, id, title: id,
    kind: 'operation', owner: 'eikona', actionRef: 'action:generate', controls: {} }))
  return { schema: PROJECT_CANVAS_SCHEMA, id: 'canvas', scope: { workspaceRef: 'w:one', projectRef: 'p:one' }, revision: 1,
    camera: { x: 0, y: 0, zoom: 1 }, nodes,
    edges: [
      { id: 'ab', kind: 'execution', source: 'a', target: 'b', output: 'image', input: 'reference', purpose: 'reference-image' },
      { id: 'bc', kind: 'execution', source: 'b', target: 'c', output: 'image', input: 'reference', purpose: 'reference-image' },
      { id: 'reference', kind: 'reference', source: 'b', target: 'unrelated' },
    ] }
}

describe('canvas execution scope draft inspection', () => {
  it('includes only execution descendants and blocks missing external inputs without widening scope', () => {
    const result = inspectCanvasRunScope(doc(), { kind: 'branch', nodeIds: ['b'] })
    expect(result.nodeIds).toEqual(['b', 'c'])
    expect(result.order).toEqual(['b', 'c'])
    expect(result.blockers).toEqual([{ code: 'missing_external_output', nodeId: 'a', edgeId: 'ab' }])
    expect(result.bindings[0]!.source).toEqual({ kind: 'step', nodeId: 'b' })
  })

  it('uses the pinned selected version of an external operation rather than rerunning it', () => {
    const input = doc()
    input.nodes[0] = { ...input.nodes[0]!, selectedArtifact: structuredClone(artifact) } as ProjectCanvasNode
    const result = inspectCanvasRunScope(input, { kind: 'node', nodeId: 'b' })
    expect(result.nodeIds).toEqual(['b'])
    expect(result.blockers).toEqual([])
    expect(result.bindings).toHaveLength(1)
    expect(result.bindings[0]!.source).toMatchObject({ kind: 'artifact', artifact: { version: '4' } })
    const operation = input.nodes[0]!
    if (operation.kind === 'operation') operation.selectedArtifact!.version = '5'
    expect(result.bindings[0]!.source).toMatchObject({ kind: 'artifact', artifact: { version: '4' } })
    expect(result).not.toHaveProperty('authorized')
    expect(result).not.toHaveProperty('runnable')
  })

  it('topologically inspects the whole graph and ignores reference-only cycles', () => {
    const input = doc()
    input.edges.push({ id: 'ref-cycle', kind: 'reference', source: 'c', target: 'a' })
    const result = inspectCanvasRunScope(input, { kind: 'all' })
    expect(result.blockers).toEqual([])
    expect(result.order.indexOf('a')).toBeLessThan(result.order.indexOf('b'))
    expect(result.order.indexOf('b')).toBeLessThan(result.order.indexOf('c'))
  })

  it('reports execution cycles without mutating or dropping the draft', () => {
    const input = doc()
    input.edges.push({ id: 'ca', kind: 'execution', source: 'c', target: 'a', output: 'image', input: 'reference', purpose: 'reference-image' })
    const before = structuredClone(input)
    const result = inspectCanvasRunScope(input, { kind: 'all' })
    expect(result.blockers.filter(item => item.code === 'execution_cycle').map(item => item.nodeId)).toEqual(['a', 'b', 'c'])
    expect(input).toEqual(before)
  })

  it('rejects duplicate input mappings and never guesses the desired binding', () => {
    const input = doc()
    input.edges.push({ id: 'other-b', kind: 'execution', source: 'unrelated', target: 'b', output: 'image', input: 'reference', purpose: 'reference-image' })
    const result = inspectCanvasRunScope(input, { kind: 'all' })
    expect(result.blockers).toContainEqual({ code: 'ambiguous_input', nodeId: 'b', edgeId: 'other-b' })
  })

  it('rejects missing selections and gives an explicit empty-scope result', () => {
    expect(inspectCanvasRunScope(doc(), { kind: 'node', nodeId: 'gone' }).blockers).toEqual([{ code: 'invalid_selection', nodeId: 'gone' }])
    expect(inspectCanvasRunScope(doc(), { kind: 'branch', nodeIds: [] }).blockers).toEqual([{ code: 'empty_scope' }])
  })

  it('keeps draft text out of control-plane inspection', () => {
    const input = doc()
    input.nodes.push({ ...base, id: 'text', kind: 'draft', title: 'Prompt', text: 'Private user draft body' })
    input.edges.push({ id: 'prompt', kind: 'execution', source: 'text', target: 'a', output: 'text', input: 'prompt', purpose: 'prompt' })
    const result = inspectCanvasRunScope(input, { kind: 'all' })
    expect(result.blockers).toEqual([])
    expect(result.bindings.find(binding => binding.edgeId === 'prompt')!.source).toEqual({ kind: 'draft', nodeId: 'text' })
    expect(JSON.stringify(result)).not.toContain('Private user draft body')
  })
})

it('finds execution impact from upstream drafts without clearing adopted versions', () => {
 const input = doc()
 input.nodes.push({ ...base, id: 'prompt', kind: 'draft', title: 'Prompt', text: 'private input' })
 input.edges.push({ id: 'pa', kind: 'execution', source: 'prompt', target: 'a', output: 'text', input: 'prompt', purpose: 'prompt' })
 const a = input.nodes.find(node => node.id === 'a')!
 if (a.kind === 'operation') a.selectedArtifact = artifact
 const original = structuredClone(input)
 expect(inspectCanvasImpact(input, ['prompt', 'prompt'])).toEqual({ valid: true, affectedOperationIds: ['a', 'b', 'c'] })
 expect(input).toEqual(original)
 expect(inspectCanvasImpact(input, ['unknown'])).toEqual({ valid: false, affectedOperationIds: [] })
 expect(inspectCanvasImpact(input, [])).toEqual({ valid: true, affectedOperationIds: [] })
 input.edges.push({ id: 'cycle', kind: 'execution', source: 'c', target: 'a', output: 'image', input: 'ref', purpose: 'reference' })
 expect(inspectCanvasImpact(input, ['b']).affectedOperationIds).toEqual(['a', 'b', 'c'])
})

it('separates semantic edits from layout and accounts for removed execution dependencies', () => {
 const before = doc(), after = structuredClone(before)
 after.nodes[0]!.position.x = 50
 after.nodes[0]!.title = 'Moved title'
 after.camera.zoom = 2
 after.edges.push({ id: 'another-reference', kind: 'reference', source: 'a', target: 'unrelated' })
 expect(inspectCanvasChangeImpact(before,after).affectedOperationIds).toEqual([])
 after.edges = after.edges.filter(edge => edge.id !== 'ab')
 expect(inspectCanvasChangeImpact(before,after).affectedOperationIds).toEqual(['b','c'])
 const changed = structuredClone(before)
 const a = changed.nodes[0]!
 if (a.kind === 'operation') a.controls = { prompt: 'changed' }
 expect(inspectCanvasChangeImpact(before,changed).affectedOperationIds).toEqual(['a','b','c'])
 expect(inspectCanvasChangeImpact(before,{ ...after, scope: { ...after.scope, projectRef: 'other' } }).valid).toBe(false)
})

it('reports changed external inputs while retaining their explicitly pinned output', () => {
 const input = doc()
 const upstream = input.nodes.find(node => node.id === 'a')!
 if (upstream.kind !== 'operation') throw Error('fixture operation missing')
 upstream.selectedArtifact = artifact
 upstream.inputReviewRequired = true
 const result = inspectCanvasRunScope(input, { kind: 'node', nodeId: 'b' })
 expect(result.blockers).toEqual([])
 expect(result.notices).toEqual([{ code: 'external_input_changed', nodeId: 'a', edgeId: 'ab' }])
 expect(result.bindings[0]!.source).toMatchObject({ kind: 'artifact', artifact: { version: '4' } })
 expect(result.nodeIds).toEqual(['b'])
 expect(upstream.selectedArtifact.version).toBe('4')
})
