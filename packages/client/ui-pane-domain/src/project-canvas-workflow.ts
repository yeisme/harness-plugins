import type { ArtifactRefV1, ProjectCanvasDocument, ProjectCanvasEdge } from '@yeisme/dsh-pane-protocol'

export type CanvasRunScope =
  | { readonly kind: 'node'; readonly nodeId: string }
  | { readonly kind: 'branch'; readonly nodeIds: readonly string[] }
  | { readonly kind: 'all' }

export interface CanvasScopeInspection {
  /** This is a draft inspection, never an execution grant or an owner plan. */
  readonly kind: 'draft-inspection'
  readonly nodeIds: readonly string[]
  readonly order: readonly string[]
  readonly bindings: readonly {
    readonly edgeId: string
    readonly target: string
    readonly input: string
    readonly output: string
    readonly purpose: string
    readonly source: { readonly kind: 'step' | 'draft'; readonly nodeId: string } | { readonly kind: 'artifact'; readonly artifact: ArtifactRefV1 }
  }[]
  readonly notices: readonly { readonly code: 'external_input_changed'; readonly nodeId: string; readonly edgeId: string }[]
  readonly blockers: readonly {
    readonly code: 'invalid_selection' | 'empty_scope' | 'execution_cycle' | 'missing_external_output' | 'unsupported_source' | 'ambiguous_input'
    readonly nodeId?: string
    readonly edgeId?: string
  }[]
}

/** Inspect explicit edges only. Owner capability, type, cost and authorization checks remain mandatory. */
export function inspectCanvasRunScope(document: ProjectCanvasDocument, scope: CanvasRunScope): CanvasScopeInspection {
  const nodes = new Map(document.nodes.map(node => [node.id, node]))
  const edges = document.edges.filter((edge): edge is Extract<ProjectCanvasEdge, { kind: 'execution' }> => edge.kind === 'execution')
  const selected = new Set(scope.kind === 'all' ? document.nodes.filter(node => node.kind === 'operation').map(node => node.id)
    : scope.kind === 'node' ? [scope.nodeId] : scope.nodeIds)
  const blockers: CanvasScopeInspection['blockers'][number][] = []
  const notices: CanvasScopeInspection['notices'][number][] = []
  for (const id of selected) if (nodes.get(id)?.kind !== 'operation') blockers.push({ code: 'invalid_selection', nodeId: id })
  if (blockers.length) return { kind: 'draft-inspection', nodeIds: [], order: [], bindings: [], blockers, notices }
  if (scope.kind === 'branch') {
    const outgoing = new Map<string, string[]>()
    for (const edge of edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
    const pending = [...selected]
    for (let index = 0; index < pending.length; index++) {
      for (const target of outgoing.get(pending[index]!) ?? []) {
        if (!selected.has(target)) { selected.add(target); pending.push(target) }
      }
    }
  }
  if (!selected.size) blockers.push({ code: 'empty_scope' })
  const nodeIds = document.nodes.filter(node => selected.has(node.id)).map(node => node.id)
  const indegree = new Map(nodeIds.map(id => [id, 0]))
  const outgoing = new Map<string, string[]>()
  const inputs = new Set<string>()
  const bindings: CanvasScopeInspection['bindings'][number][] = []
  for (const edge of edges) {
    if (!selected.has(edge.target)) continue
    const key = JSON.stringify([edge.target, edge.input])
    if (inputs.has(key)) blockers.push({ code: 'ambiguous_input', nodeId: edge.target, edgeId: edge.id })
    inputs.add(key)
    const source = nodes.get(edge.source)
    const binding = { edgeId: edge.id, target: edge.target, input: edge.input, output: edge.output, purpose: edge.purpose }
    if (selected.has(edge.source)) {
      indegree.set(edge.target, indegree.get(edge.target)! + 1)
      outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
      bindings.push({ ...binding, source: { kind: 'step', nodeId: edge.source } })
    } else if (source?.kind === 'material' || source?.kind === 'result') {
      bindings.push({ ...binding, source: { kind: 'artifact', artifact: structuredClone(source.artifact) } })
    } else if (source?.kind === 'draft') {
      // Do not place user text in control-plane previews or receipts.
      bindings.push({ ...binding, source: { kind: 'draft', nodeId: source.id } })
    } else if (source?.kind === 'operation') {
      if (source.selectedArtifact === undefined) blockers.push({ code: 'missing_external_output', nodeId: source.id, edgeId: edge.id })
      else {
        bindings.push({ ...binding, source: { kind: 'artifact', artifact: structuredClone(source.selectedArtifact) } })
        if (source.inputReviewRequired) notices.push({ code: 'external_input_changed', nodeId: source.id, edgeId: edge.id })
      }
    } else blockers.push({ code: 'unsupported_source', nodeId: edge.source, edgeId: edge.id })
  }
  const pending = nodeIds.filter(id => indegree.get(id) === 0)
  const order: string[] = []
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index]!
    order.push(id)
    for (const target of outgoing.get(id) ?? []) {
      const remaining = indegree.get(target)! - 1
      indegree.set(target, remaining)
      if (remaining === 0) pending.push(target)
    }
  }
  if (order.length !== nodeIds.length) {
    for (const id of nodeIds.filter(id => indegree.get(id)! > 0)) blockers.push({ code: 'execution_cycle', nodeId: id })
  }
  return { kind: 'draft-inspection', nodeIds, order, bindings, blockers, notices }
}

