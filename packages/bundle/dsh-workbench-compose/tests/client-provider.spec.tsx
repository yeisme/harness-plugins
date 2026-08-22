// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'

afterEach(cleanup)

function fakeContext(withPane = true): ClientContext {
  const register = vi.fn(() => vi.fn())
  const slots = {
    inject: vi.fn((_name: string, setup: () => () => void) => setup()),
    register,
  }
  const paneWorkbench = withPane ? {
    registerView: vi.fn(() => vi.fn()),
    openView: vi.fn(),
  } : undefined
  const workspaces = {
    listDirectory: vi.fn(async () => ({ path: '.', entries: [] })),
  }
  return {
    slots,
    get: vi.fn((name: string) => name === 'slots' ? slots : name === 'paneWorkbench' ? paneWorkbench : name === 'workspaces' ? workspaces : undefined),
  } as unknown as ClientContext
}

describe('dsh-workbench-compose client provider', () => {
  it('depends on Pane Workbench and does not register a sidebar workbench', () => {
    expect(inject).toEqual(['slots', 'workspaces', 'paneWorkbench'])
  })

  it('registers file.tree and opens it in the right workspace', async () => {
    const ctx = fakeContext()
    const dispose = await apply(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as {
      registerView: ReturnType<typeof vi.fn>
      openView: ReturnType<typeof vi.fn>
    }
    expect(pane.registerView).toHaveBeenCalledWith(expect.objectContaining({
      descriptor: expect.objectContaining({ kind: 'file.tree', preferredRegion: 'right' }),
    }))
    expect(ctx.slots.inject).not.toHaveBeenCalledWith('sidebar.footer.action', expect.any(Function))

    const registration = (ctx.slots.register as ReturnType<typeof vi.fn>).mock.calls.find(call => call[0].id === 'dsh-file-tree-open')
    const renderAction = registration?.[1] as () => ReactNode
    render(createElement(renderAction))
    fireEvent.click(screen.getByRole('button', { name: 'File Tree' }))
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'file.tree', preferredRegion: 'right' }))
    expect(typeof dispose).toBe('function')
  })

  it('reports an explicit compatibility error instead of mounting the old sidebar', async () => {
    await expect(apply(fakeContext(false))).rejects.toThrow(/Pane Workbench V2/u)
  })
})
