/** Public workspace layout contract and its single-owner external store. */
import type { ReactNode } from 'react'

export type WorkspaceRegion = 'right' | 'bottom'
export type WorkspaceRegionMode = 'hidden' | 'rail' | 'dock' | 'sheet' | 'maximized'
export const WORKSPACE_CORE_PANE_VERSION = 'workspace.core-pane.v1' as const
export type WorkspaceCorePaneId = 'dsh.tool-details'

export interface WorkspaceCorePaneHost {
  open(id: WorkspaceCorePaneId): void
  close(id: WorkspaceCorePaneId): void
}

export type WorkspaceCoreViewRenderer = (id: WorkspaceCorePaneId) => ReactNode

export interface WorkspaceLayoutPreference {
  readonly rightVisible?: boolean
  readonly bottomVisible?: boolean
  readonly rightWidth?: number
  readonly bottomRatio?: number
  readonly activeRegion?: WorkspaceRegion
  readonly maximizedRegion?: WorkspaceRegion
}

export interface WorkspaceLayoutSnapshot {
  readonly attached: boolean
  readonly ownerId?: string
  readonly rightVisible: boolean
  readonly bottomVisible: boolean
  readonly rightWidth: number
  readonly bottomRatio: number
  readonly activeRegion: WorkspaceRegion
  readonly maximizedRegion: WorkspaceRegion | undefined
}

export interface WorkspaceLayoutHandle {
  update(next: WorkspaceLayoutPreference): void
  getSnapshot(): WorkspaceLayoutSnapshot
  subscribe(listener: () => void): () => void
  dispose(): void
}

export interface WorkspaceRightOwnerProps {
  readonly region: 'right'
  readonly mode: WorkspaceRegionMode
  readonly width: number
  readonly height: number
  readonly visible: boolean
  readonly maximized: boolean
  readonly renderCoreView: WorkspaceCoreViewRenderer
}

export interface WorkspaceBottomOwnerProps {
  readonly region: 'bottom'
  readonly mode: WorkspaceRegionMode
  readonly width: number
  readonly height: number
  readonly visible: boolean
  readonly maximized: boolean
  readonly renderCoreView: WorkspaceCoreViewRenderer
}

export interface IWorkspaceLayout {
  readonly corePaneVersion: typeof WORKSPACE_CORE_PANE_VERSION
  attach(ownerId: string, initialPreference: WorkspaceLayoutPreference, corePaneHost: WorkspaceCorePaneHost): WorkspaceLayoutHandle
}

export const WORKSPACE_RIGHT_DEFAULT = 480
export const WORKSPACE_BOTTOM_DEFAULT_RATIO = 0.34

const DETACHED_SNAPSHOT: WorkspaceLayoutSnapshot = Object.freeze({
  attached: false,
  rightVisible: false,
  bottomVisible: false,
  rightWidth: WORKSPACE_RIGHT_DEFAULT,
  bottomRatio: WORKSPACE_BOTTOM_DEFAULT_RATIO,
  activeRegion: 'right',
  maximizedRegion: undefined,
})

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalize(
  ownerId: string,
  input: WorkspaceLayoutPreference,
  previous: WorkspaceLayoutSnapshot = DETACHED_SNAPSHOT,
): WorkspaceLayoutSnapshot {
  return Object.freeze({
    attached: true,
    ownerId,
    rightVisible: input.rightVisible ?? previous.rightVisible,
    bottomVisible: input.bottomVisible ?? previous.bottomVisible,
    rightWidth: finite(input.rightWidth) ? input.rightWidth : previous.rightWidth,
    bottomRatio: finite(input.bottomRatio) ? input.bottomRatio : previous.bottomRatio,
    activeRegion: input.activeRegion ?? previous.activeRegion,
    maximizedRegion: Object.prototype.hasOwnProperty.call(input, 'maximizedRegion')
      ? input.maximizedRegion
      : previous.maximizedRegion,
  })
}

/**
 * Concrete provider behind `ctx.workspaceLayout`. AppFrame also consumes this
 * instance directly so attach/dispose changes tracks without a second store.
 */
export class WorkspaceLayoutController implements IWorkspaceLayout {
  #snapshot: WorkspaceLayoutSnapshot = DETACHED_SNAPSHOT
  #listeners = new Set<() => void>()
  #generation = 0
  #corePaneHost: WorkspaceCorePaneHost | undefined

  readonly corePaneVersion = WORKSPACE_CORE_PANE_VERSION

  readonly getSnapshot = (): WorkspaceLayoutSnapshot => this.#snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  attach(
    ownerId: string,
    initialPreference: WorkspaceLayoutPreference,
    corePaneHost: WorkspaceCorePaneHost,
  ): WorkspaceLayoutHandle {
    if (ownerId.trim().length === 0) throw new Error('workspaceLayout: ownerId must be non-empty')
    if (this.#snapshot.attached) {
      throw new Error(`workspaceLayout: owner already attached (${this.#snapshot.ownerId ?? 'unknown'}); dispose it before attaching ${ownerId}`)
    }
    const generation = ++this.#generation
    this.#corePaneHost = corePaneHost
    this.#snapshot = normalize(ownerId, initialPreference)
    this.#emit()
    let disposed = false
    const requireLive = (): boolean => !disposed && generation === this.#generation && this.#snapshot.ownerId === ownerId
    return {
      update: (next) => {
        if (!requireLive()) return
        this.#update(next)
      },
      getSnapshot: () => this.#snapshot,
      subscribe: listener => this.subscribe(listener),
      dispose: () => {
        if (!requireLive()) return
        disposed = true
        this.#corePaneHost = undefined
        this.#snapshot = DETACHED_SNAPSHOT
        this.#emit()
      },
    }
  }

  /** Internal AppFrame resize path; size commits are not an explicit open. */
  updateGeometry(next: Pick<WorkspaceLayoutPreference, 'rightWidth' | 'bottomRatio'>): void {
    if (!this.#snapshot.attached) return
    this.#update(next)
  }

  /** Routes an allowlisted DSH-owned surface into the attached Core Pane host. */
  openCorePane(id: WorkspaceCorePaneId): void {
    this.#requireCorePaneHost().open(id)
  }

  /** Closes an allowlisted DSH-owned surface in the attached Core Pane host. */
  closeCorePane(id: WorkspaceCorePaneId): void {
    this.#requireCorePaneHost().close(id)
  }

  restoreMaximized(): void {
    if (!this.#snapshot.attached || this.#snapshot.maximizedRegion === undefined) return
    this.#snapshot = Object.freeze({ ...this.#snapshot, maximizedRegion: undefined })
    this.#emit()
  }

  #update(next: WorkspaceLayoutPreference): void {
    const ownerId = this.#snapshot.ownerId
    if (ownerId === undefined) return
    this.#snapshot = normalize(ownerId, next, this.#snapshot)
    this.#emit()
  }

  #requireCorePaneHost(): WorkspaceCorePaneHost {
    if (!this.#snapshot.attached || this.#corePaneHost === undefined) {
      throw new Error('workspaceLayout: Core Pane owner is required before opening Tool Details')
    }
    return this.#corePaneHost
  }

  #emit(): void {
    for (const listener of [...this.#listeners]) listener()
  }
}