/** Draft impact analysis only: never clears adopted versions or schedules execution. */
export function inspectCanvasImpact(document: ProjectCanvasDocument, changedNodeIds: readonly string[]): {
 readonly valid: boolean; readonly affectedOperationIds: readonly string[]
} {
 const nodes = new Map(document.nodes.map(node => [node.id,node]))
 if (changedNodeIds.some(id => !nodes.has(id))) return { valid: false, affectedOperationIds: [] }
 const outgoing = new Map<string,string[]>()
 for (const edge of document.edges) if (edge.kind === 'execution') outgoing.set(edge.source,[...(outgoing.get(edge.source) ?? []),edge.target])
 const reached = new Set(changedNodeIds), pending = [...reached]
 for (let i = 0; i < pending.length; i++) {
  for (const target of outgoing.get(pending[i]!) ?? []) {
   if (!reached.has(target)) { reached.add(target); pending.push(target) }
  }
 }
 return { valid: true, affectedOperationIds: document.nodes.filter(node => node.kind === 'operation' && reached.has(node.id)).map(node => node.id) }
}

/** Compare execution-relevant draft inputs; layout and reference relationships are not dependencies. */
export function inspectCanvasChangeImpact(before: ProjectCanvasDocument, after: ProjectCanvasDocument) {
 if (before.id !== after.id || before.scope.projectRef !== after.scope.projectRef || before.scope.workspaceRef !== after.scope.workspaceRef) return { valid: false, affectedOperationIds: [] as string[] }
 const semantic = (node: ProjectCanvasDocument['nodes'][number]) => {
  const artifact = (value: ArtifactRefV1 | undefined) => value === undefined ? null : [value.owner, value.ref, value.version]
  if (node.kind === 'draft') return ['draft', node.text]
  if (node.kind === 'operation') return ['operation', node.owner, node.actionRef, Object.entries(node.controls).sort(([a],[b]) => a.localeCompare(b)), artifact(node.selectedArtifact)]
  if (node.kind === 'material' || node.kind === 'result') return [node.kind, artifact(node.artifact)]
  return ['group']
 }
 const previous = new Map(before.nodes.map(node => [node.id,node]))
 const current = new Map(after.nodes.map(node => [node.id,node]))
 const changed = new Set<string>()
 for (const id of new Set([...previous.keys(), ...current.keys()])) {
  const a = previous.get(id), b = current.get(id)
  if (!a || !b || JSON.stringify(semantic(a)) !== JSON.stringify(semantic(b))) changed.add(id)
 }
 const execution = (doc: ProjectCanvasDocument) => new Map(doc.edges.filter(edge => edge.kind === 'execution').map(edge => [edge.id,edge]))
 const oldEdges = execution(before), newEdges = execution(after)
 for (const id of new Set([...oldEdges.keys(), ...newEdges.keys()])) {
  const a = oldEdges.get(id), b = newEdges.get(id)
  const identity = (edge: typeof a) => edge === undefined ? null : [edge.source, edge.target, edge.input, edge.output, edge.purpose]
  if (JSON.stringify(identity(a)) !== JSON.stringify(identity(b))) { if (a) changed.add(a.target); if (b) changed.add(b.target) }
 }
 const oldImpact = inspectCanvasImpact(before,[...changed].filter(id => previous.has(id)))
 const newImpact = inspectCanvasImpact(after,[...changed].filter(id => current.has(id)))
 const affected = new Set([...oldImpact.affectedOperationIds,...newImpact.affectedOperationIds])
 return { valid: true, affectedOperationIds: after.nodes.filter(node => node.kind === 'operation' && affected.has(node.id)).map(node => node.id) }
}
