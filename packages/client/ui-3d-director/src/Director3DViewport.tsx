import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SceneDocumentV1 } from '@yeisme/dsh-pane-protocol'
import { createThreeViewportEngine, type CreateViewport3DEngine, type Viewport3DEngine } from './three-engine.js'

export type { CreateViewport3DEngine, CreateViewport3DEngineInput, Viewport3DEngine } from './three-engine.js'

export interface Director3DViewportProps {
  readonly document: SceneDocumentV1
  readonly selectedNodeId?: string | undefined
  readonly onSelect?: ((nodeId: string) => void) | undefined
  /** Nodes the active shot frames (selection convergence highlight; weaker than selection). */
  readonly emphasizedNodeIds?: readonly string[] | undefined
  /** Read-only freeze (revision conflict): picking still works, editing affordances stay out. */
  readonly frozen?: boolean
  readonly reducedMotion?: boolean
  /** Test/low-end override: always render the scene-tree fallback view. */
  readonly forceFallback?: boolean
  /** Dependency injection for the WebGL engine; defaults to the three.js factory. */
  readonly createEngine?: CreateViewport3DEngine
}

interface TreeRow {
  readonly node: SceneDocumentV1['nodes'][number]
  readonly depth: number
}

function buildTreeRows(document: SceneDocumentV1): readonly TreeRow[] {
  const byId = new Map(document.nodes.map(node => [node.id, node]))
  const children = new Map<string, SceneDocumentV1['nodes']>()
  for (const node of document.nodes) {
    if (node.parentId === undefined || !byId.has(node.parentId)) continue
    const list = children.get(node.parentId) ?? []
    list.push(node)
    children.set(node.parentId, list)
  }
  const scene = document.scenes.find(entry => entry.default === true) ?? document.scenes[0]
  const ordered = new Set(scene?.rootNodeIds ?? [])
  const rootNodes = [
    ...(scene?.rootNodeIds ?? []).map(id => byId.get(id)).filter((node): node is SceneDocumentV1['nodes'][number] => node !== undefined),
    ...document.nodes.filter(node => (node.parentId === undefined || !byId.has(node.parentId)) && !ordered.has(node.id)),
  ]
  const rows: TreeRow[] = []
  const visit = (node: SceneDocumentV1['nodes'][number], depth: number): void => {
    rows.push({ node, depth })
    for (const child of children.get(node.id) ?? []) visit(child, depth + 1)
  }
  for (const root of rootNodes) visit(root, 0)
  return rows
}

/** Scene-tree fallback: equal selection semantics, keyboard-first, no WebGL. */
export function SceneTreeFallback({ document, selectedNodeId, onSelect, emphasizedNodeIds }: Pick<Director3DViewportProps, 'document' | 'selectedNodeId' | 'onSelect' | 'emphasizedNodeIds'>): ReactNode {
  const rows = useMemo(() => buildTreeRows(document), [document])
  const emphasized = useMemo(() => new Set(emphasizedNodeIds ?? []), [emphasizedNodeIds])
  if (rows.length === 0) {
    return <div className="vk-empty" data-scene-tree-empty>
      <strong>Empty scene</strong>
      <p>This scene has no nodes yet. Import a GLB or wait for the owner to publish content.</p>
    </div>
  }
  return <ul className="d3d-tree" role="tree" aria-label="Scene nodes">
    {rows.map(({ node, depth }) => <li key={node.id} role="none">
      <button
        type="button"
        role="treeitem"
        aria-selected={node.id === selectedNodeId}
        data-depth={depth}
        data-node-id={node.id}
        data-kind={node.kind}
        data-shot-bound={emphasized.has(node.id)}
        className="d3d-tree-row"
        onClick={() => onSelect?.(node.id)}
      >
        <span className="d3d-tree-label">{node.label}</span>
        <span className="d3d-tree-meta">{node.kind}{node.visible ? '' : ' · hidden'}{node.resourceRef !== undefined ? ' · asset ref' : ''}{emphasized.has(node.id) ? ' · in shot' : ''}</span>
      </button>
    </li>)}
  </ul>
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * 3D viewport. WebGL path renders placeholder geometry per node (meshes stay
 * opaque refs; nothing is fetched); without WebGL it degrades to the
 * scene-tree list with the same selection contract.
 */
export function Director3DViewport(props: Director3DViewportProps): ReactNode {
  const { document, selectedNodeId, onSelect, emphasizedNodeIds, frozen = false, forceFallback = false, createEngine } = props
  const reducedMotion = props.reducedMotion ?? prefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<Viewport3DEngine | undefined>(undefined)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [engineReady, setEngineReady] = useState(false)

  useEffect(() => {
    if (forceFallback) return
    const canvas = canvasRef.current
    if (canvas === null) return
    const factory = createEngine ?? createThreeViewportEngine
    const engine = factory({
      canvas,
      reducedMotion,
      onSelect: nodeId => onSelectRef.current?.(nodeId),
    })
    if (engine === undefined) return
    engineRef.current = engine
    setEngineReady(true)
    return () => {
      engineRef.current = undefined
      engine.dispose()
    }
  }, [forceFallback, createEngine, reducedMotion])

  useEffect(() => {
    engineRef.current?.setDocument(document)
  }, [document, engineReady])

  useEffect(() => {
    engineRef.current?.setSelected(selectedNodeId)
  }, [selectedNodeId, engineReady])

  useEffect(() => {
    engineRef.current?.setEmphasized?.(new Set(emphasizedNodeIds ?? []))
  }, [emphasizedNodeIds, engineReady])

  const fallback = forceFallback || !engineReady
  return <div className="d3d-viewport" data-frozen={frozen} data-mode={fallback ? 'tree' : 'webgl'}>
    {fallback
      ? <SceneTreeFallback
          document={document}
          selectedNodeId={selectedNodeId}
          {...(onSelect === undefined ? {} : { onSelect })}
          {...(emphasizedNodeIds === undefined ? {} : { emphasizedNodeIds })}
        />
      : null}
    <canvas
      ref={canvasRef}
      className="d3d-canvas"
      data-3d-viewport
      hidden={fallback}
      aria-label="3D scene viewport"
    />
  </div>
}
