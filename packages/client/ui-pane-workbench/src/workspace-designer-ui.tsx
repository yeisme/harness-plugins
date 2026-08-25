import { createElement, useState, type KeyboardEvent, type ReactNode } from 'react'
import { t } from './i18n/locale.js'
import type { PaneLocalViewProps } from './view-registry.js'
import { createPaneWorkspace, type PaneWorkspaceV1 } from './workspace.js'
import {
  applyDesignerWorkspace,
  createDesignerSession,
  discardDesigner,
  inspectDesignerApplyUx,
  rollbackDesignerWorkspace,
  saveDesignerWorkspace,
  type DesignerSessionV1,
  placeDesignerProvider,
  redoDesigner,
  setDesignerMotion,
  setDesignerRailOrder,
  setDesignerSplitRatio,
  undoDesigner,
} from './workspace-designer.js'
import type { WorkspaceApplyUxOptionsV1 } from './workspace-apply-ux.js'
import type { PaneWorkspaceProviderPlacementV1 } from './workspace-draft.js'

const DEFAULT_PROVIDERS: readonly PaneWorkspaceProviderPlacementV1[] = [
  { kind: 'dsh.explorer', region: 'right', role: 'navigator', singleton: true },
  { kind: 'dsh.source-control', region: 'right', role: 'navigator', singleton: true },
  { kind: 'terminal.session', region: 'bottom', role: 'utility' },
]

function mutate(session: DesignerSessionV1, placement: PaneWorkspaceProviderPlacementV1): DesignerSessionV1 {
  return placeDesignerProvider(session, placement)
}

export function WorkspaceDesignerInteraction(props: {
  readonly session: DesignerSessionV1
  readonly compact?: boolean
  readonly workspace?: PaneWorkspaceV1
  readonly applyOptions?: WorkspaceApplyUxOptionsV1
  readonly onChange: (session: DesignerSessionV1) => void
  readonly onWorkspaceChange?: (workspace: PaneWorkspaceV1) => void
}): ReactNode {
  const onPaletteKey = (event: KeyboardEvent<HTMLElement>, placement: PaneWorkspaceProviderPlacementV1): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      props.onChange(mutate(props.session, placement))
    }
  }
  const applyUx = props.workspace === undefined
    ? undefined
    : inspectDesignerApplyUx(props.workspace, props.session, props.applyOptions)
  const onApply = (): void => {
    if (props.workspace === undefined) return
    const next = applyDesignerWorkspace(props.workspace, props.session, props.applyOptions)
    props.onChange(next.session)
    props.onWorkspaceChange?.(next.workspace)
  }
  const onSave = (): void => {
    void saveDesignerWorkspace(props.session, props.applyOptions).then(props.onChange)
  }
  const onRollback = (): void => {
    const next = rollbackDesignerWorkspace(props.session)
    props.onChange(next.session)
    if (next.workspace !== undefined) props.onWorkspaceChange?.(next.workspace)
  }
  return createElement('div', { className: 'pwr-designer-interaction', 'data-designer-compact': props.compact === true },
    createElement('div', { className: 'pwr-designer-palette', 'data-pane-designer-slot': 'palette', role: 'listbox', 'aria-label': t('designer.palette') },
      ...DEFAULT_PROVIDERS.map(provider => createElement('button', {
        key: provider.kind,
        type: 'button',
        role: 'option',
        onClick: () => props.onChange(mutate(props.session, provider)),
        onKeyDown: event => onPaletteKey(event, provider),
      }, provider.kind)),
    ),
    createElement('div', { className: 'pwr-designer-canvas', 'data-pane-designer-slot': 'canvas', role: 'group', 'aria-label': t('designer.canvas') },
      createElement('p', null, props.session.draft.schema),
      createElement('ol', null, ...props.session.draft.providerPlacements.map((placement, index) =>
        createElement('li', { key: `${placement.kind}-${index}`, 'data-designer-placement': placement.kind }, placement.kind))),
      createElement('input', {
        type: 'range',
        min: 15,
        max: 85,
        'aria-label': t('designer.ratio'),
        value: Math.round((props.session.draft.regions.right.root.type === 'split' ? props.session.draft.regions.right.root.ratio : 0.5) * 100),
        onChange: event => props.onChange(setDesignerSplitRatio(props.session, 'right', Number(event.currentTarget.value) / 100)),
      }),
    ),
    createElement('div', { className: 'pwr-designer-inspector', 'data-pane-designer-slot': 'inspector' },
      createElement('p', null, props.session.draft.scope),
      createElement('button', { type: 'button', onClick: () => props.onChange(undoDesigner(props.session)) }, t('designer.undo')),
      createElement('button', { type: 'button', onClick: () => props.onChange(redoDesigner(props.session)) }, t('designer.redo')),
      createElement('button', { type: 'button', onClick: () => props.onChange(discardDesigner(createPaneWorkspace())) }, t('designer.discard')),
      createElement('button', { type: 'button', onClick: () => props.onChange(setDesignerRailOrder(props.session, ['source-control', 'explorer', 'customize'])) }, t('designer.rail')),
      createElement('button', { type: 'button', onClick: () => props.onChange(setDesignerMotion(props.session, 'reduced')) }, t('designer.motion')),
      createElement('button', { type: 'button', 'data-designer-apply': 'true', disabled: applyUx !== undefined && !applyUx.risks.canApply, onClick: onApply }, t('designer.apply')),
      createElement('button', { type: 'button', 'data-designer-save': 'true', onClick: onSave }, t('designer.saveAs')),
      createElement('button', { type: 'button', 'data-designer-rollback': 'true', disabled: props.session.rollback === undefined, onClick: onRollback }, 'Rollback'),
      applyUx === undefined ? null : createElement('div', { 'data-designer-apply-ux': applyUx.lastReceipt?.status ?? 'idle' },
        createElement('ul', { 'data-designer-diff': String(applyUx.diff.changes.length) },
          ...applyUx.diff.changes.map(change => createElement('li', { key: change.path, 'data-designer-change': change.kind }, change.path))),
        createElement('ul', { 'data-designer-risks': String(applyUx.risks.keepInPlace.length) },
          ...applyUx.risks.keepInPlace.map(risk => createElement('li', { key: `${risk.code}:${risk.viewId ?? risk.message}`, 'data-designer-keep-in-place': risk.code }, risk.message))),
        applyUx.lastReceipt === undefined
          ? null
          : createElement('p', { 'data-designer-receipt': applyUx.lastReceipt.status }, applyUx.lastReceipt.status),
      ),
    ),
  )
}

export function WorkspaceDesignerCoreView({ view }: PaneLocalViewProps): ReactNode {
  const [workspace, setWorkspace] = useState(() => createPaneWorkspace())
  const [session, setSession] = useState(() => createDesignerSession(workspace))
  return createElement('section', {
    className: 'pwr-designer',
    'data-pane-designer': view.id,
    'data-pane-designer-providers': 'placeholder',
  },
    createElement('header', { className: 'pwr-designer-header' }, t('designer.title')),
    createElement(WorkspaceDesignerInteraction, {
      session,
      workspace,
      onChange: setSession,
      onWorkspaceChange: setWorkspace,
    }),
  )
}
