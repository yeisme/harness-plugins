import { createElement, useState, type KeyboardEvent, type ReactNode } from 'react'
import { t } from './i18n/locale.js'
import type { PaneLocalViewProps } from './view-registry.js'
import { createPaneWorkspace } from './workspace.js'
import {
  createDesignerSession,
  discardDesigner,
  placeDesignerProvider,
  redoDesigner,
  setDesignerMotion,
  setDesignerRailOrder,
  setDesignerSplitRatio,
  undoDesigner,
  type DesignerSessionV1,
} from './workspace-designer.js'
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
  readonly onChange: (session: DesignerSessionV1) => void
}): ReactNode {
  const onPaletteKey = (event: KeyboardEvent<HTMLDivElement>, placement: PaneWorkspaceProviderPlacementV1): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      props.onChange(mutate(props.session, placement))
    }
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
    ),
  )
}

export function WorkspaceDesignerCoreView({ view }: PaneLocalViewProps): ReactNode {
  const [session, setSession] = useState(() => createDesignerSession(createPaneWorkspace()))
  return createElement('section', {
    className: 'pwr-designer',
    'data-pane-designer': view.id,
    'data-pane-designer-providers': 'placeholder',
  },
    createElement('header', { className: 'pwr-designer-header' }, t('designer.title')),
    createElement(WorkspaceDesignerInteraction, { session, onChange: setSession }),
  )
}
