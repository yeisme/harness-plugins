/**
 * Shared UI prop types for the creative pipeline workbench shell
 * (dsh-creative-pipeline-visual-workbench-v1, D2).
 *
 * Contract types are re-exported from the frozen D1 owners
 * (`@yeisme/dsh-plugin-contracts` creative-pipeline module and
 * `@yeisme/dsh-pane-protocol`); this module only adds presentational props.
 * Every component in this directory is a controlled shell: projections and
 * callbacks arrive via props, and the components never fetch data, dispatch
 * owner actions, or mutate project/selection/run state themselves.
 */

import type { DragEventHandler, ReactNode } from 'react'
import type {
  BoundedSummary,
  CreativePipelineNodeKindV1,
  CreativeWorkSurfaceKindV1,
  WorkSurfaceCapsuleV1,
} from '@yeisme/dsh-plugin-contracts'
import type { ArtifactRefV1, PaneActionDescriptorV1 } from '@yeisme/dsh-pane-protocol'
import type { ProjectCanvasController } from '@yeisme/dsh-client-ui-pane-domain'
import type { SurfacePhase } from '@yeisme/dsh-client-ui-surface'

export type {
  BoundedSummary,
  CreativePipelineNodeKindV1,
  CreativePipelineRunProgressV1,
  CreativePipelineRunStateKindV1,
  CreativeWorkSurfaceKindV1,
  WorkSurfaceCapsuleMenuV1,
  WorkSurfaceCapsuleV1,
} from '@yeisme/dsh-plugin-contracts'
export type { ArtifactRefV1, PaneActionDescriptorV1, PipelineRunProjectionV1 } from '@yeisme/dsh-pane-protocol'

/** Top bar sections next to the project picker (ComfyUI-style work surface nav). */
export type PipelineWorkbenchSection = 'workflow' | 'models' | 'assets' | 'render' | 'gallery'
export const PIPELINE_WORKBENCH_SECTIONS: readonly PipelineWorkbenchSection[] = ['workflow', 'models', 'assets', 'render', 'gallery']

/** Safe project option for the project dropdown: opaque ref + bounded label only. */
export interface PipelineProjectOption {
  readonly ref: string
  readonly label: string
  readonly context?: string
}

/** Agent ⇄ Workbench capsule. Switching only changes the active surface. */
export interface WorkSurfaceCapsuleProps {
  readonly capsule: WorkSurfaceCapsuleV1
  /** Called with the requested surface; must not alter project/selection/run/permissions. */
  readonly onSwitchSurface: (surface: CreativeWorkSurfaceKindV1) => void
}

/** Project dropdown + section navigation rendered inside the single SurfaceContextBar nav slot. */
export interface PipelineWorkbenchNavProps {
  readonly project: PipelineProjectOption
  readonly projects?: readonly PipelineProjectOption[]
  readonly onSelectProject?: (ref: string) => void
  readonly section: PipelineWorkbenchSection
  readonly onSelectSection: (section: PipelineWorkbenchSection) => void
  readonly sectionLabels?: Readonly<Record<PipelineWorkbenchSection, string>>
}

/** Props forwarded to the embedded ui-pane-domain ProjectCanvasView (structural; ViewProps is not exported upstream). */
export interface PipelineCanvasHostProps {
  readonly controller: ProjectCanvasController
  readonly artifacts?: readonly ArtifactRefV1[]
  readonly actions?: readonly PaneActionDescriptorV1[]
  readonly resolveMedia?: (artifact: ArtifactRefV1) => Promise<{ readonly url: string; readonly expiresAt: string } | undefined>
  readonly openProfessional?: (owner: string, artifact?: ArtifactRefV1) => void
  readonly t?: (key: string) => string
}

/** Placeholder state for the canvas host region when no canvas binding is supplied. */
export interface PipelineCanvasPlaceholder {
  readonly phase: SurfacePhase
  readonly title: string
  readonly description?: string
}

/** One entry in the left icon rail (asset kinds etc.). Icon is a short text marker, never emoji. */
export interface PipelineRailNavItem {
  readonly id: string
  readonly marker: string
  readonly label: string
  readonly active?: boolean
}

/** A production entry under the Productions card (an independently openable project object). */
export interface PipelineProductionEntry {
  readonly ref: string
  readonly title: string
  readonly meta?: string
}

/** Compact (<=420px) object list row, standing in for the folded canvas. */
export interface PipelineObjectListItem {
  readonly id: string
  readonly kind: CreativePipelineNodeKindV1 | 'group' | 'draft' | 'operation' | 'material' | 'result'
  readonly title: string
  readonly status?: string
  readonly selected?: boolean
}

/** One read-only entry in the bottom Log/Validation/Render Queue strip. */
export interface PipelineRunStripEntry {
  readonly id: string
  readonly text: string
  /** Owner status/freshness word; mapped through statusTone. Unknown words stay neutral. */
  readonly status?: string
  readonly meta?: string
}

export interface BottomRunStripProps {
  readonly log: readonly PipelineRunStripEntry[]
  readonly validation: readonly PipelineRunStripEntry[]
  readonly queue: readonly PipelineRunStripEntry[]
}

/** Inspector/Versions/Comments tab content; the shell owns the tab chrome only. */
export interface PipelineInspectorTabs {
  readonly inspector?: ReactNode
  readonly versions?: ReactNode
  readonly comments?: ReactNode
}

export interface PipelineWorkbenchShellProps {
  readonly title?: string
  readonly project: PipelineProjectOption
  readonly projects?: readonly PipelineProjectOption[]
  readonly onSelectProject?: (ref: string) => void
  readonly section: PipelineWorkbenchSection
  readonly onSelectSection: (section: PipelineWorkbenchSection) => void
  readonly capsule: WorkSurfaceCapsuleV1
  readonly onSwitchSurface: (surface: CreativeWorkSurfaceKindV1) => void
  readonly contextSummary?: BoundedSummary
  readonly railItems?: readonly PipelineRailNavItem[]
  readonly onSelectRailItem?: (id: string) => void
  readonly productions?: readonly PipelineProductionEntry[]
  readonly onOpenProduction?: (ref: string) => void
  /** Canvas binding; when absent the host region renders `canvasPlaceholder`. */
  readonly canvas?: PipelineCanvasHostProps
  readonly canvasPlaceholder?: PipelineCanvasPlaceholder
  /**
   * Media drop handoff on the canvas region (D6). Handlers come from the
   * composition layer (`handlePipelineMediaDrop`); the shell only attaches
   * them and never parses payloads itself.
   */
  readonly onCanvasDrop?: DragEventHandler<HTMLDivElement>
  readonly onCanvasDragOver?: DragEventHandler<HTMLDivElement>
  /** Bounded, visible reason for the last rejected drop or unavailable action channel. */
  readonly canvasNotice?: string
  /** Compact-mode object list (<=420px folds the canvas into this list + detail overlay). */
  readonly objects?: readonly PipelineObjectListItem[]
  readonly onSelectObject?: (id: string) => void
  readonly inspectorTabs?: PipelineInspectorTabs
  readonly runStrip?: BottomRunStripProps
  readonly ariaLabel?: string
}
