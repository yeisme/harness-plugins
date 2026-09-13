import { useEffect, useState, type ReactNode } from 'react'
import type { SceneDocumentV1 } from '@yeisme/dsh-pane-protocol'
import type { Scene3DNodeTransformPatch } from './scene3d-controller.js'

type Scene3DNode = SceneDocumentV1['nodes'][number]

/** Bound on any single transform component; larger magnitudes are rejected with a reason. */
export const SCENE_3D_TRANSFORM_COMPONENT_LIMIT = 1_000_000

export interface NodeTransformEditorProps {
  readonly node: Scene3DNode
  /** Conflict-frozen or otherwise read-only: inputs stay visible but disabled with the reason. */
  readonly disabled?: boolean
  readonly disabledReason?: string
  /** Draft edit intent routed to the controller; nothing here saves directly. */
  readonly onEditTransform?: (patch: Scene3DNodeTransformPatch) => void
  readonly onSetVisibility?: (visible: boolean) => void
}

interface ComponentFieldProps {
  readonly label: string
  readonly value: number
  readonly disabled: boolean
  readonly onCommit: (value: number) => void
  readonly onReject: (reason: string) => void
}

function formatComponent(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

/**
 * One bounded numeric component. Typing stays local until the text parses to a
 * finite in-bounds number; rejected input explains itself and never reaches the
 * draft.
 */
function ComponentField(props: ComponentFieldProps): ReactNode {
  const [text, setText] = useState(formatComponent(props.value))
  useEffect(() => { setText(formatComponent(props.value)) }, [props.value])
  return <label className="vk-field d3d-component">
    <span>{props.label}</span>
    <input
      type="number"
      step="any"
      value={text}
      disabled={props.disabled}
      aria-label={props.label}
      onChange={event => {
        const next = event.target.value
        setText(next)
        const parsed = Number(next)
        if (next.trim() === '' || !Number.isFinite(parsed)) {
          props.onReject(`${props.label} must be a finite number; the edit was not applied.`)
          return
        }
        if (Math.abs(parsed) > SCENE_3D_TRANSFORM_COMPONENT_LIMIT) {
          props.onReject(`${props.label} exceeds the ±${SCENE_3D_TRANSFORM_COMPONENT_LIMIT} bound; the edit was not applied.`)
          return
        }
        props.onCommit(parsed)
      }}
    />
  </label>
}

interface VectorGroupProps {
  readonly legend: string
  readonly labels: readonly string[]
  readonly values: readonly number[]
  readonly disabled: boolean
  readonly onCommit: (index: number, value: number) => void
  readonly onReject: (reason: string) => void
}

function VectorGroup(props: VectorGroupProps): ReactNode {
  return <div className="d3d-vec" role="group" aria-label={props.legend}>
    <span className="d3d-vec-legend">{props.legend}</span>
    <div className="d3d-vec-fields">
      {props.values.map((value, index) => <ComponentField
        key={props.labels[index] ?? index}
        label={`${props.legend} ${props.labels[index] ?? index}`}
        value={value}
        disabled={props.disabled}
        onCommit={next => props.onCommit(index, next)}
        onReject={props.onReject}
      />)}
    </div>
  </div>
}

/**
 * Numeric editing affordance for the selected scene node: translate/rotate/
 * scale components and visibility, all routed through the controller draft
 * (never a direct save). Rotation edits the contract's quaternion tuple
 * directly. Camera nodes expose the same contract-internal fields — the
 * SceneDocumentV1 contract carries no camera-specific parameters (fov, near,
 * far), so none are editable here.
 */
export function NodeTransformEditor(props: NodeTransformEditorProps): ReactNode {
  const { node, disabled = false, disabledReason, onEditTransform, onSetVisibility } = props
  const [rejection, setRejection] = useState<string | undefined>(undefined)
  const transform = node.transform

  const commit = (field: 'translate' | 'rotate' | 'scale', index: number, value: number): void => {
    const next = [...transform[field]] as number[]
    if (next[index] === value) {
      setRejection(undefined)
      return
    }
    next[index] = value
    setRejection(undefined)
    onEditTransform?.({ [field]: next } as Scene3DNodeTransformPatch)
  }

  return <div className="d3d-node-editor" data-disabled={disabled}>
    <div className="d3d-node-head">
      <span className="d3d-node-title">{node.label}</span>
      <span className="vk-muted">{node.kind} · {node.id}</span>
    </div>
    {disabled && disabledReason !== undefined ? <p className="d3d-reason" role="status">{disabledReason}</p> : null}
    <VectorGroup legend="Translate" labels={['X', 'Y', 'Z']} values={transform.translate} disabled={disabled}
      onCommit={(index, value) => commit('translate', index, value)} onReject={setRejection} />
    <VectorGroup legend="Rotate (quaternion)" labels={['X', 'Y', 'Z', 'W']} values={transform.rotate} disabled={disabled}
      onCommit={(index, value) => commit('rotate', index, value)} onReject={setRejection} />
    <VectorGroup legend="Scale" labels={['X', 'Y', 'Z']} values={transform.scale} disabled={disabled}
      onCommit={(index, value) => commit('scale', index, value)} onReject={setRejection} />
    <label className="vk-field d3d-visibility">
      <input
        type="checkbox"
        checked={node.visible}
        disabled={disabled}
        aria-label={`${node.label} visible`}
        onChange={event => { setRejection(undefined); onSetVisibility?.(event.target.checked) }}
      />
      <span>Visible</span>
    </label>
    {node.kind === 'camera'
      ? <p className="d3d-reason">Camera nodes share the base transform and visibility contract; camera-specific parameters (fov, near, far) are not part of the SceneDocumentV1 contract and stay with the asset owner.</p>
      : null}
    {rejection === undefined ? null : <p className="d3d-rejection" role="alert">{rejection}</p>}
  </div>
}
