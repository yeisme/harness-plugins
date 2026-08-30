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
  clear = vi.fn()
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
vi.mock('@xterm/addon-serialize', () => ({ SerializeAddon: class { serialize = vi.fn(() => 'buffer-dump'); dispose = vi.fn() } }))

import { TerminalPanel } from '../src/client/terminal-panel.tsx'
import type { TerminalHostV2, TerminalAttachmentV2 } from '@yeisme/dsh-terminal-host'

interface FakeAttachment extends TerminalAttachmentV2 {
  emit(chunk: { terminalId: string; epoch: string; sequence: number; data: string; truncated?: boolean }): void
  emitInput(data: string): void
}

interface LeaseControls {
  state: 'granted' | 'pending' | 'denied'
  listeners: Set<(state: 'granted' | 'pending' | 'denied') => void>
  setState(state: 'granted' | 'pending' | 'denied'): void
}

function fakeHost(terminalId = 't-1', lease?: LeaseControls): { host: TerminalHostV2; attachment: FakeAttachment; attach: ReturnType<typeof vi.fn> } {
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
    ...(lease === undefined ? {} : {
      control: {
        get state() { return lease.state },
        subscribe(listener2: (state: 'granted' | 'pending' | 'denied') => void) { lease.listeners.add(listener2); return () => { lease.listeners.delete(listener2) } },
        requestTakeover: vi.fn(async () => { lease.setState('granted'); return { status: 'ok' as const } }),
      },
    }),
  } as FakeAttachment
  const attach = vi.fn(async () => attachment)
  return { host: { version: '0.2.0-rc.1', capability: 'terminal-host', listTerminals: vi.fn(async () => []), openTerminal: vi.fn(async () => ({ id: terminalId, title: 't' } as never)), closeTerminal: vi.fn(async () => ({ status: 'ok', terminalId } as never)), writeInput: vi.fn(async () => ({ status: 'ok', terminalId } as never)), resizeTerminal: vi.fn(async () => ({ status: 'ok', terminalId } as never)), attachTerminal: attach } as unknown as TerminalHostV2, attachment, attach }
}

function leaseOf(state: 'granted' | 'pending' | 'denied'): LeaseControls {
  const listeners = new Set<(state: 'granted' | 'pending' | 'denied') => void>()
  const lease: LeaseControls = { state, listeners, setState(next) { lease.state = next; listeners.forEach(fn => fn(next)) } }
  return lease
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
    observer.emit(500, 400)
    await new Promise(resolve => setTimeout(resolve, 32))
    // rAF coalescing: a burst of valid entries produced exactly one fit.
    expect(fit.fit).toHaveBeenCalledTimes(1)
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

describe('control-lease input gate (V3 6.4)', () => {
  it('ungranted keypresses are dropped, never buffered or sent', async () => {
    const lease = leaseOf('pending')
    const { host, attachment } = fakeHost('t-1', lease)
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-lease="pending"]')).not.toBeNull() })
    attachment.emitInput('secret\r')
    expect(attachment.writeInput).not.toHaveBeenCalled()
    lease.setState('granted')
    attachment.emitInput('now-ok\r')
    await waitFor(() => { expect(attachment.writeInput).toHaveBeenCalledWith('now-ok\r') })
  })

  it('takeover enables input only after the owner grants', async () => {
    const lease = leaseOf('denied')
    const { host, attachment } = fakeHost('t-1', lease)
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-takeover]')).not.toBeNull() })
    attachment.emitInput('blocked')
    expect(attachment.writeInput).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('[data-terminal-takeover]')!)
    await waitFor(() => { expect(container.querySelector('[data-terminal-lease]')).toBeNull() })
    attachment.emitInput('after-grant')
    await waitFor(() => { expect(attachment.writeInput).toHaveBeenCalledWith('after-grant') })
  })

  it('legacy attachments without a control lease stay ungated', async () => {
    const { host, attachment } = fakeHost('t-1')
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-fit]')).not.toBeNull() })
    expect(container.querySelector('[data-terminal-lease]')).toBeNull()
    attachment.emitInput('legacy')
    await waitFor(() => { expect(attachment.writeInput).toHaveBeenCalledWith('legacy') })
  })
})

