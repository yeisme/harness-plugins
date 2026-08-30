/**
 * Lifecycle-driven view host (V3 2.7).
 *
 * Wires PaneViewLifecycleController into the chrome: a keep-alive view keeps
 * exactly ONE live host — children mount only from the controller's active
 * state, suspend unmounts them (controller survives), and a cross-root move
 * reuses the same React element keyed by view id so remount never
 * double-mounts. The animation frame is injectable for deterministic tests.
 *
 * @module @yeisme/dsh-client-ui-pane-workbench/chrome
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PaneViewLifecycleController, type PaneAnimationFrame } from '../lifecycle.js'
import type { PaneViewInstanceV1 } from '../workspace.js'

export interface LifecycleViewHostProps {
  readonly view: PaneViewInstanceV1
  readonly children: ReactNode
  /** Deterministic frame source for tests; defaults to the browser frame. */
  readonly animationFrame?: PaneAnimationFrame | undefined
}

export function LifecycleViewHost(props: LifecycleViewHostProps): ReactNode {
  const { view, children, animationFrame } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<PaneViewLifecycleController>()
  const [live, setLive] = useState(false)

  if (controllerRef.current === undefined) {
    controllerRef.current = new PaneViewLifecycleController(view, {
      // Hooks fire while the snapshot is still transitioning, so the host
      // drives liveness from the hook identity itself.
      activate: () => { setLive(true) },
      suspend: () => { setLive(false) },
      dispose: () => { setLive(false) },
    }, animationFrame)
  }
  const controller = controllerRef.current

  useEffect(() => {
    const container = containerRef.current
    const observer = typeof ResizeObserver !== 'undefined' && container !== null
      ? new ResizeObserver(entries => {
          const rect = entries[0]?.contentRect
          if (rect === undefined) return
          controller.observeSize(rect.width, rect.height, rect.width > 0 && rect.height > 0)
        })
      : undefined
    observer?.observe(container as Element)
    return () => {
      observer?.disconnect()
      controller.close()
      controllerRef.current = undefined
    }
  }, [controller])

  // Keep-alive views remount the same live host across groups: the element is
  // keyed by view id by the caller, so a move reconciles instead of mounting.
  return <div ref={containerRef} data-pane-lifecycle-host={view.id} data-pane-lifecycle-state={controller.snapshot}>
    {live ? children : <span role="status" aria-hidden="true" data-pane-lifecycle-suspended />}
  </div>
}
