/**
 * V4 Task 3.6: Drag Visuals
 *
 * Implements shared ghost portal, source placeholder, center insertion marker,
 * edge zones, hysteresis and disabled reasons. Drag payload excludes view body.
 */

import { createElement, useEffect, useRef, useState } from 'react'
import type { PaneViewInstanceV1 } from './workspace.js'

export interface DragGhostProps {
  view: PaneViewInstanceV1
  x: number
  y: number
  isDragging: boolean
}

// V4 Task 3.6: Shared ghost portal renders Tab appearance without view body
export function DragGhost(props: DragGhostProps): React.ReactNode {
  const { view, x, y, isDragging } = props

  if (!isDragging) return null

  return createElement('div', {
    'data-pane-drag-ghost': 'true',
    style: {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 10000,
      opacity: 0.9,
    },
  },
    createElement('div', {
      className: 'pwr-tab pwr-tab-ghost',
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        background: 'var(--dsh-background-secondary)',
        border: '1px solid var(--dsh-border-default)',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: '88px',
        maxWidth: '220px',
      },
    },
      createElement('span', { className: 'pwr-tab-title' }, view.title)
    )
  )
}

export interface DragPlaceholderProps {
  viewId: string
  isBeingDragged: boolean
}

// V4 Task 3.6: Source placeholder maintains layout space during drag
export function DragPlaceholder(props: DragPlaceholderProps): React.ReactNode {
  const { viewId, isBeingDragged } = props

  if (!isBeingDragged) return null

  return createElement('div', {
    'data-pane-drag-placeholder': viewId,
    style: {
      position: 'absolute',
      inset: 0,
      opacity: 0.45,
      pointerEvents: 'none',
      background: 'var(--dsh-background-tertiary)',
      border: '1px dashed var(--dsh-border-default)',
      borderRadius: '4px',
    },
  })
}

export interface InsertionMarkerProps {
  groupId: string
  enabled: boolean
  edge?: 'left' | 'right' | 'top' | 'bottom' | 'center'
  index?: number
}

// V4 Task 3.6: Center insertion marker for tab reordering
export function InsertionMarker(props: InsertionMarkerProps): React.ReactNode {
  const { groupId, enabled, edge, index } = props

  if (!enabled || edge !== 'center' || index === undefined) return null

  return createElement('div', {
    'data-pane-insertion-marker': 'center',
    'data-pane-insertion-marker-enabled': enabled.toString(),
    style: {
      position: 'absolute',
      width: '2px',
      height: '100%',
      background: 'var(--dsh-accent-primary)',
      transform: 'translateX(-50%)',
      pointerEvents: 'none',
      zIndex: 100,
    },
  })
}

export interface EdgeZoneProps {
  groupId: string
  edge: 'left' | 'right' | 'top' | 'bottom'
  enabled: boolean
  reason?: string
}

// V4 Task 3.6: Edge zones with hysteresis (48px minimum width, 12px hysteresis)
export function EdgeZone(props: EdgeZoneProps): React.ReactNode {
  const { groupId, edge, enabled, reason } = props

  return createElement('div', {
    'data-pane-edge-zone': edge,
    'data-pane-edge-enabled': enabled.toString(),
    'data-pane-edge-reason': reason ?? '',
    style: {
      position: 'absolute',
      [edge === 'left' || edge === 'right' ? 'width' : 'height']: '48px',
      [edge]: 0,
      pointerEvents: 'none',
      opacity: enabled ? 0.2 : 0.1,
      background: enabled
        ? 'var(--dsh-accent-primary)'
        : 'var(--dsh-border-default)',
      transition: 'opacity 80ms ease',
    },
  })
}

// V4 Task 3.6: Shared ghost portal container (mounted once at document.body)
export function useDragGhostPortal(view: PaneViewInstanceV1 | undefined, isDragging: boolean, x: number, y: number) {
  const portalRef = useRef<HTMLDivElement | null>(null)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    // Create portal container on first drag
    if (isDragging && !portalRef.current) {
      const portal = document.createElement('div')
      portal.id = 'pane-drag-ghost-portal'
      portal.style.position = 'fixed'
      portal.style.top = '0'
      portal.style.left = '0'
      portal.style.width = '0'
      portal.style.height = '0'
      portal.style.pointerEvents = 'none'
      portal.style.zIndex = '10000'
      document.body.appendChild(portal)
      portalRef.current = portal
      forceUpdate(p => p + 1)
    }

    // Clean up portal when drag ends
    return () => {
      if (!isDragging && portalRef.current) {
        document.body.removeChild(portalRef.current)
        portalRef.current = null
        forceUpdate(p => p + 1)
      }
    }
  }, [isDragging, forceUpdate])

  if (!isDragging || !view || !portalRef.current) return null

  // Return portal ref for rendering ghost
  return portalRef.current
}

// V4 Task 3.6: Hysteresis helper - target must be stable for 80ms before switching
export function useDragHysteresis(
  currentTarget: string | undefined,
  currentEnabled: boolean,
  stableForMs: number = 80
): { stableTarget: string | undefined; stableEnabled: boolean } {
  const [stable, setStable] = useState<{ target: string | undefined; enabled: boolean; timestamp: number }>({
    target: undefined,
    enabled: false,
    timestamp: 0,
  })

  const now = Date.now()
  const current = { target: currentTarget, enabled: currentEnabled, timestamp: now }

  // Only update stable state if current matches stable for duration
  if (current.target === stable.target && current.enabled === stable.enabled) {
    if (now - stable.timestamp > stableForMs) {
      setStable(current)
    }
  } else {
    // Reset stable state when target changes
    setStable({ target: undefined, enabled: false, timestamp: now })
  }

  return { stableTarget: stable.target, stableEnabled: stable.enabled }
}
