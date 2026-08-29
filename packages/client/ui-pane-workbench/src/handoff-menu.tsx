/**
 * Cross-module artifact handoff menu.
 *
 * Menu items and drag payloads build the exact same ArtifactIntentV1 shape for
 * one gesture (stable idempotency key via `buildArtifactGestureIntent`), and
 * every entry stays usable on both the official seam channel and the local
 * contract path — no dead buttons. Source refs that fail validation disable
 * the entries with a visible reason instead of throwing.
 */

import { createElement, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { ArtifactRefSchema, type ArtifactIntentV1, type ArtifactRefV1, type PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import {
  beginArtifactGesture,
  buildArtifactGestureIntent,
  isArtifactIntentKind,
  recordArtifactHandoffEvidence,
  type ArtifactHandoffChannelV1,
  type ArtifactHandoffEvidenceKindV1,
  type ArtifactHandoffEvidenceV1,
} from './artifacts.js'

export interface ArtifactHandoffTargetV1 {
  readonly owner: string
  readonly label: string
  readonly paneKind?: string
  readonly intents: readonly ArtifactIntentV1['intent'][]
  /** Standard reason shown when this target is fail-closed (module uninstalled, admission denied, ...). */
  readonly disabledReason?: string
}

export interface ArtifactHandoffMenuLabels {
  readonly menuLabel: string
  readonly open: string
  readonly compare: string
  readonly attach_context: string
  readonly transform: string
  readonly handoff: string
  readonly link: string
  readonly unsupportedIntent: string
  readonly invalidSource: string
}

export const DEFAULT_ARTIFACT_HANDOFF_MENU_LABELS: ArtifactHandoffMenuLabels = Object.freeze({
  menuLabel: 'Artifact handoff',
  open: 'Open',
  compare: 'Compare',
  attach_context: 'Attach as context',
  transform: 'Transform',
  handoff: 'Hand off',
  link: 'Link',
  unsupportedIntent: 'This action is not supported by the artifact handoff contract.',
  invalidSource: 'This artifact reference failed validation; handoff entries are disabled.',
})

export interface PaneArtifactHandoffMenuProps {
  /** ArtifactRefV1 candidate; validated internally, invalid refs fail closed. */
  readonly source: unknown
  readonly context: PaneContextV1
  readonly targets: readonly ArtifactHandoffTargetV1[]
  readonly channel: ArtifactHandoffChannelV1
  /** Stable gesture token shared with the drag path; defaults to one token per mounted menu. */
  readonly gesture?: string
  readonly labels?: Partial<ArtifactHandoffMenuLabels>
  /** Target-side dedup probe, usually `dispatcher.hasAdmission`; used for duplicate evidence. */
  readonly hasAdmission?: (idempotencyKey: string) => boolean
  readonly onDispatch: (intent: ArtifactIntentV1) => unknown
  readonly onEvidence?: (record: ArtifactHandoffEvidenceV1) => void
}

interface ResolvedItemV1 {
  readonly key: string
  readonly intent: ArtifactIntentV1['intent'] | undefined
  readonly label: string
  readonly disabledReason: string | undefined
}

function resolveItems(target: ArtifactHandoffTargetV1, labels: ArtifactHandoffMenuLabels, source: ArtifactRefV1 | undefined): readonly ResolvedItemV1[] {
  return target.intents.map((raw, index) => {
    const intent = isArtifactIntentKind(raw) ? raw : undefined
    const label = intent === undefined ? String(raw).slice(0, 32) : labels[intent]
    const disabledReason = source === undefined
      ? labels.invalidSource
      : target.disabledReason ?? (intent === undefined ? labels.unsupportedIntent : undefined)
    return { key: `${target.owner}:${String(raw)}:${index}`, intent, label, disabledReason }
  })
}

export function PaneArtifactHandoffMenu(props: PaneArtifactHandoffMenuProps): ReactNode {
  const { source, context, targets, channel, hasAdmission, onDispatch, onEvidence } = props
  const labels = useMemo<ArtifactHandoffMenuLabels>(() => ({ ...DEFAULT_ARTIFACT_HANDOFF_MENU_LABELS, ...props.labels }), [props.labels])
  const gestureRef = useRef<string | undefined>(undefined)
  if (gestureRef.current === undefined) gestureRef.current = beginArtifactGesture()
  const gesture = props.gesture ?? gestureRef.current

  const sourceRef = useMemo(() => {
    const parsed = ArtifactRefSchema.safeParse(source)
    return parsed.success ? parsed.data : undefined
  }, [source])

  const emit = (kind: ArtifactHandoffEvidenceKindV1, reasonCategory?: string): void => {
    if (onEvidence === undefined) return
    const record = recordArtifactHandoffEvidence({ kind, channel, ...(reasonCategory === undefined ? {} : { reasonCategory }) })
    if (record === undefined) return
    try {
      onEvidence(record)
    } catch {
      // evidence recording must not block the menu
    }
  }
  const emitRef = useRef(emit)
  emitRef.current = emit
  useEffect(() => {
    emitRef.current('channel_resolved')
  }, [channel])

  const handleClick = (target: ArtifactHandoffTargetV1, item: ResolvedItemV1): void => {
    if (sourceRef === undefined || item.intent === undefined || item.disabledReason !== undefined) return
    try {
      const intent = buildArtifactGestureIntent({
        gesture,
        intent: item.intent,
        source: sourceRef,
        targetOwner: target.owner,
        ...(target.paneKind === undefined ? {} : { targetPaneKind: target.paneKind }),
        context,
      })
      if (hasAdmission?.(intent.idempotencyKey) === true) emit('intent_duplicate')
      onDispatch(intent)
    } catch {
      emit('intent_rejected', 'contract_mismatch')
    }
  }

  return createElement(Surface, {
    kind: 'micro',
    className: 'pwr-handoff-menu',
    'data-pane-handoff-menu': true,
    'data-pane-handoff-channel': channel,
  },
    createElement('div', { className: 'ys-body ys-list', role: 'menu', 'aria-label': labels.menuLabel },
    sourceRef === undefined
      ? createElement('p', { role: 'note', 'data-pane-handoff-reason': 'artifact_ref_invalid' }, labels.invalidSource)
      : null,
    ...targets.map(target => createElement('div', {
      key: target.owner,
      role: 'group',
      'aria-label': target.label,
      'data-pane-handoff-target': target.owner,
      className: 'ys-list',
    },
      createElement('span', { 'data-pane-handoff-target-label': true }, target.label),
      ...resolveItems(target, labels, sourceRef).map(item => createElement(Button, {
        ...{ 'data-pane-handoff-intent': item.intent ?? 'unknown' },
        key: item.key,
        type: 'button',
        size: 'sm',
        variant: 'toolbar',
        role: 'menuitem',
        disabled: item.disabledReason !== undefined,
        'aria-disabled': item.disabledReason !== undefined,
        title: item.disabledReason,
        onClick: item.disabledReason === undefined ? () => handleClick(target, item) : undefined,
      }, item.label)),
    )),
    ),
  )
}
