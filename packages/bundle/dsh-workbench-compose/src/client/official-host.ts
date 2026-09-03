/**
 * Official Workbench/Pane host integration (compose 6.3).
 *
 * The official DSH workspace surface is the `shell.workspace.right` /
 * `shell.workspace.bottom` layout slots (`ctx.workspaceLayout` Core Pane
 * contract). The composed workbench reaches it through two additive paths and
 * never renders outside an official host:
 *
 * 1. Delegated path — when the Pane Workbench host face (`ctx.paneWorkbench`)
 *    is present, that host owns the official workspace regions, so the
 *    composed workbench registers itself as a picker-visible pane view and
 *    renders inside the host's regions. No direct slot claim is made; two
 *    registrations of a single-kind slot would otherwise fail closed.
 * 2. Direct path — when the Pane Workbench host is absent but the official
 *    right slot is declared by the runtime layout, the composed workbench
 *    claims that slot itself via a declaration-gated registration.
 *
 * Both paths are claimed through {@link registerComposedWorkbenchHost}, whose
 * gate stays closed (null return, no dead surface) on peers without an
 * official workspace surface. All teardown is exact and reversible.
 *
 * @module @yeisme/dsh-workbench-compose/client
 */

import { createElement, type ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { registerComposedWorkbenchHost, type WorkbenchHostSlotHandle } from '../host-slot.ts'
import { ComposedWorkbench } from './composed-workbench.tsx'
import type { ComposedWorkbenchProps } from './composed-workbench.tsx'
import { en } from './locales.ts'
import type { ComposeKey } from './locales.ts'

/** Official full-height workspace slot key (layout `WorkspaceRegion = 'right'`). */
export const OFFICIAL_WORKSPACE_RIGHT_SLOT = 'shell.workspace.right'

/** Structural view of the slots service face used by this module. */
interface SlotsFace {
  inject(name: string, setup: () => () => void): () => void
  register(input: Record<string, unknown>, component: (props: never) => ReactNode): () => void
  spec?(name: string): unknown
}

/** Structural view of the Pane Workbench host face. */
interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
}

/** Structural owner props of one official workspace region slot. */
interface OfficialWorkspaceRegionProps {
  readonly region: 'right' | 'bottom'
  readonly mode: 'hidden' | 'rail' | 'dock' | 'sheet' | 'maximized'
  readonly visible?: boolean
  readonly maximized?: boolean
}

/** Framework kit members consumed by {@link ComposedWorkbench}. */
interface WorkbenchFrameworkKit {
  readonly t?: ComposedWorkbenchProps['t']
  readonly useSessions?: ComposedWorkbenchProps['useSessions']
  readonly useWorkspaces?: ComposedWorkbenchProps['useWorkspaces']
}

/** Locale fallback used only outside a framework `t` seat; keys pass through when untranslated. */
function staticT(key: ComposeKey): string {
  return en[key] ?? key
}

const emptySessions = (): { current: undefined } => ({ current: undefined })
const emptyWorkspaces = (): { items: readonly [] } => ({ items: [] })

function workbenchProps(kit: WorkbenchFrameworkKit, wide: boolean): ComposedWorkbenchProps {
  return {
    wide,
    t: kit.t ?? staticT,
    useSessions: kit.useSessions ?? emptySessions,
    useWorkspaces: kit.useWorkspaces ?? emptyWorkspaces,
  } as ComposedWorkbenchProps
}

/** Pane view body: the composed module tabs rendered inside the Pane Workbench host. */
function ComposedWorkbenchPaneView(): ReactNode {
  return createElement(ComposedWorkbench, workbenchProps({}, true))
}

/**
 * Direct official right-region body: renders nothing while the region is
 * hidden, and never invents geometry — mode, size and maximize stay with the
 * official layout solver.
 */
function OfficialRightRegionView(props: OfficialWorkspaceRegionProps & WorkbenchFrameworkKit): ReactNode {
  if (props.visible === false || props.mode === 'hidden') return null
  return createElement(ComposedWorkbench, workbenchProps(props, props.maximized === true || props.mode === 'maximized'))
}

function probeSlots(ctx: ClientContext): SlotsFace | undefined {
  let face: unknown
  try {
    face = ctx.get('slots')
  } catch {
    face = undefined
  }
  if (face === null || typeof face !== 'object' || typeof (face as SlotsFace).register !== 'function') return undefined
  return face as SlotsFace
}

function probePaneWorkbench(ctx: ClientContext): PaneWorkbenchFace | undefined {
  let face: unknown
  try {
    face = ctx.get('paneWorkbench')
  } catch {
    face = undefined
  }
  if (face === null || typeof face !== 'object' || typeof (face as PaneWorkbenchFace).registerView !== 'function') return undefined
  return face as PaneWorkbenchFace
}

/** Whether the runtime layout declares the official right workspace slot. */
export function officialWorkspaceRightSlotDeclared(slots: SlotsFace | undefined): boolean {
  if (slots === undefined || typeof slots.spec !== 'function') return false
  try {
    return slots.spec(OFFICIAL_WORKSPACE_RIGHT_SLOT) !== undefined
  } catch {
    return false
  }
}

/**
 * Mount the composed workbench on the official Workbench/Pane host when one
 * is available; otherwise degrade to a no-op with no dead surface.
 *
 * @param ctx - client root context.
 * @returns exact disposer that unclaims the host and reverts every registration.
 */
export function installOfficialWorkbenchHost(ctx: ClientContext): () => void {
  const slots = probeSlots(ctx)
  const pane = probePaneWorkbench(ctx)
  const claim: WorkbenchHostSlotHandle | null = registerComposedWorkbenchHost({
    isAvailable: (): boolean => pane !== undefined || officialWorkspaceRightSlotDeclared(slots),
  })
  if (claim === null) return () => {}
  const disposers: Array<() => void> = [() => claim.dispose()]

  if (pane !== undefined) {
    // Delegated path: the Pane Workbench host owns the official regions; the
    // composed workbench contributes itself as one picker-visible view.
    disposers.push(pane.registerView({
      descriptor: {
        kind: 'workbench.compose',
        label: 'Workbench',
        componentKey: 'workbench-compose',
        role: 'content',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
      },
      component: ComposedWorkbenchPaneView,
      showInPicker: true,
    }))
  } else if (slots !== undefined) {
    // Direct path: declaration-gated claim of the official right slot. The
    // effect only runs when the runtime layout declares the slot, so old
    // peers never see a registration attempt.
    disposers.push(slots.inject(OFFICIAL_WORKSPACE_RIGHT_SLOT, () => slots.register(
      { name: OFFICIAL_WORKSPACE_RIGHT_SLOT, registrant: 'dsh-workbench-compose' },
      OfficialRightRegionView as never,
    )))
  }

  return () => {
    for (const dispose of disposers.reverse()) {
      try {
        dispose()
      } catch {
        /* teardown continues across individual contributions */
      }
    }
  }
}
