import { useMemo, type ReactNode } from 'react'
import type { ShotV1 } from '@yeisme/dsh-pane-protocol'
import type { Scene3DShotKeyframeEdit } from './scene3d-controller.js'

export interface ShotTimelineProps {
  readonly shot: ShotV1
  readonly playhead: number
  readonly selectedKeyframeId?: string
  /** Frozen/offline states keep the timeline readable but block edits. */
  readonly disabled?: boolean
  readonly onScrub?: (frame: number) => void
  readonly onSelectKeyframe?: (keyframeId: string) => void
  /** Draft edit intent; the controller applies it to the shot draft (never a direct save). */
  readonly onEditKeyframe?: (edit: Scene3DShotKeyframeEdit) => void
}

function formatValue(value: ShotV1['keyframes'][number]['value']): string {
  if (typeof value === 'boolean') return value ? 'visible' : 'hidden'
  return value.map(item => Math.round(item * 100) / 100).join(', ')
}

/**
 * Shot-anchored timeline: frame range, keyframe markers, playhead scrub.
 * Pure UI — it never evaluates animation; real playback sampling is a later
 * seam. Keyframe edits leave as draft intents for the controller.
 */
export function ShotTimeline(props: ShotTimelineProps): ReactNode {
  const { shot, playhead, selectedKeyframeId, disabled = false, onScrub, onSelectKeyframe, onEditKeyframe } = props
  const { start, end, fps } = shot.frameRange
  const span = Math.max(end - start, 1 / fps)
  const keyframes = useMemo(
    () => [...shot.keyframes].sort((left, right) => left.frame - right.frame || left.id.localeCompare(right.id)),
    [shot.keyframes],
  )
  const selected = selectedKeyframeId === undefined ? undefined : keyframes.find(entry => entry.id === selectedKeyframeId)
  const clampedPlayhead = Math.min(Math.max(playhead, start), end)
  const position = (frame: number): number => ((frame - start) / span) * 100

  return <div className="d3d-timeline" data-disabled={disabled}>
    <div className="d3d-timeline-head">
      <span className="d3d-timeline-range">Frames {start}–{end} · {fps} fps</span>
      <span className="d3d-timeline-playhead" role="status">Playhead {clampedPlayhead}</span>
    </div>
    <div className="d3d-track" role="list" aria-label="Keyframes">
      <div className="d3d-playhead-marker" style={{ left: `${position(clampedPlayhead)}%` }} aria-hidden="true" />
      {keyframes.map(keyframe => <button
        key={keyframe.id}
        type="button"
        role="listitem"
        className="d3d-keyframe"
        data-property={keyframe.property}
        data-selected={keyframe.id === selectedKeyframeId}
        style={{ left: `${position(keyframe.frame)}%` }}
        aria-label={`Keyframe ${keyframe.id}: ${keyframe.property} at frame ${keyframe.frame}`}
        aria-pressed={keyframe.id === selectedKeyframeId}
        onClick={() => onSelectKeyframe?.(keyframe.id)}
      />)}
      {keyframes.length === 0 ? <span className="d3d-track-empty">No keyframes in this shot.</span> : null}
    </div>
    <label className="d3d-scrub vk-field">
      <span>Scrub playhead</span>
      <input
        type="range"
        min={start}
        max={end}
        step={1}
        value={clampedPlayhead}
        disabled={disabled}
        aria-label="Scrub playhead"
        onChange={event => onScrub?.(Number(event.target.value))}
      />
    </label>
    {selected === undefined ? null : <div className="d3d-keyframe-detail" role="group" aria-label="Selected keyframe">
      <p className="vk-muted">
        {selected.property} · frame {selected.frame} · object {selected.objectRef} · value {formatValue(selected.value)}
      </p>
      <label className="vk-field">
        <span>Frame</span>
        <input
          type="number"
          min={start}
          max={end}
          step={1}
          value={selected.frame}
          disabled={disabled || onEditKeyframe === undefined}
          aria-label="Keyframe frame"
          title={disabled ? 'Timeline edits are disabled while the workbench is read-only.' : undefined}
          onChange={event => {
            const frame = Number(event.target.value)
            if (Number.isFinite(frame)) onEditKeyframe?.({ type: 'move-keyframe', keyframeId: selected.id, frame })
          }}
        />
      </label>
    </div>}
  </div>
}
