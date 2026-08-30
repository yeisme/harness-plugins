// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'

type Listener = (payload: never) => void

const terminalInstances: Array<MockTerminal> = []

class MockTerminal {
  written: string[] = []
  disposed = false
  dataListeners = new Set<(data: string) => void>()
  resizeListeners = new Set<(size: { cols: number; rows: number }) => void>()
  addons: Array<{ dispose(): void }> = []
  unicode = { activeVersion: '6' as string }
  open = vi.fn()
  dispose = vi.fn(() => { this.disposed = true })
  write = vi.fn((data: string) => { this.written.push(data) })
  loadAddon = vi.fn((addon: { dispose(): void }) => { this.addons.push(addon) })
  onData = vi.fn((listener: (data: string) => void) => {
    this.dataListeners.add(listener)
    return { dispose: () => { this.dataListeners.delete(listener) } }
  })
  onResize = vi.fn((listener: (size: { cols: number; rows: number }) => void) => {
    this.resizeListeners.add(listener)
    return { dispose: () => { this.resizeListeners.delete(listener) } }
  })
}

vi.mock('@xterm/xterm', () => ({ Terminal: vi.fn(() => { const t = new MockTerminal(); terminalInstances.push(t); return t }) }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit = vi.fn(); dispose = vi.fn() } }))
vi.mock('@xterm/addon-search', () => ({ SearchAddon: class { findNext = vi.fn(() => true); findPrevious = vi.fn(() => true); dispose = vi.fn() } }))
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: class { constructor(_cb: unknown) {}; dispose = vi.fn() } }))
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: class { activate = vi.fn(); dispose = vi.fn() } }))
vi.mock('@xterm/addon-webgl', () => ({ WebglAddon: class { onContextLoss = vi.fn(); dispose = vi.fn() } }))

import { TerminalPanel } from '../src/client/terminal-panel.tsx'
import type { TerminalHostV2, TerminalAttachmentV2 } from '@yeisme/dsh-terminal-host'

interface FakeAttachment extends TerminalAttachmentV2 {
  emit(chunk: { terminalId: string; epoch: string; sequence: number; data: string; truncated?: boolean }): void
  emitInput(data: string): void
}

function fakeHost(terminalId = 't-1'): { host: TerminalHostV2; attachment: FakeAttachment; attach: ReturnType<typeof vi.fn> } {
  let listener: ((chunk: { terminalId: string; epoch: string; sequence: number; data: string; truncated?: boolean }) => void) | undefined
  const attachment: FakeAttachment = {
    terminalId,
    epoch: 'e1',
    subscribe(next: never) { listener = next as typeof listener; return () => { listener = undefined } },
    emit(chunk) { listener?.(chunk) },
    emitInput(data) { terminalInstances.at(-1)!.dataListeners.forEach(fn => fn(data)) },
    writeInput: vi.fn(async () => ({ status: 'ok' as const, terminalId })),
    resize: vi.fn(async () => ({ status: 'ok' as const, terminalId })),
    detach: vi.fn(async () => {}),
  } as FakeAttachment
  const attach = vi.fn(async () => attachment)
  return { host: { version: '0.2.0-rc.1', capability: 'terminal-host', listTerminals: vi.fn(async () => []), openTerminal: vi.fn(async () => ({ id: terminalId, title: 't' } as never)), closeTerminal: vi.fn(async () => ({ status: 'ok', terminalId } as never)), writeInput: vi.fn(async () => ({ status: 'ok', terminalId } as never)), resizeTerminal: vi.fn(async () => ({ status: 'ok', terminalId } as never)), attachTerminal: attach } as unknown as TerminalHostV2, attachment, attach }
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) { this.callback = callback; MockResizeObserver.instances.push(this) }
  observe = vi.fn()
  disconnect = vi.fn()
  emit(width: number, height: number): void { this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver) }
}

