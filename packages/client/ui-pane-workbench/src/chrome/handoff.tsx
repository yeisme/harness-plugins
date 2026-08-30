import {
  Component,
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { panelVar, type PanelTokenName } from '@yeisme/dsh-client-ui-visual-kit'
import type { ArtifactIntentV1, PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import {
  ARTIFACT_INTENT_DRAG_MIME,
  beginArtifactGesture,
  buildArtifactGestureIntent,
  createArtifactDragPayload,
  isArtifactIntentKind,
  parseArtifactDragPayload,
  type ArtifactHandoffChannelV1,
  type ArtifactHandoffEvidenceV1,
} from '../artifacts.js'
import { ArtifactRefSchema } from '@yeisme/dsh-pane-protocol'
import { PaneArtifactHandoffMenu, type ArtifactHandoffTargetV1 } from '../handoff-menu.js'
import {
  resolvePaneManagementShortcut,
  type PaneConversationSearchHostV1,
  type PaneManagementKeymapV1,
  type PaneWorkspaceContextProviderV1,
} from '../management.js'
import type { PaneDragTargetV1 } from '../interactions.js'
import { PaneResizeSession } from '../interactions.js'
import type { PaneWorkbenchController } from '../controller.js'
import { isPaneCoreViewId, openPaneWorkbenchCoreView, DSH_WORKSPACE_DESIGNER_VIEW_KIND, type PaneCoreViewId } from '../core-pane.js'
import { DSH_EXPLORER_VIEW_KIND, openExplorerNavigator } from '../explorer/provider.js'
import { openSourceControlNavigator } from '../git/provider.js'
import { DSH_SOURCE_CONTROL_VIEW_KIND } from '../git/source-control.js'
import { PaneTabActions, PaneTabStrip } from '../tabs.js'
import { PaneCloseUndoToast, PaneManagementCenter } from '../management-center.js'
import type { PaneManagementMode } from '../management.js'
import type { PaneViewRegistry, PaneViewRegistrationV1 } from '../view-registry.js'
import { WorkbenchIcon } from '../icon.js'
import type { WorkbenchIconName } from '../icon.js'
import { formatT, getLocaleRevision, subscribeLocale, t, tWithFallback } from '../i18n/locale.js'
import {
  applyWorkbenchFontSizeTo,
  getWorkbenchFontSize,
  stepWorkbenchFontSize,
  subscribeWorkbenchFontSize,
  WORKBENCH_FONT_SIZE_MAX,
  WORKBENCH_FONT_SIZE_MIN,
} from '../font-scale.js'
import type {
  PaneGroupV1,
  PaneBulkCloseProtectedViewV1,
  PaneRegionId,
  PaneSplitNodeV1,
  PaneViewInstanceV1,
  PaneWorkspaceV1,
} from '../workspace.js'
export interface PaneArtifactHandoffContextV1 {
  readonly channel: ArtifactHandoffChannelV1
  readonly listTargets: () => readonly ArtifactHandoffTargetV1[]
  readonly getContext: () => PaneContextV1
  /** ArtifactRefV1 candidate exposed by a view; invalid refs fail closed inside the menu. */
  readonly sourceFor: (view: PaneViewInstanceV1) => unknown
  readonly hasAdmission?: (idempotencyKey: string) => boolean
  readonly onDispatch: (intent: ArtifactIntentV1) => unknown
  readonly onEvidence?: (record: ArtifactHandoffEvidenceV1) => void
}

/** Default view → artifact source convention: a provider-approved `metadata.artifactRef` projection. */

export function paneViewArtifactSource(view: PaneViewInstanceV1): unknown {
  return view.metadata?.['artifactRef']
}

function handoffMenuLabels(): Parameters<typeof PaneArtifactHandoffMenu>[0]['labels'] {
  return {
    menuLabel: t('handoff.menu'),
    open: t('handoff.open'),
    compare: t('handoff.compare'),
    attach_context: t('handoff.attachContext'),
    transform: t('handoff.transform'),
    handoff: t('handoff.handoff'),
    link: t('handoff.link'),
    unsupportedIntent: t('handoff.unsupportedIntent'),
    invalidSource: t('handoff.invalidSource'),
  }
}

/**
 * View-menu handoff section: the shared menu plus the HTML5 drag payload
 * binding. One gesture produces the exact same intent shape for click and
 * drag; disabled items never emit a payload.
 */

export function PaneViewHandoffSection(props: {
  readonly view: PaneViewInstanceV1
  readonly handoff: PaneArtifactHandoffContextV1
  readonly onHandled?: () => void
}): ReactNode {
  const { handoff } = props
  const sourceCandidate = handoff.sourceFor(props.view)
  const gestureRef = useRef<string | undefined>(undefined)
  if (gestureRef.current === undefined) gestureRef.current = beginArtifactGesture()
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    for (const item of rootRef.current?.querySelectorAll<HTMLElement>('[data-pane-handoff-intent]') ?? []) {
      if (item.getAttribute('draggable') !== 'true') item.setAttribute('draggable', 'true')
    }
  })
  if (sourceCandidate === undefined || sourceCandidate === null) return null
  const onDragStart = (event: DragEvent<HTMLElement>): void => {
    const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-pane-handoff-intent]') : null
    if (item === null || item.getAttribute('aria-disabled') === 'true') return
    const intentKind = item.getAttribute('data-pane-handoff-intent')
    const targetOwner = item.closest('[data-pane-handoff-target]')?.getAttribute('data-pane-handoff-target') ?? undefined
    const source = ArtifactRefSchema.safeParse(sourceCandidate)
    if (!isArtifactIntentKind(intentKind) || !source.success || event.dataTransfer === null) return
    try {
      const intent = buildArtifactGestureIntent({
        gesture: gestureRef.current ?? beginArtifactGesture(),
        intent: intentKind,
        source: source.data,
        ...(targetOwner === undefined ? {} : { targetOwner }),
        context: handoff.getContext(),
      })
      event.dataTransfer.setData(ARTIFACT_INTENT_DRAG_MIME, createArtifactDragPayload(intent))
      event.dataTransfer.effectAllowed = 'copy'
    } catch {
      // an intent that fails contract validation never reaches the data transfer
    }
  }
  return createElement('div', {
    ref: rootRef,
    role: 'group',
    'aria-label': t('handoff.menu'),
    'data-pane-handoff-section': props.view.id,
    onDragStart,
  },
    createElement(PaneArtifactHandoffMenu, {
      source: sourceCandidate,
      context: handoff.getContext(),
      targets: handoff.listTargets(),
      channel: handoff.channel,
      gesture: gestureRef.current,
      labels: handoffMenuLabels(),
      ...(handoff.hasAdmission === undefined ? {} : { hasAdmission: handoff.hasAdmission }),
      onDispatch: intent => {
        handoff.onDispatch(intent)
        props.onHandled?.()
      },
      ...(handoff.onEvidence === undefined ? {} : { onEvidence: handoff.onEvidence }),
    }),
  )
}

/**
 * Drop-side DOM binding for artifact payloads: dragover admits only the
 * handoff MIME; drop parses through the contract gate before dispatch, so an
 * invalid payload never produces a state change or a dispatch.
 */

export function paneArtifactDropHandlers(handoff: PaneArtifactHandoffContextV1): {
  readonly onDragOver: (event: DragEvent<HTMLElement>) => void
  readonly onDrop: (event: DragEvent<HTMLElement>) => void
} {
  return {
    onDragOver: event => {
      if (event.dataTransfer?.types.includes(ARTIFACT_INTENT_DRAG_MIME) === true) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }
    },
    onDrop: event => {
      const raw = event.dataTransfer?.getData(ARTIFACT_INTENT_DRAG_MIME)
      if (typeof raw !== 'string' || raw.length === 0) return
      event.preventDefault()
      const parsed = parseArtifactDragPayload(raw)
      if (!parsed.ok) return
      handoff.onDispatch(parsed.intent)
    },
  }
}
