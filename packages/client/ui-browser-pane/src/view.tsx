import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { BrowserActionDescriptorV1, BrowserActionRequestV1, BrowserAutomationBindingV1, BrowserAutomationProviderV1, BrowserPaneHostV1, BrowserPaneSnapshotV1 } from '@yeisme/dsh-browser-host'
import { validateBrowserViewportLease } from '@yeisme/dsh-browser-host'
import { Surface, SurfaceActionBar, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { buildBrowserUiAction, gateBrowserUiAction, mapBrowserReceipt } from './actions.js'
import { BROWSER_CONTROL_INITIAL, controlLeaseAllowsLocalInput, reduceBrowserControlLease, type BrowserControlLeaseState } from './control-lease.js'
import { defaultBrowserPaneTranslator, type BrowserPaneTranslator } from './locales.js'
import { BROWSER_PANE_INITIAL_STATE, reduceBrowserPane, type BrowserPaneStateV1 } from './reducer.js'
import { browserPaneStyles } from './styles.js'
import type { BrowserViewportInputV1, BrowserViewportTransportV1, ViewportInputModifiersV1 } from './viewport-transport.js'
import { deriveBrowserPaneView } from './view-model.js'

type BrowserPaneHostWithExactReconcile = BrowserPaneHostV1 & { readonly reconcileAction?: (request: { readonly binding: BrowserAutomationBindingV1; readonly actionId: string; readonly idempotencyKey: string }) => Promise<{ readonly actionId: string; readonly idempotencyKey: string; readonly settled: boolean; readonly snapshot: BrowserPaneSnapshotV1 }> }

export interface BrowserPaneViewProps { readonly host: BrowserPaneHostWithExactReconcile | undefined; readonly binding: BrowserAutomationBindingV1 | undefined; readonly transport?: BrowserViewportTransportV1 | undefined; readonly t?: BrowserPaneTranslator | undefined }
export interface BrowserPaneProviderViewProps { readonly provider: BrowserAutomationProviderV1 | undefined; readonly binding: BrowserAutomationBindingV1 | undefined; readonly transport?: BrowserViewportTransportV1 | undefined; readonly t?: BrowserPaneTranslator | undefined }

function bindingIdentity(binding: BrowserAutomationBindingV1 | undefined): string { return binding === undefined ? 'missing' : `${binding.tenantRef}:${binding.workspaceRef}:${binding.principalRef}:${binding.contextRevision}:${binding.sessionRef}` }

export function BrowserPaneProviderView({ provider, binding, transport, t }: BrowserPaneProviderViewProps) {
  const [host, setHost] = useState<BrowserPaneHostV1>()
  useEffect(() => {
    let live = true
    setHost(undefined)
    if (provider === undefined || binding === undefined) return () => { live = false }
    void provider.openSession(binding.sessionRef).then(next => { if (live) setHost(next) }).catch(() => { if (live) setHost(undefined) })
    return () => { live = false }
  }, [binding, provider])
  return <BrowserPaneView host={host} binding={binding} {...(transport === undefined ? {} : { transport })} {...(t === undefined ? {} : { t })} />
}

/** Fenced owner projection: no guessed targets, effects, or leases. */
export function BrowserPaneView({ host, binding, transport, t = defaultBrowserPaneTranslator }: BrowserPaneViewProps) {
  const [state, setState] = useState<BrowserPaneStateV1>(BROWSER_PANE_INITIAL_STATE)
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState<string>()
  const [pending, setPending] = useState<string>()
  const [unknownAction, setUnknownAction] = useState<string>()
  const [confirmed, setConfirmed] = useState<string>()
  const [lease, setLease] = useState<BrowserControlLeaseState>(BROWSER_CONTROL_INITIAL)
  const refreshEpoch = useRef(0)
  const viewportEpoch = useRef(0)
  const bindingEpoch = useRef(0)
  const actionSequence = useRef(0)
  const inFlightAction = useRef<string | undefined>(undefined)
  const unknownActionRef = useRef<string | undefined>(undefined)
  const unknownRequestRef = useRef<BrowserActionRequestV1 | undefined>(undefined)
  const leaseRef = useRef<BrowserControlLeaseState>(lease)
  const video = useRef<HTMLVideoElement>(null)
  const view = deriveBrowserPaneView(state)
  const snapshot = state.snapshot
  const identity = bindingIdentity(binding)
  useEffect(() => { leaseRef.current = lease }, [lease])
  useEffect(() => {
    if (lease.holder !== 'human') return
    const delay = Math.min(2_147_483_647, Math.max(0, Date.parse(lease.expiresAt) - Date.now()))
    const timer = window.setTimeout(() => setLease(current => reduceBrowserControlLease(current, { type: 'takeover_expired' })), delay)
    return () => window.clearTimeout(timer)
  }, [lease])

  const refresh = async (reconcile = false): Promise<void> => {
    const request = ++refreshEpoch.current
    const requestIdentity = identity
    if (host === undefined || binding === undefined) { setState(current => reduceBrowserPane(current, { type: 'provider_unavailable', reason: 'needs_contract' })); return }
    try {
      const probe = await host.probe()
      if (request !== refreshEpoch.current || requestIdentity !== bindingIdentity(binding)) return
      if (!probe.available) { setMessage(probe.reason ?? t('ownerUnavailable')); setState(current => reduceBrowserPane(current, { type: 'provider_unavailable', reason: 'unavailable' })); return }
      const next = reconcile ? await host.reconcile(binding) : await host.snapshot(binding)
      if (request !== refreshEpoch.current || requestIdentity !== bindingIdentity(binding)) return
      setState(current => reduceBrowserPane(current, { type: reconcile ? 'reconciled' : 'snapshot', snapshot: next }))
      setMessage(next.safeMessage)
      if (next.controlHolder !== 'human') setLease(current => reduceBrowserControlLease(current, { type: 'owner_changed', holder: next.controlHolder }))
    } catch {
      if (request === refreshEpoch.current) { setMessage(t('projectionInvalid')); setState(current => reduceBrowserPane(current, { type: 'provider_unavailable', reason: 'unavailable' })) }
    }
  }

  useEffect(() => {
    refreshEpoch.current += 1
    viewportEpoch.current += 1
    bindingEpoch.current += 1
    setState(BROWSER_PANE_INITIAL_STATE)
    setDraft(''); setMessage(undefined); setPending(undefined); setConfirmed(undefined); setUnknownAction(undefined)
    inFlightAction.current = undefined; unknownActionRef.current = undefined; unknownRequestRef.current = undefined
    setLease(BROWSER_CONTROL_INITIAL)
    transport?.detach()
    void refresh()
    return () => { refreshEpoch.current += 1; viewportEpoch.current += 1; bindingEpoch.current += 1; transport?.detach() }
  }, [host, identity, transport])

  useEffect(() => {
    const request = ++viewportEpoch.current
    if (host === undefined || binding === undefined || transport === undefined || view.viewportPageRef === undefined || host.viewportLease === undefined || snapshot === undefined) return
    let cleaned = false
    const pageRef = view.viewportPageRef
    transport.events.onEnded(() => { if (request === viewportEpoch.current) { setMessage(t('viewportEnded')); transport.detach(); setLease(current => reduceBrowserControlLease(current, { type: 'invalidated' })) } })
    transport.events.onStalled(() => { if (request === viewportEpoch.current) { setMessage(t('viewportStalled')); transport.detach(); setLease(current => reduceBrowserControlLease(current, { type: 'invalidated' })) } })
    void host.viewportLease(binding, pageRef).then(async raw => {
      if (request !== viewportEpoch.current || cleaned) return
      const granted = validateBrowserViewportLease(raw, binding, snapshot.generation, pageRef)
      if (granted === undefined) { setMessage(t('viewportInvalid')); return }
      const stream = await transport.attach(granted)
      if (request !== viewportEpoch.current || cleaned) { stream?.getTracks().forEach(track => track.stop()); transport.detach(); return }
      if (stream !== undefined && video.current !== null) video.current.srcObject = stream
    }).catch(() => { if (request === viewportEpoch.current && !cleaned) setMessage(t('viewportAttachFailed')) })
    const Observer = globalThis.ResizeObserver
    const observer = Observer === undefined || video.current === null ? undefined : new Observer(entries => {
      const box = entries[0]?.contentRect
      if (box !== undefined && controlLeaseAllowsLocalInput(leaseRef.current)) transport.resize({ width: Math.max(1, Math.round(box.width)), height: Math.max(1, Math.round(box.height)) })
    })
    if (video.current !== null) observer?.observe(video.current)
    return () => { cleaned = true; viewportEpoch.current += 1; observer?.disconnect(); transport.detach() }
  }, [binding, host, snapshot, t, transport, view.viewportPageRef])

  useEffect(() => { setConfirmed(undefined) }, [snapshot?.generation, view.viewportPageRef])

  const reconcileUnknown = async (): Promise<void> => {
    const request = unknownRequestRef.current
    if (host?.reconcileAction === undefined || request === undefined) { setMessage(t('actionUnknown')); return }
    const epoch = bindingEpoch.current
    const result = await host.reconcileAction({ binding: request.binding, actionId: request.actionId, idempotencyKey: request.idempotencyKey }).catch(() => undefined)
    if (epoch !== bindingEpoch.current || result === undefined || result.actionId !== request.actionId || result.idempotencyKey !== request.idempotencyKey) return
    setState(current => reduceBrowserPane(current, { type: 'reconciled', snapshot: result.snapshot }))
    setMessage(result.snapshot.safeMessage)
    if (result.settled) { unknownActionRef.current = undefined; unknownRequestRef.current = undefined; setUnknownAction(undefined); setConfirmed(undefined) }
  }

  const dispatch = async (descriptor: BrowserActionDescriptorV1): Promise<void> => {
    if (host === undefined || binding === undefined || inFlightAction.current !== undefined || unknownActionRef.current !== undefined) return
    const gated = gateBrowserUiAction(descriptor, view.navigation.canReload)
    if (!gated.enabled) { setMessage(gated.reason ?? t('actionUnavailable')); return }
    const confirmationIdentity = `${snapshot?.generation ?? 0}:${view.viewportPageRef ?? 'none'}:${descriptor.actionId}`
    if (descriptor.requiresConfirmation !== 'none' && confirmed !== confirmationIdentity) { setConfirmed(confirmationIdentity); setMessage(t(descriptor.requiresConfirmation === 'approval' ? 'reviewApproval' : 'reviewConfirm')); return }
    inFlightAction.current = descriptor.actionId
    setPending(descriptor.actionId)
    if (descriptor.kind === 'take_control') setLease(current => reduceBrowserControlLease(current, { type: 'takeover_requested' }))
    actionSequence.current += 1
    const requestEpoch = bindingEpoch.current
    const actionRequest = buildBrowserUiAction({ actionId: descriptor.actionId, binding, pageRef: view.viewportPageRef, ...(descriptor.kind === 'navigate' ? { navigationDraft: draft } : {}), idempotencySeed: actionSequence.current })
    try {
      const receipt = await host.dispatch(actionRequest)
      if (requestEpoch !== bindingEpoch.current) return
      const outcome = mapBrowserReceipt(receipt)
      setMessage(outcome.kind === 'submitted' ? t('ownerReceipt', { receipt: outcome.receiptRef }) : outcome.kind === 'unknown' ? t('reconcileRequired', { reason: outcome.reasonCode ?? 'unknown' }) : outcome.kind === 'needs_confirm' ? t('ownerRequiresConfirmation') : outcome.reasonCode)
      if (descriptor.kind === 'take_control') {
        if (outcome.kind === 'submitted' && receipt.controlLease !== undefined) setLease(current => reduceBrowserControlLease(current, { type: 'takeover_granted', expiresAt: receipt.controlLease!.expiresAt }))
        else setLease(current => reduceBrowserControlLease(current, { type: 'takeover_denied', reason: receipt.reasonCode ?? 'lease_not_granted' }))
      }
      if (descriptor.kind === 'release_control' && outcome.kind === 'submitted') setLease(current => reduceBrowserControlLease(current, { type: 'release_confirmed' }))
      if (outcome.kind === 'unknown') { unknownActionRef.current = descriptor.actionId; unknownRequestRef.current = actionRequest; setUnknownAction(descriptor.actionId); setState(current => reduceBrowserPane(current, { type: 'invalidate' })); await reconcileUnknown() }
      else await refresh()
    } catch {
      if (requestEpoch === bindingEpoch.current) { unknownActionRef.current = descriptor.actionId; unknownRequestRef.current = actionRequest; setUnknownAction(descriptor.actionId); setMessage(t('actionUnknown')); setState(current => reduceBrowserPane(current, { type: 'invalidate' })) }
    } finally {
      if (requestEpoch === bindingEpoch.current) { inFlightAction.current = undefined; setPending(undefined) }
    }
  }
  const modifiers = (event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): ViewportInputModifiersV1 => ({ alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey })
  const sendInput = (input: BrowserViewportInputV1): void => {
    const ack = transport?.sendInput(input, controlLeaseAllowsLocalInput(leaseRef.current))
    if (ack !== undefined && !ack.accepted) setMessage(t('viewportInputRejected', { reason: ack.reason }))
  }
  const sendPointer = (event: PointerEvent<HTMLVideoElement>, phase: 'down' | 'move' | 'up'): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const round = (value: number): number => Math.round(Math.min(1, Math.max(0, value)) * 1_000_000) / 1_000_000
    sendInput({ type: 'pointer', phase, x: round((event.clientX - rect.left) / rect.width), y: round((event.clientY - rect.top) / rect.height), button: event.button, buttons: event.buttons, modifiers: modifiers(event) })
  }
  const sendKey = (event: KeyboardEvent<HTMLVideoElement>, phase: 'down' | 'up'): void => sendInput({ type: 'key', phase, key: event.key, code: event.code, repeat: event.repeat, modifiers: modifiers(event) })

  if (snapshot === undefined || !view.navigation.safeLocation) return <Surface kind="workspace" data-dsh-browser-pane><style>{browserPaneStyles}</style><SurfaceContextBar title={t('title')} /><SurfaceState phase="disabled" title={message ?? t('bindingRequired')} description={t('noGuess')} action={<Button type="button" size="sm" variant="toolbar" onClick={() => unknownActionRef.current === undefined ? void refresh(true) : void reconcileUnknown()}>{t('reconnect')}</Button>} /></Surface>
  const environment = snapshot.environment
  return <Surface kind="workspace" data-dsh-browser-pane data-browser-phase={view.phase}>
    <style>{browserPaneStyles}</style>
    <SurfaceContextBar title={environment?.name ?? t('title')} context={environment === undefined ? t('environmentUnavailable') : `${environment.workspaceRef} · ${environment.status} · ${environment.identity}`} description={message ?? snapshot.safeMessage} actions={<Button type="button" size="sm" variant="toolbar" onClick={() => unknownActionRef.current === undefined ? void refresh(view.phase === 'reconciling') : void reconcileUnknown()}>{t('reconnect')}</Button>} />
    <nav className="bp-tabs" aria-label={t('pages')}>{view.tabs.map(tab => <Button key={tab.pageRef} type="button" size="sm" variant={tab.active ? 'primary' : 'toolbar'} onClick={() => setState(current => reduceBrowserPane(current, { type: 'switch_page', pageRef: tab.pageRef }))}>{tab.title} · {tab.status}</Button>)}</nav>
    <p className="bp-location" data-browser-safe-location>{view.navigation.safeLocation.protocol}//{view.navigation.safeLocation.host}</p>
    <label className="bp-field ys-field"><span>{t('navigationDraft')}</span><input value={draft} onChange={event => setDraft(event.currentTarget.value)} disabled={!view.navigation.canReload} /></label>
    <SurfaceActionBar className="bp-actions">{(snapshot.actions ?? []).map(descriptor => {
      const gated = gateBrowserUiAction(descriptor, view.navigation.canReload)
      const confirmationIdentity = `${snapshot.generation}:${view.viewportPageRef ?? 'none'}:${descriptor.actionId}`
      const label = pending === descriptor.actionId ? t('working') : confirmed === confirmationIdentity ? t(descriptor.requiresConfirmation === 'approval' ? 'approve' : 'confirm', { label: descriptor.label }) : descriptor.label
      return <Button key={descriptor.actionId} type="button" size="sm" variant="toolbar" disabled={!gated.enabled || pending !== undefined || unknownAction !== undefined} title={unknownAction === undefined ? gated.reason : t('actionUnknown')} onClick={() => void dispatch(descriptor)}>{label}</Button>
    })}</SurfaceActionBar>
    {transport === undefined || host === undefined || host.viewportLease === undefined ? <SurfaceState phase="disabled" title={t('viewportUnavailable')} description={t('viewportUnavailableDescription')} /> : <div className="bp-viewport-shell"><video ref={video} autoPlay muted playsInline tabIndex={0} aria-label={t('ownerViewport')} data-browser-viewport onPointerDown={event => sendPointer(event, 'down')} onPointerMove={event => { if (event.buttons !== 0) sendPointer(event, 'move') }} onPointerUp={event => sendPointer(event, 'up')} onKeyDown={event => sendKey(event, 'down')} onKeyUp={event => sendKey(event, 'up')} /></div>}
    <p className="bp-status" role="status">{t('control', { holder: lease.holder })}. {t('identity')}</p>
  </Surface>
}
