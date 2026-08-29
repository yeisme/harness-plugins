/**
 * Workspace Capabilities view (workspace-capability-matrix).
 *
 * Renders the restricted capability matrix projection: tier, per-seam probe
 * state, standard reason copy, and symbolic unlock doc anchors. It never shows
 * paths, URLs, tokens, or user content. Unlock clicks and shown disabled
 * reasons are reported through the redacted evidence sink.
 */

import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import type { PaneCommandRegistry } from './composition.js'
import type { PaneWorkbenchController } from './controller.js'
import {
  projectCapabilityMatrix,
  recordCapabilityMatrixEvidence,
  type CapabilityMatrixEvidenceRecordV1,
  type ExperienceTierTrackerV1,
  type WorkspaceCapabilityRowV1,
  type WorkspaceProbeStateV1,
} from './experience-tier.js'
import { t, tWithFallback } from './i18n/locale.js'
import type { PaneLocalViewProps, PaneViewRegistry } from './view-registry.js'

export const WORKSPACE_CAPABILITIES_VIEW_KIND = 'dsh.workspace-capabilities' as const
export const WORKSPACE_CAPABILITIES_RESOURCE_KEY = 'core:dsh.workspace-capabilities' as const
export const WORKSPACE_CAPABILITIES_COMMAND_ID = 'workspace.capabilities' as const

const STATUS_KEY: Readonly<Record<WorkspaceProbeStateV1, string>> = {
  available: 'capabilities.status.available',
  missing: 'capabilities.status.missing',
  contract_mismatch: 'capabilities.status.mismatch',
}

export interface WorkspaceCapabilitiesViewProps {
  readonly tracker: ExperienceTierTrackerV1
  readonly onEvidence?: (record: CapabilityMatrixEvidenceRecordV1) => void
}

function CapabilityRow(props: {
  readonly row: WorkspaceCapabilityRowV1
  readonly onUnlock: (row: WorkspaceCapabilityRowV1) => void
}): ReactNode {
  const { row } = props
  return createElement('li', {
    className: 'ys-row',
    'data-capability-seam': row.seam,
    'data-capability-state': row.state,
  },
    createElement('code', { className: 'pwr-capability-seam' }, row.seam),
    createElement('span', { className: 'pwr-capability-status' }, t(STATUS_KEY[row.state])),
    createElement('span', { className: 'pwr-capability-reason' },
      row.reasonKey === undefined ? null : tWithFallback(row.reasonKey, row.reasonKey)),
    row.state === 'available'
      ? null
      : createElement(Button, {
        type: 'button',
        size: 'sm',
        variant: 'toolbar',
        className: 'pwr-capability-unlock',
        title: `${t('capabilities.unlockAnchor')}: ${row.unlockAnchor}`,
        onClick: () => props.onUnlock(row),
      }, createElement('span', { 'data-capability-unlock': row.seam }, t('capabilities.unlock'))),
  )
}

export function WorkspaceCapabilitiesView(props: WorkspaceCapabilitiesViewProps): ReactNode {
  const [, setRevision] = useState(0)
  useEffect(() => props.tracker.subscribe(() => setRevision(value => value + 1)), [props.tracker])
  const snapshot = props.tracker.getSnapshot()
  const matrix = useMemo(() => projectCapabilityMatrix(snapshot), [snapshot])
  const shownReasons = useRef(new Set<string>())
  const evidenceSink = props.onEvidence
  useEffect(() => {
    if (evidenceSink === undefined) return
    for (const row of matrix.rows) {
      if (row.reasonKey === undefined) continue
      const record = recordCapabilityMatrixEvidence({ kind: 'disabled_reason_shown', seam: row.seam, reason: row.reasonKey })
      if (record === undefined || shownReasons.current.has(record.reasonCategory ?? '')) continue
      shownReasons.current.add(record.reasonCategory ?? '')
      evidenceSink(record)
    }
  }, [matrix, evidenceSink])
  const onUnlock = (row: WorkspaceCapabilityRowV1): void => {
    const record = recordCapabilityMatrixEvidence({ kind: 'unlock_hint_clicked', seam: row.seam })
    if (record !== undefined) evidenceSink?.(record)
  }
  return createElement(Surface, {
    kind: 'inspector',
    className: 'pwr-capabilities',
    'data-capabilities-tier': matrix.tier,
    'aria-label': t('capabilities.title'),
  },
    createElement(SurfaceContextBar, {
      className: 'pwr-capabilities-header',
      title: t('capabilities.title'),
      context: `${t('capabilities.tier')}: ${t(`capabilities.tier.${matrix.tier}`)}`,
      'data-capabilities-tier-label': String(matrix.tier),
    }),
    createElement('div', { className: 'ys-body' },
      createElement(SurfaceSection, null,
        createElement('ul', { className: 'pwr-capabilities-rows ys-list', role: 'list' },
          ...matrix.rows.map(row => createElement(CapabilityRow, { key: row.seam, row, onUnlock })),
        ),
      ),
    ),
  )
}

/** Local component factory binding the session tracker; registered like other Core views. */
export function registerWorkspaceCapabilitiesView(
  registry: PaneViewRegistry,
  tracker: ExperienceTierTrackerV1,
  options?: { readonly onEvidence?: (record: CapabilityMatrixEvidenceRecordV1) => void },
): () => void {
  return registry.registerView({
    descriptor: {
      kind: WORKSPACE_CAPABILITIES_VIEW_KIND,
      label: 'Workspace Capabilities',
      componentKey: 'dsh-workspace-capabilities',
      role: 'inspector',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: true,
    },
    component: (_props: PaneLocalViewProps) => createElement(WorkspaceCapabilitiesView, {
      tracker,
      ...(options?.onEvidence === undefined ? {} : { onEvidence: options.onEvidence }),
    }),
    showInPicker: true,
    i18n: { namespace: 'paneWorkbench', labelKey: 'capabilities.title', descriptionKey: 'capabilities.description' },
  })
}

export function openWorkspaceCapabilitiesView(controller: PaneWorkbenchController): void {
  controller.openView({
    kind: WORKSPACE_CAPABILITIES_VIEW_KIND,
    resourceKey: WORKSPACE_CAPABILITIES_RESOURCE_KEY,
    role: 'inspector',
    preferredRegion: 'right',
    retention: 'recreate',
    singleton: true,
    preview: false,
    pinned: false,
    title: t('capabilities.title'),
  })
}

/**
 * `/workspace` command-surface contribution. The live slash directory picks it
 * up through the existing pane projection; when the command surface seam is
 * absent the pane-side entry points (picker, settings) stay available.
 */
export function registerWorkspaceCapabilitiesCommand(
  commands: PaneCommandRegistry,
  controller: PaneWorkbenchController,
): () => void {
  return commands.register({
    descriptor: {
      id: WORKSPACE_CAPABILITIES_COMMAND_ID,
      label: 'Workspace Capabilities',
      presentation: { launcher: true, group: 'pane' },
      slash: { name: 'workspace', category: 'pane', hint: 'capabilities' },
    },
    execute: () => openWorkspaceCapabilitiesView(controller),
  })
}
