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
  for (const id of selected) if (nodes.get(id)?.kind !== 'operation') blockers.push({ code: 'invalid_selection', nodeId: id })
  if (blockers.length) return { kind: 'draft-inspection', nodeIds: [], order: [], bindings: [], blockers }
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
      else bindings.push({ ...binding, source: { kind: 'artifact', artifact: structuredClone(source.selectedArtifact) } })
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
  return { kind: 'draft-inspection', nodeIds, order, bindings, blockers }
}
