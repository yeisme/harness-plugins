import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/client/index.ts'

class Slots {
  rows: Array<{ slot: string; input: Record<string, unknown> }> = []
  inject = (slot: string, factory: () => () => void): (() => void) => factory()
  register = (input: Record<string, unknown>, _component: unknown): (() => void) => { this.rows.push({ slot: String(input.name), input }); return () => undefined }
}

describe('client apply', () => {
  it('registers a bottom Pane view and visible launcher', async () => {
    const slots = new Slots()
    const registerView = vi.fn(() => () => undefined)
    const ctx = { get(key: string) { if (key === 'slots') return slots; if (key === 'paneWorkbench') return { registerView, openView: vi.fn() }; if (key === 'remote') return { devtools: { snapshot: vi.fn(), captureCpuProfile: vi.fn() } }; return undefined } }
    const dispose = apply(ctx as never)
    await Promise.resolve()
    expect(registerView).toHaveBeenCalledWith(expect.objectContaining({ descriptor: expect.objectContaining({ kind: 'workspace.devtools', preferredRegion: 'bottom' }) }))
    expect(slots.rows.some(row => row.input.id === 'devtools-open')).toBe(true)
    expect(slots.rows.some(row => row.slot === 'shell.overlay')).toBe(false)
    dispose()
  })

  it('registers overlay fallback when Pane is missing', () => {
    const slots = new Slots()
    const ctx = { get(key: string) { if (key === 'slots') return slots; if (key === 'remote') return {}; return undefined } }
    const dispose = apply(ctx as never)
    expect(slots.rows.some(row => row.slot === 'shell.overlay')).toBe(true)
    dispose()
  })
})
