import { describe, expect, it } from 'vitest'
import { PROJECT_CANVAS_SCHEMA, ProjectCanvasDocumentSchema, PANE_ARTIFACT_SCHEMA,
  type ProjectCanvasDocument, type ProjectCanvasNode } from '@yeisme/dsh-pane-protocol'
import { createProjectCanvasEditor, editProjectCanvas, searchProjectCanvas, orderProjectCanvasPositions, type ProjectCanvasEdit } from '../src/project-canvas.js'

const scope = { workspaceRef: 'workspace:one', projectRef: 'project:one' }
const target = { ...scope, documentId: 'canvas-one' }
const artifact = { schema: PANE_ARTIFACT_SCHEMA, owner: 'eikona', kind: 'image', ref: 'eikona://asset/one', version: '7',
  mediaType: 'image/png', title: 'Reference', evidenceRefs: [], capabilities: ['preview'] }
const base = { position: { x: 0, y: 0 }, size: { width: 200, height: 100 } }
function document(): ProjectCanvasDocument {
  return { schema: PROJECT_CANVAS_SCHEMA, scope, id: target.documentId, revision: 3, camera: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { ...base, id: 'group', title: 'Scene', kind: 'group', collapsed: false },
      { ...base, id: 'source', title: 'Reference', kind: 'material', artifact, groupId: 'group' },
      { ...base, id: 'note', title: 'Draft', kind: 'draft', text: '角色设计 🎬', groupId: 'group' },
      { ...base, id: 'generate', title: 'Generate', kind: 'operation', owner: 'eikona', actionRef: 'action:generate', controls: { count: 2 }, selectedArtifact: artifact },
      { ...base, id: 'result', title: 'Selected result', kind: 'result', artifact },
    ], edges: [
      { id: 'reference', kind: 'reference', source: 'note', target: 'source' },
      { id: 'execute', kind: 'execution', source: 'source', target: 'generate', input: 'reference', output: 'asset', purpose: 'reference-image' },
    ] }
}
function apply(editor: ReturnType<typeof createProjectCanvasEditor>, edit: ProjectCanvasEdit) {
  const result = editProjectCanvas(editor, target, editor.editVersion, edit)
  if (!result.ok) throw new Error(result.reason)
  return result.editor
}

describe('project canvas draft transitions', () => {
  it('preserves owner versions and isolates initialization from caller mutation', () => {
    const input = document()
    const editor = createProjectCanvasEditor(input)
    input.nodes[0]!.title = 'Changed outside'
    expect(editor.document.nodes[0]!.title).toBe('Scene')
    expect(Object.isFrozen(editor.document.nodes[0])).toBe(true)
    const moved = apply(editor, { type: 'move', ids: ['source'], dx: 10, dy: 20 })
    expect(moved.document.revision).toBe(3)
    expect(moved.editVersion).toBe(1)
    expect(moved.document.nodes.find(n => n.id === 'source')).toMatchObject({ position: { x: 10, y: 20 }, artifact: { version: '7' } })
    expect(editor.document.nodes[1]!.position).toEqual({ x: 0, y: 0 })
  })

  it('rejects late edits across project, workspace, document and local edit revision', () => {
    const editor = createProjectCanvasEditor(document())
    const edit = { type: 'text', id: 'note', text: 'New' } as const
    for (const wrong of [{ ...target, projectRef: 'project:two' }, { ...target, workspaceRef: 'workspace:two' }, { ...target, documentId: 'canvas-two' }]) {
      expect(editProjectCanvas(editor, wrong, 0, edit)).toEqual({ ok: false, reason: 'scope_mismatch', editor })
    }
    expect(editProjectCanvas(editor, target, 1, edit)).toEqual({ ok: false, reason: 'edit_conflict', editor })
  })

  it('moves a group and descendants once even when a child is selected too', () => {
    const moved = apply(createProjectCanvasEditor(document()), { type: 'move', ids: ['group', 'source'], dx: 5, dy: 8 })
    for (const id of ['group', 'source', 'note']) expect(moved.document.nodes.find(n => n.id === id)!.position).toEqual({ x: 5, y: 8 })
    expect(moved.document.nodes.find(n => n.id === 'result')!.position).toEqual({ x: 0, y: 0 })
  })

  it('copies groups and internal relationships, preserving referenced assets but clearing operation selections', () => {
    const original = createProjectCanvasEditor(document())
    const copied = apply(original, { type: 'copy', ids: ['group', 'generate'],
      nodeIds: { group: 'group-copy', source: 'source-copy', note: 'note-copy', generate: 'generate-copy' },
      edgeIds: { reference: 'reference-copy', execute: 'execute-copy' }, dx: 30, dy: 40 })
    expect(copied.document.nodes).toHaveLength(9)
    expect(copied.document.nodes.find(n => n.id === 'source-copy')).toMatchObject({ groupId: 'group-copy', artifact: { ref: artifact.ref, version: '7' } })
    expect(copied.document.nodes.find(n => n.id === 'generate-copy')).not.toHaveProperty('selectedArtifact')
    expect(copied.document.edges.find(e => e.id === 'execute-copy')).toMatchObject({ source: 'source-copy', target: 'generate-copy', purpose: 'reference-image' })
    expect(copied.document.revision).toBe(original.document.revision)
    expect(copied.document).not.toHaveProperty('runs')
  })

  it('removes a group without deleting its children and removes dangling edges when a node is deleted', () => {
    let editor = apply(createProjectCanvasEditor(document()), { type: 'remove', ids: ['group'] })
    expect(editor.document.nodes).toHaveLength(4)
    expect(editor.document.nodes.find(n => n.id === 'source')).not.toHaveProperty('groupId')
    editor = apply(editor, { type: 'select', ids: ['source', 'note'] })
    editor = apply(editor, { type: 'remove', ids: ['source'] })
    expect(editor.document.edges).toEqual([])
    expect(editor.selection).toEqual(['note'])
  })

  it('supports undo/redo and invalidates redo after a different edit', () => {
    let editor = createProjectCanvasEditor(document())
    editor = apply(editor, { type: 'text', id: 'note', text: '中文新草稿 🎬' })
    editor = apply(editor, { type: 'undo' })
    expect(editor.document.nodes.find(n => n.id === 'note')).toMatchObject({ text: '角色设计 🎬' })
    editor = apply(editor, { type: 'redo' })
    expect(editor.document.nodes.find(n => n.id === 'note')).toMatchObject({ text: '中文新草稿 🎬' })
    editor = apply(editor, { type: 'undo' })
    editor = apply(editor, { type: 'camera', camera: { x: 50, y: 10, zoom: 2 } })
    expect(editor.future).toEqual([])
    expect(apply(editor, { type: 'redo' })).toBe(editor)
    expect(editor.document.revision).toBe(3)
  })

  it('rejects malformed edits atomically and cannot change owner content with a text action', () => {
    const editor = createProjectCanvasEditor(document())
    const edits: ProjectCanvasEdit[] = [
      { type: 'text', id: 'result', text: 'Overwrite owner' },
      { type: 'resize', id: 'note', width: -1, height: 2 },
      { type: 'move', ids: ['source'], dx: Infinity, dy: 0 },
      { type: 'camera', camera: { x: 0, y: 0, zoom: 0 } },
      { type: 'group', ids: ['group'], groupId: 'group' },
      { type: 'connect', edge: { id: 'dangling', kind: 'reference', source: 'missing', target: 'note' } },
      { type: 'add', nodes: [document().nodes[0]!] },
      { type: 'controls', id: 'generate', controls: { endpoint: 'https://private.example' } },
    ]
    for (const edit of edits) expect(editProjectCanvas(editor, target, 0, edit)).toEqual({ ok: false, editor, reason: 'invalid_edit' })
  })

  it('rejects arbitrary runtime fields and unsafe paths at document ingress', () => {
    expect(ProjectCanvasDocumentSchema.safeParse({ ...document(), credential: 'not-a-real-secret' }).success).toBe(false)
    const input = document()
    input.nodes[3] = { ...input.nodes[3]!, runId: 'run:one' } as ProjectCanvasNode
    expect(ProjectCanvasDocumentSchema.safeParse(input).success).toBe(false)
    expect(ProjectCanvasDocumentSchema.safeParse({ ...document(), scope: { ...scope, projectRef: '/private/project' } }).success).toBe(false)
  })

  it('keeps cyclic execution drafts editable, without representing them as runnable', () => {
    const input = document()
    input.edges.push({ id: 'cycle', kind: 'execution', source: 'generate', target: 'generate', input: 'text', output: 'text', purpose: 'prompt' })
    const editor = createProjectCanvasEditor(input)
    expect(editor.document.edges).toHaveLength(3)
    expect(editor.document).not.toHaveProperty('runnable')
  })

  it('searches text and titles without requiring an owner call', () => {
    expect(searchProjectCanvas(document(), '角色')).toEqual(['note'])
    expect(searchProjectCanvas(document(), 'reference')).toEqual(['source'])
  })
})

