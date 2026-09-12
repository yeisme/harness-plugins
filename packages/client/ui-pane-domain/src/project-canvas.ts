import { inspectCanvasChangeImpact } from './project-canvas-workflow.js'
import {
  ProjectCanvasDocumentSchema,
  type ProjectCanvasDocument,
  type ProjectCanvasEdge,
  type ProjectCanvasNode,
  type ProjectCanvasScope,
} from '@yeisme/dsh-pane-protocol'

export interface ProjectCanvasEditor {
  readonly document: ProjectCanvasDocument
  /** Local edit fence, separate from the last owner-confirmed document revision. */
  readonly editVersion: number
  readonly selection: readonly string[]
  readonly past: readonly ProjectCanvasDocument[]
  readonly future: readonly ProjectCanvasDocument[]
}

export type ProjectCanvasEdit =
  | { readonly type: 'add'; readonly nodes: readonly ProjectCanvasNode[] }
  | { readonly type: 'select'; readonly ids: readonly string[] }
  | { readonly type: 'move'; readonly ids: readonly string[]; readonly dx: number; readonly dy: number }
  | { readonly type: 'resize'; readonly id: string; readonly width: number; readonly height: number }
  | { readonly type: 'text'; readonly id: string; readonly text: string }
  | { readonly type: 'controls'; readonly id: string; readonly controls: Record<string, string | number | boolean | null> }
  | { readonly type: 'camera'; readonly camera: ProjectCanvasDocument['camera'] }
  | { readonly type: 'group'; readonly ids: readonly string[]; readonly groupId?: string }
  | { readonly type: 'collapse'; readonly id: string; readonly collapsed: boolean }
  | { readonly type: 'connect'; readonly edge: ProjectCanvasEdge }
  | { readonly type: 'disconnect'; readonly id: string }
  | { readonly type: 'remove'; readonly ids: readonly string[] }
  | { readonly type: 'copy'; readonly ids: readonly string[]; readonly nodeIds: Readonly<Record<string, string>>; readonly edgeIds: Readonly<Record<string, string>>; readonly dx: number; readonly dy: number }
  | { readonly type: 'undo' | 'redo' }

export type ProjectCanvasEditResult =
  | { readonly ok: true; readonly editor: ProjectCanvasEditor }
  | { readonly ok: false; readonly editor: ProjectCanvasEditor; readonly reason: 'scope_mismatch' | 'edit_conflict' | 'invalid_edit' }

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

export function createProjectCanvasEditor(input: unknown): ProjectCanvasEditor {
  return freeze({ document: ProjectCanvasDocumentSchema.parse(input), editVersion: 0, selection: [], past: [], future: [] })
}

/** Rebase UI history only after a matching Host save receipt; never discard edits made during save. */
export function acknowledgeProjectCanvasSave(editor: ProjectCanvasEditor, revision: number): ProjectCanvasEditor {
  if (!Number.isSafeInteger(revision) || revision <= editor.document.revision) throw new Error('invalid save revision')
  const rebase = (document: ProjectCanvasDocument) => ({ ...document, revision })
  return freeze({ ...editor, document: rebase(editor.document), editVersion: editor.editVersion + 1,
    past: editor.past.map(rebase), future: editor.future.map(rebase) })
}