describe('terminal toolbar actions (V3 6.2/6.6/6.7)', () => {
  it('Find opens a search box that drives the search addon', async () => {
    const { host } = fakeHost('t-1')
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-find]')).not.toBeNull() })
    fireEvent.click(container.querySelector('[data-terminal-find]')!)
    const input = container.querySelector('[data-terminal-find-input]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'error' } })
    const terminal = terminalInstances[0]!
    const searchAddon = terminal.addons.find(addon => 'findNext' in (addon as object)) as unknown as { findNext: ReturnType<typeof vi.fn>; findPrevious: ReturnType<typeof vi.fn> }
    fireEvent.click(container.querySelector('[data-terminal-find-next]')!)
    expect(searchAddon.findNext).toHaveBeenCalledWith('error')
    fireEvent.click(container.querySelector('[data-terminal-find-prev]')!)
    expect(searchAddon.findPrevious).toHaveBeenCalledWith('error')
  })

  it('Copy serializes the buffer to the clipboard; Clear clears the terminal', async () => {
    const { host } = fakeHost('t-1')
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText, readText: vi.fn(async () => '') } })
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-copy]')).not.toBeNull() })
    fireEvent.click(container.querySelector('[data-terminal-copy]')!)
    await waitFor(() => { expect(writeText).toHaveBeenCalledWith('buffer-dump') })
    const terminal = terminalInstances[0]!
    const serializeAddon = terminal.addons.find(addon => 'serialize' in (addon as object)) as unknown as { serialize: () => string }
    expect(serializeAddon.serialize()).toBe('buffer-dump')
    fireEvent.click(container.querySelector('[data-terminal-clear]')!)
    expect((terminal as unknown as { clear: ReturnType<typeof vi.fn> }).clear).toHaveBeenCalled()
  })

  it('Detach only detaches; Kill requires confirmation and the owner close receipt', async () => {
    const { host, attachment } = fakeHost('t-1')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-detach]')).not.toBeNull() })
    fireEvent.click(container.querySelector('[data-terminal-detach]')!)
    expect(attachment.detach).toHaveBeenCalledTimes(1)
    expect((host as unknown as { closeTerminal: ReturnType<typeof vi.fn> }).closeTerminal).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('[data-terminal-kill]')!)
    expect((host as unknown as { closeTerminal: ReturnType<typeof vi.fn> }).closeTerminal).not.toHaveBeenCalled() // confirm refused
    confirmSpy.mockReturnValue(true)
    fireEvent.click(container.querySelector('[data-terminal-kill]')!)
    await waitFor(() => { expect((host as unknown as { closeTerminal: ReturnType<typeof vi.fn> }).closeTerminal).toHaveBeenCalledWith('t-1') })
    confirmSpy.mockRestore()
  })

  it('multiline paste requires explicit confirmation; refused paste never reaches the PTY', async () => {
    const { host, attachment } = fakeHost('t-1')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    Object.assign(navigator, { clipboard: { readText: vi.fn(async () => 'line1\nline2') } })
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1' }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-paste]')).not.toBeNull() })
    fireEvent.click(container.querySelector('[data-terminal-paste]')!)
    await waitFor(() => { expect(confirmSpy).toHaveBeenCalled() })
    expect(attachment.writeInput).not.toHaveBeenCalled()
    confirmSpy.mockReturnValue(true)
    fireEvent.click(container.querySelector('[data-terminal-paste]')!)
    await waitFor(() => { expect(attachment.writeInput).toHaveBeenCalledWith('line1\nline2') })
    confirmSpy.mockRestore()
  })
})

describe('session toolbar actions (V3 6.6 New/Split/Rename)', () => {
  it('New and Split open a fresh PTY session as its own view; empty titles never rename', async () => {
    const { host } = fakeHost('t-1')
    const openSession = vi.fn()
    const rename = vi.fn()
    const opened = (host as unknown as { openTerminal: ReturnType<typeof vi.fn> }).openTerminal
    opened.mockResolvedValue({ terminalId: 'fresh-1', title: 'fresh', running: true } as never)
    const { container } = render(createElement(TerminalPanel, { state: 'connected', host, terminalId: 't-1', onNewSession: () => { void host.openTerminal().then(session => openSession(session.terminalId, session.title)) }, onRename: title => rename(title) }))
    await waitFor(() => { expect(container.querySelector('[data-terminal-new]')).not.toBeNull() })
    fireEvent.click(container.querySelector('[data-terminal-new]')!)
    await waitFor(() => { expect(openSession).toHaveBeenCalledWith('fresh-1', 'fresh') })
    fireEvent.click(container.querySelector('[data-terminal-split]')!)
    await waitFor(() => { expect(opened).toHaveBeenCalledTimes(2) })
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce('  ').mockReturnValueOnce('Renamed' as never)
    fireEvent.click(container.querySelector('[data-terminal-rename]')!)
    expect(rename).not.toHaveBeenCalled() // whitespace-only refused
    fireEvent.click(container.querySelector('[data-terminal-rename]')!)
    expect(rename).toHaveBeenCalledWith('Renamed')
    promptSpy.mockRestore()
  })
})
