import type { ReactNode } from 'react'
import type { ShotNavItemV1 } from './previz.js'

export interface ShotNavigatorProps {
  readonly items: readonly ShotNavItemV1[]
  /** Explicit shot selection; also the previsualization switch for the viewport. */
  readonly onSelectShot?: ((shotRef: string) => void) | undefined
  /** Read-only freeze keeps navigation alive (picking still works, edits stay out). */
  readonly frozen?: boolean
}

const DELIVERY_LABELS: Readonly<Record<ShotNavItemV1['deliveryStatus'], string>> = {
  pending: 'delivery pending',
  ready: 'delivery ready',
  blocked: 'delivery blocked',
  stale: 'delivery stale',
  unknown: 'delivery unknown',
}

/**
 * Shot navigation (design: 左侧 Shot 导航, single-column composition wave).
 * Every row carries text status — selection, delivery state, keyframe count
 * and the binding-convergence highlight never rely on color alone.
 */
export function ShotNavigator({ items, onSelectShot, frozen = false }: ShotNavigatorProps): ReactNode {
  if (items.length === 0) {
    return <div className="vk-empty" data-shot-nav-empty>
      <strong>No shots yet</strong>
      <p>The owner has not projected any shot for this scene. The viewport stays in free-orbit previsualization.</p>
    </div>
  }
  return <ul className="d3d-shot-nav" role="listbox" aria-label="Shots" data-frozen={frozen}>
    {items.map(item => <li key={item.shotRef} role="none">
      <button
        type="button"
        role="option"
        aria-selected={item.selected}
        data-shot-ref={item.shotRef}
        data-bound={item.bound}
        className="d3d-shot-row"
        title={item.deliverySummary}
        onClick={() => onSelectShot?.(item.shotRef)}
      >
        <span className="d3d-shot-label">{item.shotRef}</span>
        <span className="d3d-shot-meta">
          {item.keyframeCount} keyframe{item.keyframeCount === 1 ? '' : 's'} · frames {item.frameRange.start}–{item.frameRange.end} · {DELIVERY_LABELS[item.deliveryStatus]}
          {item.bound ? ' · bound to selection' : ''}
        </span>
      </button>
    </li>)}
  </ul>
}