/** Pure UI draft transition: no owner writes, run submission, automatic adoption or save claims. */
export function editProjectCanvas(
  editor: ProjectCanvasEditor,
  scope: ProjectCanvasScope & { readonly documentId: string },
  expectedEditVersion: number,
  edit: ProjectCanvasEdit,
): ProjectCanvasEditResult {
  const fail = (reason: 'scope_mismatch' | 'edit_conflict' | 'invalid_edit'): ProjectCanvasEditResult => ({ ok: false, editor, reason })
  const current = editor.document
  if (scope.projectRef !== current.scope.projectRef || scope.workspaceRef !== current.scope.workspaceRef || scope.documentId !== current.id) return fail('scope_mismatch')
  if (expectedEditVersion !== editor.editVersion) return fail('edit_conflict')
  const nodes = new Map(current.nodes.map(node => [node.id, node]))
  const requireIds = (ids: readonly string[]) => {
    if (ids.some(id => !nodes.has(id))) throw new Error('node not found')
    return new Set(ids)
  }
  const withDescendants = (ids: readonly string[]) => {
    const selected = requireIds(ids)
    let added = true
    while (added) {
      added = false
      for (const node of current.nodes) {
        if (node.groupId !== undefined && selected.has(node.groupId) && !selected.has(node.id)) {
          selected.add(node.id); added = true
        }
      }
    }
    return selected
  }
  let document = current
  let selection = editor.selection
  let past = editor.past
  let future = editor.future
  try {
    switch (edit.type) {
      case 'select': selection = [...requireIds(edit.ids)]; break
      case 'add': document = { ...current, nodes: [...current.nodes, ...edit.nodes] }; break
      case 'move': {
        const ids = withDescendants(edit.ids)
        if (edit.dx === 0 && edit.dy === 0) return { ok: true, editor }
        document = { ...current, nodes: current.nodes.map(node => ids.has(node.id)
          ? { ...node, position: { x: node.position.x + edit.dx, y: node.position.y + edit.dy } } : node) }
        break
      }
      case 'resize': {
        requireIds([edit.id])
        document = { ...current, nodes: current.nodes.map(node => node.id === edit.id
          ? { ...node, size: { width: edit.width, height: edit.height } } : node) }
        break
      }
      case 'text': {
        if (nodes.get(edit.id)?.kind !== 'draft') return fail('invalid_edit')
        document = { ...current, nodes: current.nodes.map(node => node.id === edit.id && node.kind === 'draft'
          ? { ...node, text: edit.text } : node) }
        break
      }
      case 'controls': {
        if (nodes.get(edit.id)?.kind !== 'operation') return fail('invalid_edit')
        document = { ...current, nodes: current.nodes.map(node => node.id === edit.id && node.kind === 'operation'
          ? { ...node, controls: edit.controls } : node) }
        break
      }
      case 'camera': {
        if (edit.camera.x === current.camera.x && edit.camera.y === current.camera.y && edit.camera.zoom === current.camera.zoom) return { ok: true, editor }
        document = { ...current, camera: edit.camera }; break
      }
      case 'collapse': {
        if (nodes.get(edit.id)?.kind !== 'group') return fail('invalid_edit')
        document = { ...current, nodes: current.nodes.map(node => node.id === edit.id && node.kind === 'group'
          ? { ...node, collapsed: edit.collapsed } : node) }
        break
      }
      case 'group': {
        const ids = requireIds(edit.ids)
        document = { ...current, nodes: current.nodes.map(node => {
          if (!ids.has(node.id)) return node
          const { groupId: _previous, ...rest } = node
          return edit.groupId === undefined ? rest : { ...rest, groupId: edit.groupId }
        }) }
        break
      }
      case 'connect': document = { ...current, edges: [...current.edges, edit.edge] }; break
      case 'disconnect': {
        if (!current.edges.some(edge => edge.id === edit.id)) return fail('invalid_edit')
        document = { ...current, edges: current.edges.filter(edge => edge.id !== edit.id) }
        break
      }
      case 'remove': {
        const ids = requireIds(edit.ids)
        document = { ...current, nodes: current.nodes.filter(node => !ids.has(node.id)).map(node => {
          if (node.groupId === undefined || !ids.has(node.groupId)) return node
          const { groupId: _previous, ...rest } = node
          return rest
        }), edges: current.edges.filter(edge => !ids.has(edge.source) && !ids.has(edge.target)) }
        break
      }
      case 'copy': {
        const ids = withDescendants(edit.ids)
        const selected = current.nodes.filter(node => ids.has(node.id))
        const copies = selected.map(node => {
          const id = edit.nodeIds[node.id]
          if (id === undefined || nodes.has(id)) throw new Error('fresh node id required')
          const { groupId, ...rest } = node
          const copy = { ...rest, id, position: { x: node.position.x + edit.dx, y: node.position.y + edit.dy },
            ...(groupId !== undefined && ids.has(groupId) ? { groupId: edit.nodeIds[groupId] } : {}) }
          if (copy.kind === 'operation') {
            // A copied operation is a new draft; it does not inherit an adopted result or a run.
            const { selectedArtifact: _selected, ...draft } = copy
            return draft
          }
          return copy
        })
        const edges = current.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)).map(edge => {
          const id = edit.edgeIds[edge.id]
          if (id === undefined) throw new Error('fresh edge id required')
          return { ...edge, id, source: edit.nodeIds[edge.source], target: edit.nodeIds[edge.target] }
        })
        document = { ...current, nodes: [...current.nodes, ...copies], edges: [...current.edges, ...edges] } as ProjectCanvasDocument
        selection = copies.map(node => node.id)
        break
      }
      case 'undo': {
        const previous = past.at(-1)
        if (previous === undefined) return { ok: true, editor }
        document = previous; past = past.slice(0, -1); future = [...future, current]
        break
      }
      case 'redo': {
        const next = future.at(-1)
        if (next === undefined) return { ok: true, editor }
        document = next; future = future.slice(0, -1); past = [...past, current]
        break
      }
      default: return fail('invalid_edit')
    }
    if (document !== current) {
      document = ProjectCanvasDocumentSchema.parse(document)
      if (edit.type !== 'undo' && edit.type !== 'redo') {
        const impact = inspectCanvasChangeImpact(current, document)
        const affected = new Set(impact.affectedOperationIds)
        if (affected.size) document = ProjectCanvasDocumentSchema.parse({ ...document, nodes: document.nodes.map(node =>
          node.kind === 'operation' && affected.has(node.id) ? { ...node, inputReviewRequired: true } : node) })
      }

      if (edit.type !== 'undo' && edit.type !== 'redo') { past = [...editor.past, current].slice(-50); future = [] }
    }
    const existing = new Set(document.nodes.map(node => node.id))
    return { ok: true, editor: freeze({ document, selection: selection.filter(id => existing.has(id)),
      editVersion: editor.editVersion + 1, past, future }) }
  } catch {
    return fail('invalid_edit')
  }
}

export function searchProjectCanvas(document: ProjectCanvasDocument, query: string): readonly string[] {
  const needle = query.trim().toLocaleLowerCase()
  return document.nodes.filter(node => node.title.toLocaleLowerCase().includes(needle)
    || (node.kind === 'draft' && node.text.toLocaleLowerCase().includes(needle))).map(node => node.id)
}

/** Apply absolute drag positions parent-first: group movement already moves descendants. */
export function orderProjectCanvasPositions<T extends { readonly id: string }>(document: ProjectCanvasDocument, changes: readonly T[]): T[] {
  const nodes = new Map(document.nodes.map(node => [node.id, node]))
  const depth = (id: string) => {
    let level = 0, parent = nodes.get(id)?.groupId
    while (parent !== undefined) { level++; parent = nodes.get(parent)?.groupId }
    return level
  }
  return [...changes].sort((a, b) => depth(a.id) - depth(b.id))
}
