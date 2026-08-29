import { createElement, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { BrowserPerformanceCollector } from './collector.ts'
import { ControllerBinding, DevtoolsController, OverlayToggle } from './controller.ts'
import { createDevtoolsExport, downloadDevtoolsExport } from './export.ts'
import { DevtoolsPanel } from './panel.tsx'
import { devtoolsRemoteContribution } from './remote-contribution.ts'
import type { DevtoolsRemoteFace } from '../wire.ts'

export const name = 'client-ui-devtools'
export const inject = ['slots'] as const
const IDLE: { readonly status: 'idle' } = Object.freeze({ status: 'idle' })

function object(value: unknown): Record<string, unknown> | undefined { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined }
function optional(ctx: Context, key: string): Record<string, unknown> | undefined {
  try { const value = (ctx as unknown as { get(name: never): unknown }).get(key as never); return object(value) } catch { return object((ctx as unknown as Record<string, unknown>)[key]) }
}
function unwrap(value: unknown): DevtoolsRemoteFace | undefined { const candidate = object(object(value)?.devtools ?? value); return candidate !== undefined && typeof candidate.snapshot === 'function' && typeof candidate.captureCpuProfile === 'function' ? candidate as unknown as DevtoolsRemoteFace : undefined }
export async function resolveDevtoolsRemote(ctx: Context): Promise<DevtoolsRemoteFace | undefined> {
  const remote = optional(ctx, 'remote')
  const direct = unwrap(remote?.devtools)
  if (direct !== undefined) return direct
  if (remote !== undefined && typeof remote.$mount === 'function') {
    try { await (remote.$mount as (contribution: unknown) => Promise<() => Promise<void>>)(devtoolsRemoteContribution) } catch { return undefined }
    return unwrap(optional(ctx, 'remote.devtools'))
  }
  return undefined
}

interface PaneFace { registerView(input: { descriptor: Record<string, unknown>; component: () => ReactNode }): () => void; openView(request: Record<string, unknown>): void }

function DevtoolsSurface({ binding, collector }: { readonly binding: ControllerBinding; readonly collector: BrowserPerformanceCollector }): ReactNode {
  const controller = useSyncExternalStore(binding.subscribe, binding.getSnapshot)
  const state = useSyncExternalStore(controller?.subscribe ?? (() => () => {}), controller?.getSnapshot ?? (() => IDLE))
  const [capturing, setCapturing] = useState(false)
  const [message, setMessage] = useState<string>()
  useEffect(() => { controller?.start(); return () => { controller?.stop() } }, [controller])
  const capture = (): void => { if (controller === undefined) return; setCapturing(true); setMessage(undefined); void controller.captureCpuProfile().then(answer => { setMessage(answer.ok ? `CPU profile captured: ${answer.captureId}` : answer.error.message) }).finally(() => { setCapturing(false) }) }
  const exportData = (): void => { try { const value = createDevtoolsExport(state, collector); downloadDevtoolsExport(value); setMessage('Diagnostics export downloaded.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Export failed') } }
  return createElement(DevtoolsPanel, { state, browserRecords: collector.snapshot(), onCaptureCpu: capture, onExport: exportData, capturing, ...(message === undefined ? {} : { message }) })
}

function Overlay({ binding, collector, toggle }: { readonly binding: ControllerBinding; readonly collector: BrowserPerformanceCollector; readonly toggle: OverlayToggle }): ReactNode {
  const open = useSyncExternalStore(toggle.subscribe, toggle.getSnapshot)
  const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const listener = (event: KeyboardEvent): void => { if (event.key === 'Escape') toggle.setOpen(false) }
    window.addEventListener('keydown', listener)
    return () => { window.removeEventListener('keydown', listener); previousFocus.current?.focus() }
  }, [open, toggle])
  return createElement(Modal, { open, onClose: () => { toggle.setOpen(false) }, title: 'DSH DevTools', closeLabel: 'Close DevTools', headless: true }, createElement(DevtoolsSurface, { binding, collector }))
}

function Launcher({ binding, open }: { readonly binding: ControllerBinding; readonly open: () => void }): ReactNode {
  const controller = useSyncExternalStore(binding.subscribe, binding.getSnapshot)
  const enabled = controller !== undefined
  return createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', disabled: !enabled, title: enabled ? 'Open DevTools' : 'DevTools Host is unavailable', onClick: open }, 'DevTools')
}

export function apply(ctx: Context): () => void {
  const disposers: Array<() => void> = []
  const binding = new ControllerBinding()
  const collector = new BrowserPerformanceCollector()
  const toggle = new OverlayToggle()
  collector.start()
  let disposed = false
  void resolveDevtoolsRemote(ctx).then(remote => { if (!disposed && remote !== undefined) binding.attach(new DevtoolsController(remote)) })
  const slots = optional(ctx, 'slots')
  const pane = optional(ctx, 'paneWorkbench') as unknown as PaneFace | undefined
  const paneUsable = pane !== undefined && typeof pane.registerView === 'function' && typeof pane.openView === 'function'
  if (paneUsable) disposers.push(pane.registerView({ descriptor: { kind: 'workspace.devtools', label: 'DevTools', componentKey: 'devtools-panel', role: 'utility', preferredRegion: 'bottom', retention: 'snapshot', singleton: true, presentation: { group: 'development', owner: 'devtools', keywords: ['logs', 'performance', 'diagnostics'] } }, component: () => createElement(DevtoolsSurface, { binding, collector }) }))
  const ready = (): boolean => binding.getSnapshot() !== undefined
  const open = (): void => { if (!ready()) return; if (paneUsable) pane.openView({ kind: 'workspace.devtools', resourceKey: 'devtools:process', role: 'utility', preferredRegion: 'bottom', retention: 'snapshot', singleton: true, title: 'DevTools' }); else toggle.setOpen(true) }
  if (slots !== undefined && typeof slots.inject === 'function' && typeof slots.register === 'function') {
    const register = (slots.register as (input: Record<string, unknown>, component: (props?: Record<string, unknown>) => ReactNode) => () => void).bind(slots)
    disposers.push((slots.inject as (name: string, factory: () => () => void) => () => void)('conversation.session.header.actions', () => register({ name: 'conversation.session.header.actions', id: 'devtools-open', order: 34 }, () => createElement(Launcher, { binding, open }))))
    if (!paneUsable) disposers.push((slots.inject as (name: string, factory: () => () => void) => () => void)('shell.overlay', () => register({ name: 'shell.overlay', id: 'yeisme.devtools.dialog', order: 92, label: 'DevTools' }, () => createElement(Overlay, { binding, collector, toggle }))))
  }
  return () => { disposed = true; toggle.setOpen(false); binding.dispose(); collector.dispose(); for (const dispose of disposers.reverse()) dispose() }
}

const ClientUiDevtoolsPlugin = { name, inject, apply }
export default ClientUiDevtoolsPlugin

export { BrowserPerformanceCollector } from './collector.ts'
export { ControllerBinding, DevtoolsController, OverlayToggle } from './controller.ts'
export { containsForbiddenExportContent, createDevtoolsExport, downloadDevtoolsExport } from './export.ts'
export { DevtoolsPanel } from './panel.tsx'
export { devtoolsRemoteContribution } from './remote-contribution.ts'
