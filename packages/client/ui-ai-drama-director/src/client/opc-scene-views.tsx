/**
 * OPC scene package /drama surfaces (opc-scene 2.1-2.5).
 *
 * Exception-first, server-authored surfaces over the DSH-local view model:
 * Now/Why/Next context, the three normal human gates, triggered exception
 * cards, aspect/depth/role semantics, and delivery/handoff details with
 * copyable CLI/API action details. Buttons come only from owner action
 * descriptors, degrade with a visible reason, stay keyboard reachable, and
 * respect reduced-motion preferences. No synthesized actions, no retries.
 *
 * @module @yeisme/dsh-client-ui-ai-drama-director/client
 */

import { createElement, useRef, useState, type ReactNode } from 'react'
import type {
  DramaScenePackageExceptionView,
  OpcSceneExceptionCardV1,
  OpcSceneProjectedActionV1,
} from './opc-scene-view.ts'

const GATE_LABELS: Readonly<Record<string, string>> = {
  direction_confirm: 'Direction',
  visual_foundation_accept: 'Visual foundation',
  export_confirm: 'Export',
}

type ActionHandler = ((action: OpcSceneProjectedActionV1) => void) | undefined
type KeyLike = { readonly key: string; readonly preventDefault: () => void }

export interface OpcSceneSurfaceProps {
  readonly view: DramaScenePackageExceptionView
  /** Submits an enabled owner action; never called for disabled actions. */
  readonly onAction?: ActionHandler
  /** Copy sink for copyable CLI/API details. */
  readonly onCopy?: ((detail: string) => void) | undefined
  /** Reduced-motion preference: skips non-essential transitions. */
  readonly reducedMotion?: boolean | undefined
}

function motionClass(reducedMotion: boolean | undefined): string {
  return reducedMotion === true ? 'dsv-no-motion' : 'dsv-motion'
}

function ActionButton({
  action,
  onAction,
  reducedMotion,
}: {
  readonly action: OpcSceneProjectedActionV1
  readonly onAction?: ActionHandler
  readonly reducedMotion?: boolean | undefined
}): ReactNode {
  return createElement(
    'button',
    {
      type: 'button',
      className: motionClass(reducedMotion),
      'data-action-id': action.actionId,
      'data-side-effect-class': action.sideEffectClass,
      disabled: !action.enabled,
      'aria-disabled': !action.enabled,
      'aria-label': action.requiresConfirmation ? `${action.label} (confirmation required)` : action.label,
      onClick: () => action.enabled && onAction?.(action),
      // Element-scoped keyboard handling mirrors the shared keymap face
      // philosophy: Enter/Space submit only from the focused control.
      onKeyDown: (event: KeyLike) => {
        if (!action.enabled) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onAction?.(action)
        }
      },
    },
    action.label,
    action.enabled ? undefined : createElement('span', { className: 'dsv-reason', 'data-disabled-reason': action.disabledReason }, action.disabledReason),
    action.requiresConfirmation ? createElement('span', { 'data-confirmation': true }, ' confirmation required') : undefined,
  )
}

/** 2.1 — /drama context surface: Now, Why (gates), Next (one action), deep link. */
export function DramaScenePackageContextView({ view, onAction, reducedMotion }: OpcSceneSurfaceProps): ReactNode {
  const blocker = view.exceptionCards.find(card => card.kind !== 'contract_mismatch')
  return createElement(
    'section',
    { 'data-dsv-context': true, className: motionClass(reducedMotion), 'data-state': view.state },
    createElement('h3', {}, 'Now'),
    view.context === undefined
      ? createElement('p', { 'data-dsv-no-context': true }, 'No owner observation yet')
      : createElement(
          'dl',
          { 'data-dsv-now': true },
          ...(['show', 'episode', 'scene', 'stage', 'readiness', 'package'] as const).flatMap(field => {
            const context = view.context!
            const value =
              field === 'show' ? context.showRef
              : field === 'episode' ? context.episodeRef
              : field === 'scene' ? context.sceneRef
              : field === 'stage' ? context.stage
              : field === 'readiness' ? context.readiness
              : `${context.packageRef}@${context.packageVersion}`
            return [createElement('dt', { key: `${field}-k` }, field), createElement('dd', { key: `${field}-v` }, value)]
          }),
        ),
    createElement('h3', {}, 'Why'),
    blocker === undefined
      ? createElement('p', { 'data-dsv-clear': true }, 'No blocker; human gates below')
      : createElement(
          'p',
          { 'data-dsv-blocker': true, 'data-blocker-kind': blocker.kind },
          `${blocker.kind} on ${blocker.affectedRef}@${blocker.packageVersion}: ${blocker.reasonCode}`,
        ),
    view.gates.length === 0
      ? createElement('p', { 'data-dsv-gates-unavailable': true }, 'Gate status unavailable in this state')
      : createElement(
          'ul',
          { 'data-dsv-gates': true },
          ...view.gates.map(gate =>
            createElement('li', { key: gate.id, 'data-gate-id': gate.id, 'data-gate-state': gate.state }, `${GATE_LABELS[gate.id] ?? gate.id}: ${gate.state}`),
          ),
        ),
    createElement('h3', {}, 'Next'),
    view.primaryAction === undefined
      ? createElement('p', { 'data-dsv-no-action': true }, 'No owner action published')
      : createElement(ActionButton, { action: view.primaryAction, onAction, reducedMotion }),
    view.handoff === undefined
      ? undefined
      : createElement('a', { href: '#', 'data-dsv-workbench-deeplink': true, 'aria-label': 'Open Workbench review', onClick: (event: { preventDefault(): void }) => event.preventDefault() }, 'Open in Workbench'),
  )
}

