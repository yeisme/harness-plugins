import { createElement, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceActionBar, SurfaceContextBar, SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import { subscriptionHandle } from '@yeisme/dsh-plugin-contracts'
import { t } from './i18n/locale.js'
import type { PaneLocalViewProps, PaneViewRegistryReader } from './view-registry.js'
import { createPaneWorkspace, type PaneWorkspaceV1 } from './workspace.js'
import {
  applyDesignerWorkspace,
  createDesignerSession,
  discardDesigner,
  inspectDesignerApplyUx,
  listDesignerPaletteEntries,
  placementFromDesignerPaletteEntry,
  rollbackDesignerWorkspace,
  saveDesignerWorkspace,
  type DesignerPaletteEntryV1,
  type DesignerSessionV1,
  placeDesignerProvider,
  redoDesigner,
  setDesignerMotion,
  setDesignerRailOrder,
  setDesignerSplitRatio,
  undoDesigner,
} from './workspace-designer.js'
import type { WorkspaceApplyUxOptionsV1 } from './workspace-apply-ux.js'
import { SelectionInteractionDesignerSection, type SelectionDesignerPreferences } from './selection-interaction-designer.js'

export function WorkspaceDesignerInteraction(props: {
  readonly session: DesignerSessionV1
  readonly compact?: boolean
  readonly workspace?: PaneWorkspaceV1
  readonly applyOptions?: WorkspaceApplyUxOptionsV1
  readonly registry?: PaneViewRegistryReader
  readonly onChange: (session: DesignerSessionV1) => void
  readonly onWorkspaceChange?: (workspace: PaneWorkspaceV1) => void
  /** Selection & Interaction 区（V2）：workspace 层选区交互偏好。 */
  readonly selectionPreferences?: SelectionDesignerPreferences
  readonly onSelectionPreferencesChange?: (next: SelectionDesignerPreferences) => void
}): ReactNode {
  const [, setRevision] = useState(0)
  useEffect(() => {
    if (props.registry === undefined) return
    const registryEvents = subscriptionHandle(props.registry.subscribe(() => setRevision(value => value + 1)))
    return () => registryEvents.unsubscribe()
  }, [props.registry])
  const palette = listDesignerPaletteEntries(props.registry?.snapshot() ?? [])
  const place = (entry: DesignerPaletteEntryV1): void => {
    props.onChange(placeDesignerProvider(props.session, placementFromDesignerPaletteEntry(entry)))
  }
  const onPaletteKey = (event: KeyboardEvent<HTMLElement>, entry: DesignerPaletteEntryV1): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      place(entry)
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
      ...palette.map(entry => createElement(Button, {
        key: entry.kind,
        type: 'button',
        size: 'sm',
        variant: 'toolbar',
        role: 'option',
        onClick: () => place(entry),
        onKeyDown: event => onPaletteKey(event, entry),
      }, createElement('span', {
        'data-designer-palette-kind': entry.kind,
        'data-designer-palette-region': entry.region,
        'data-designer-palette-role': entry.role,
      }, entry.kind))),
    ),
    createElement('div', { className: 'pwr-designer-canvas', 'data-pane-designer-slot': 'canvas', role: 'group', 'aria-label': t('designer.canvas') },
      createElement('p', null, props.session.draft.schema),
      createElement('ol', null, ...props.session.draft.providerPlacements.map((placement, index) =>
        createElement('li', {
          key: `${placement.kind}-${index}`,
          'data-designer-placement': placement.kind,
          'data-designer-placement-region': placement.region,
          'data-designer-placement-role': placement.role,
        }, placement.kind))),
      createElement('input', {
        type: 'range',
        min: 15,
        max: 85,
        'aria-label': t('designer.ratio'),
        value: Math.round((props.session.draft.regions.right.root.type === 'split' ? props.session.draft.regions.right.root.ratio : 0.5) * 100),
        onChange: event => props.onChange(setDesignerSplitRatio(props.session, 'right', Number(event.currentTarget.value) / 100)),
      }),
    ),
    createElement(SurfaceSection, { className: 'pwr-designer-inspector', 'data-pane-designer-slot': 'inspector' },
      createElement('p', null, props.session.draft.scope),
      props.selectionPreferences === undefined || props.onSelectionPreferencesChange === undefined
        ? null
        : createElement(SelectionInteractionDesignerSection, {
          preferences: props.selectionPreferences,
          onChange: props.onSelectionPreferencesChange,
        }),
      createElement(SurfaceActionBar, null,
        createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => props.onChange(undoDesigner(props.session)) }, t('designer.undo')),
        createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => props.onChange(redoDesigner(props.session)) }, t('designer.redo')),
        createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => props.onChange(discardDesigner(createPaneWorkspace())) }, t('designer.discard')),
        createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => props.onChange(setDesignerRailOrder(props.session, ['source-control', 'explorer', 'customize'])) }, t('designer.rail')),
        createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => props.onChange(setDesignerMotion(props.session, 'reduced')) }, t('designer.motion')),
      ),
      createElement(SurfaceActionBar, null,
        createElement('span', { 'data-designer-apply': 'true' }, createElement(Button, { type: 'button', size: 'sm', variant: 'primary', disabled: applyUx !== undefined && !applyUx.risks.canApply, title: applyUx !== undefined && !applyUx.risks.canApply ? applyUx.risks.keepInPlace[0]?.message : undefined, onClick: onApply }, t('designer.apply'))),
        createElement('span', { 'data-designer-save': 'true' }, createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: onSave }, t('designer.saveAs'))),
        createElement('span', { 'data-designer-rollback': 'true' }, createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: props.session.rollback === undefined, title: props.session.rollback === undefined ? 'No rollback receipt is available.' : undefined, onClick: onRollback }, 'Rollback')),
      ),
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

export function WorkspaceDesignerCoreView({ view, registry }: PaneLocalViewProps): ReactNode {
  const [workspace, setWorkspace] = useState(() => createPaneWorkspace())
  const [session, setSession] = useState(() => createDesignerSession(workspace))
  return createElement(Surface, {
    kind: 'workspace',
    className: 'pwr-designer',
    'data-pane-designer': view.id,
    'data-pane-designer-providers': registry === undefined ? 'empty' : 'registry',
  },
    createElement(SurfaceContextBar, { className: 'pwr-designer-header', title: t('designer.title') }),
    createElement('div', { className: 'ys-body' },
      createElement(WorkspaceDesignerInteraction, {
        session,
        workspace,
        registry,
        onChange: setSession,
        onWorkspaceChange: setWorkspace,
      }),
    ),
  )
}