beforeEach(() => {
  terminalInstances.length = 0
  MockResizeObserver.instances.length = 0
  vi.stubGlobal('ResizeObserver', MockResizeObserver as unknown as typeof ResizeObserver)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const connected: never = { host: undefined, terminalId: undefined } as never

describe('TerminalPanel honest fallback (V3 6.1)', () => {
  it('renders compatibility state without any xterm surface when no host seam exists', () => {
    const { container } = render(createElement(TerminalPanel, { state: 'connected' }))
    expect(container.querySelector('[data-terminal-compatibility]')).not.toBeNull()
    expect(container.querySelector('[data-terminal-surface]')).toBeNull()
    expect(terminalInstances).toHaveLength(0)
  })

  it('exited terminals never attach', () => {
    const { host } = fakeHost()
    const { container } = render(createElement(TerminalPanel, { state: 'exited', host, terminalId: 't-1' }))
    expect(container.querySelector('[data-terminal-compatibility]')).not.toBeNull()
    expect(terminalInstances).toHaveLength(0)
  })
})

describe('InteractiveTerminal lifecycle (V3 6.1/6.3/6.5)', () => {
  it('creates exactly one xterm and one attachment per resource; output writes to the queue in order', async () => {
    const { host, attachment, attach } = fakeHost('t-1')
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-fit]')).not.toBeNull() })
    expect(attach).toHaveBeenCalledTimes(1)
    expect(terminalInstances).toHaveLength(1)
    const terminal = terminalInstances[0]!
    attachment.emit({ terminalId: 't-1', epoch: 'e1', sequence: 1, data: 'hello ' })
    attachment.emit({ terminalId: 't-1', epoch: 'e1', sequence: 2, data: 'world' })
    expect(terminal.written.join('')).toBe('hello world')
  })

  it('stale epochs and replayed sequences never reach the queue (generation fence)', async () => {
    const { host, attachment } = fakeHost('t-1')
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-fit]')).not.toBeNull() })
    const terminal = terminalInstances[0]!
    attachment.emit({ terminalId: 't-1', epoch: 'e1', sequence: 5, data: 'latest' })
    attachment.emit({ terminalId: 't-1', epoch: 'e0', sequence: 6, data: 'STALE' })
    attachment.emit({ terminalId: 't-1', epoch: 'e1', sequence: 4, data: 'REPLAY' })
    expect(terminal.written.join('')).toBe('latest')
  })

  it('sequence gaps and truncation surface explicit resync notices, not silent data', async () => {
    const { host, attachment } = fakeHost('t-1')
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-fit]')).not.toBeNull() })
    const terminal = terminalInstances[0]!
    attachment.emit({ terminalId: 't-1', epoch: 'e1', sequence: 2, data: 'b' })
    attachment.emit({ terminalId: 't-1', epoch: 'e1', sequence: 9, data: 'c', truncated: true })
    const out = terminal.written.join('')
    expect(out).toContain('[output gap; reconnect to resync]')
    expect(out).toContain('[output truncated; reconnect to resync]')
    expect(out).toContain('b')
    expect(out).toContain('c')
    expect(out.indexOf('b')).toBeLessThan(out.indexOf('[output gap'))
  })

  it('forwards input through the attachment and resizes the PTY on terminal resize', async () => {
    const { host, attachment } = fakeHost('t-1')
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-fit]')).not.toBeNull() })
    const terminal = terminalInstances[0]!
    attachment.emitInput('ls -la\r')
    expect(attachment.writeInput).toHaveBeenCalledWith('ls -la\r')
    terminal.resizeListeners.forEach(fn => fn({ cols: 120, rows: 40 }))
    expect(attachment.resize).toHaveBeenCalledWith(120, 40)
  })

  it('ResizeObserver guards hidden/zero-size surfaces and fits otherwise', async () => {
    const { host } = fakeHost('t-1')
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(MockResizeObserver.instances.length).toBeGreaterThan(0) })
    const observer = MockResizeObserver.instances.at(-1)!
    const terminal = terminalInstances[0]!
    const fit = terminal.addons[0] as unknown as { fit: ReturnType<typeof vi.fn> }
    fit.fit.mockClear()
    observer.emit(0, 0)
    observer.emit(40, 30)
    expect(fit.fit).not.toHaveBeenCalled()
    observer.emit(400, 300)
    expect(fit.fit).toHaveBeenCalled()
    expect(container.querySelector('[data-terminal-surface]')).not.toBeNull()
  })

  it('unmount detaches symmetrically without killing the PTY', async () => {
    const { host, attachment } = fakeHost('t-1')
    const view = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(view.container.querySelector('[data-terminal-fit]')).not.toBeNull() })
    const terminal = terminalInstances[0]!
    view.unmount()
    expect(terminal.dispose).toHaveBeenCalled()
    expect(attachment.detach).toHaveBeenCalledTimes(1)
    expect((host as unknown as { closeTerminal: ReturnType<typeof vi.fn> }).closeTerminal).not.toHaveBeenCalled()
  })

  it('attach failures surface an error with a retry that re-attaches', async () => {
    const { host, attach } = fakeHost('t-9')
    let fail = true
    attach.mockImplementation(async () => { if (fail) throw new Error('seam offline'); return fakeHost('t-9').attachment })
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-9' }))
    await waitFor(() => { expect(container.querySelector('.dt-error')?.textContent).toContain('seam offline') })
    expect(container.querySelector('[data-terminal-surface]')).not.toBeNull()
    fail = false
    fireEvent.click(container.querySelector('[data-terminal-reconnect]')!)
    await waitFor(() => { expect(attach).toHaveBeenCalledTimes(2) })
    await waitFor(() => { expect(container.querySelector('[data-terminal-fit]')).not.toBeNull() })
  })
})