/** 2.3 — Triggered exception cards: reason visible, mutations disabled, no retry. */
export function OpcSceneExceptionCardsView({ view, onAction, reducedMotion }: OpcSceneSurfaceProps): ReactNode {
  if (view.exceptionCards.length === 0) return createElement('p', { 'data-dsv-no-exceptions': true }, 'No triggered exceptions')
  return createElement(
    'ul',
    { 'data-dsv-exceptions': true, className: motionClass(reducedMotion) },
    ...view.exceptionCards.map((card: OpcSceneExceptionCardV1) =>
      createElement(
        'li',
        { key: `${card.kind}:${card.affectedRef}:${card.reasonCode}`, 'data-exception-kind': card.kind, 'data-affected-ref': card.affectedRef, 'data-package-version': card.packageVersion },
        createElement('span', { className: 'dsv-reason', 'data-reason-code': card.reasonCode }, card.reasonCode),
        card.evidenceRefs.length === 0
          ? undefined
          : createElement('ul', { 'data-exception-evidence': true }, ...card.evidenceRefs.map(ref => createElement('li', { key: ref }, ref))),
        card.recoveryAction === undefined
          ? createElement('p', { 'data-dsv-no-recovery': true }, card.reconcileRef === undefined ? 'Owner recovery pending' : `Reconcile only: ${card.reconcileRef}`)
          : createElement(ActionButton, { action: card.recoveryAction, onAction, reducedMotion }),
      ),
    ),
  )
}

/** 2.4 — Aspect facts, reframe variants, and the role-first Skill summary. */
export function OpcSceneReframeView({ view, onAction, reducedMotion }: OpcSceneSurfaceProps): ReactNode {
  return createElement(
    'section',
    { 'data-dsv-reframe': true, className: motionClass(reducedMotion) },
    createElement('p', { 'data-dsv-primary-aspect': true }, view.aspect === undefined ? 'Aspect unavailable' : `Primary aspect ${view.aspect.primary}`),
    view.reframes.length === 0
      ? createElement('p', { 'data-dsv-no-reframes': true }, 'No reframe variants')
      : createElement(
          'ul',
          { 'data-dsv-reframes': true },
          ...view.reframes.map((reframe, index) =>
            createElement(
              'li',
              { key: `${reframe.aspect}:${reframe.depth}:${index}`, 'data-reframe-aspect': reframe.aspect, 'data-reframe-depth': reframe.depth, 'data-reframe-status': reframe.status },
              `${reframe.status} ${reframe.aspect} ${reframe.depth}: ${reframe.reason} (impact ${reframe.impact}, cost ${reframe.costEnvelope})`,
              reframe.requiresUpgradeConfirmation ? createElement('span', { 'data-upgrade-confirmation': true }, ' explicit upgrade confirmation required') : undefined,
              reframe.action === undefined ? undefined : createElement(ActionButton, { action: reframe.action, onAction, reducedMotion }),
            ),
          ),
        ),
    createElement(
      'ul',
      { 'data-dsv-roles': true, 'aria-label': 'Skill roles' },
      ...view.roles.map(role => createElement('li', { key: role.role, 'data-role': role.role }, role.role)),
    ),
    view.rolesDetail.length === 0
      ? undefined
      : createElement(
          'details',
          { 'data-dsv-roles-detail': true },
          createElement('summary', {}, 'Skill identity details'),
          ...view.rolesDetail.map(detail =>
            createElement(
              'p',
              { key: detail.role, 'data-role-detail': detail.role },
              `${detail.role}: ${detail.name ?? 'unnamed'} ${detail.version ?? ''} ${detail.digest ?? ''}`.trim(),
            ),
          ),
        ),
  )
}