it('applies child-first absolute drag events without moving selected children twice', () => {
  let editor = createProjectCanvasEditor(document())
  const changes = [{ id: 'source', x: 10, y: 20 }, { id: 'group', x: 10, y: 20 }]
  for (const change of orderProjectCanvasPositions(editor.document, changes)) {
    const current = editor.document.nodes.find(node => node.id === change.id)!
    editor = apply(editor, { type: 'move', ids: [change.id], dx: change.x - current.position.x, dy: change.y - current.position.y })
  }
  for (const id of ['group', 'source', 'note']) expect(editor.document.nodes.find(node => node.id === id)!.position).toEqual({ x: 10, y: 20 })
  expect(changes[0]!.id).toBe('source')
})

it('preserves redo after unchanged position and viewport echoes', () => {
  let editor = createProjectCanvasEditor(document())
  editor = apply(editor, { type: 'move', ids: ['source'], dx: 12, dy: 4 })
  editor = apply(editor, { type: 'undo' })
  const undone = editor
  editor = apply(editor, { type: 'move', ids: ['source'], dx: 0, dy: 0 })
  editor = apply(editor, { type: 'camera', camera: { ...editor.document.camera } })
  expect(editor).toBe(undone)
  expect(editor.future).toHaveLength(1)
  editor = apply(editor, { type: 'redo' })
  expect(editor.document.nodes.find(node => node.id === 'source')!.position).toEqual({ x: 12, y: 4 })
})

it('persists input review markers with the draft and restores them through undo', () => {
 const original = createProjectCanvasEditor(document())
 const moved = apply(original, { type: 'move', ids: ['generate'], dx: 4, dy: 5 })
 expect(moved.document.nodes.find(node => node.id === 'generate')).not.toHaveProperty('inputReviewRequired')
 const edited = apply(moved, { type: 'controls', id: 'generate', controls: { count: 3 } })
 expect(edited.document.nodes.find(node => node.id === 'generate')).toMatchObject({ inputReviewRequired: true, selectedArtifact: { version: '7' } })
 const restored = createProjectCanvasEditor(JSON.parse(JSON.stringify(edited.document)))
 expect(restored.document.nodes.find(node => node.id === 'generate')).toHaveProperty('inputReviewRequired', true)
 expect(apply(edited, { type: 'undo' }).document).toEqual(moved.document)
 expect(original.document.nodes.find(node => node.id === 'generate')).not.toHaveProperty('inputReviewRequired')
})