/**
 * 2.2/2.5 — Review, evidence, delivery, and handoff details with copyable
 * CLI/API action identity. Focus returns to the toggle when the detail
 * region closes (Escape or toggle); reduced motion skips transitions.
 */
export function OpcSceneDeliveryHandoffView({ view, onCopy, reducedMotion }: OpcSceneSurfaceProps): ReactNode {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const closeAndRefocus = () => {
    setOpen(false)
    toggleRef.current?.focus()
  }
  const copy = (detail: string | undefined) => {
    if (detail !== undefined) onCopy?.(detail)
  }
  const toggleKeyDown = (event: KeyLike): void => {
    if (open && event.key === 'Escape') closeAndRefocus()
  }
  const regionKeyDown = (event: KeyLike): void => {
    if (event.key === 'Escape') closeAndRefocus()
  }
  return createElement(
    'section',
    { 'data-dsv-delivery': true, className: motionClass(reducedMotion) },
    view.delivery === undefined
      ? createElement('p', { 'data-dsv-delivery-unavailable': true }, 'Delivery facts unavailable in this state')
      : createElement(
          'dl',
          { 'data-dsv-delivery-facts': true },
          createElement('dt', { key: 'packaging-k' }, 'packaging'),
          createElement('dd', { key: 'packaging-v', 'data-packaging': view.delivery.packaging }, view.delivery.packaging),
          createElement('dt', { key: 'ready-k' }, 'production_ready'),
          createElement('dd', { key: 'ready-v', 'data-production-ready': String(view.delivery.productionReady) }, String(view.delivery.productionReady)),
          createElement('dt', { key: 'checksum-k' }, 'checksum'),
          createElement('dd', { key: 'checksum-v', 'data-checksum-status': view.delivery.checksumStatus }, view.delivery.checksumStatus),
        ),
    view.deliveryNotes.length === 0
      ? undefined
      : createElement('ul', { 'data-dsv-delivery-notes': true }, ...view.deliveryNotes.map(note => createElement('li', { key: note }, note))),
    view.evidence === undefined
      ? createElement('p', { 'data-dsv-evidence-unavailable': true }, 'Evidence facts unavailable in this state')
      : createElement(
          'p',
          { 'data-dsv-evidence': true, 'data-evidence-digest': view.evidence.digest },
          `evidence digest ${view.evidence.digest} (${view.evidence.refs.length} refs)`,
        ),
    view.receipts.length === 0
      ? undefined
      : createElement(
          'ul',
          { 'data-dsv-receipts': true },
          ...view.receipts.map(receipt =>
            createElement('li', { key: receipt.receiptRef, 'data-receipt-ref': receipt.receiptRef, 'data-receipt-outcome': receipt.outcome }, `${receipt.receiptRef}: ${receipt.outcome}${receipt.reconcileRef === undefined ? '' : ` (reconcile ${receipt.reconcileRef})`}`),
          ),
        ),
    createElement(
      'button',
      {
        type: 'button',
        ref: toggleRef,
        'aria-expanded': open,
        'aria-controls': 'dsv-action-details',
        onClick: () => setOpen(previous => !previous),
        onKeyDown: toggleKeyDown,
      },
      open ? 'Hide action details' : 'Show action details',
    ),
    open
      ? createElement(
          'div',
          { id: 'dsv-action-details', 'data-dsv-action-details': true, onKeyDown: regionKeyDown },
          view.handoff?.cliDetail === undefined
            ? createElement('p', { 'data-dsv-no-cli': true }, 'No CLI detail published')
            : createElement('button', { type: 'button', 'data-copy': 'cli', onClick: () => copy(view.handoff?.cliDetail) }, 'Copy CLI'),
          view.handoff?.apiDetail === undefined
            ? createElement('p', { 'data-dsv-no-api': true }, 'No API detail published')
            : createElement('button', { type: 'button', 'data-copy': 'api', onClick: () => copy(view.handoff?.apiDetail) }, 'Copy API'),
        )
      : undefined,
  )
}
