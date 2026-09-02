// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Context } from '@deepseek-ai/cordis'
import { InteractionSpaceController } from '../src/controller.ts'
import { InteractionSpaceView } from '../src/view.tsx'
import { apply } from '../src/client/index.ts'
import type { TableRangeAnchorV1 } from '@yeisme/dsh-selection-host'

afterEach(cleanup)

const AT = '2026-08-29T10:00:00Z'
const DIGEST = 'a'.repeat(64)

const anchor: TableRangeAnchorV1 = {
  kind: 'table-range',
  anchorId: 'anc-1',
  artifactRef: 'file:data.csv',
  artifactVersion: 'v1',
  sheetId: 'sheet-1',
  rowFrom: 3,
  rowTo: 7,
  colFrom: 2,
  colTo: 4,
  quotePreview: 'B3:D7',
  quoteDigest: DIGEST,
  createdAt: AT,
  freshness: 'fresh',
  marker: 1,
}

function controllerWith(overrides: Record<string, unknown> = {}): InteractionSpaceController {
  return new InteractionSpaceController({
    resource: { owner: 'dsh', ref: 'file:data.csv', version: 'v1', title: 'data.csv', mediaType: 'text/csv' },
    now: () => AT,
    ...overrides,
  })
}

describe('InteractionSpaceView', () => {
  it('keeps the profile-level entry inert until a resource is supplied', () => {
    expect(() => apply({} as never)).not.toThrow()
  })

  it('renders the resource header, anchor bar, and empty states', () => {
    const controller = controllerWith()
    controller.addAnchor(anchor)
    render(<InteractionSpaceView controller={controller} />)
    expect(screen.getByLabelText('data.csv')).toBeTruthy()
    expect(screen.getByText('表 sheet-1 R3-7C2-4')).toBeTruthy()
    expect(screen.getByText(/暂无提案/)).toBeTruthy()
  })

  it('shows the degrade strip when composer and owner adapters are absent', () => {
    render(<InteractionSpaceView controller={controllerWith()} />)
    expect(screen.getByText(/composer-adapter-unavailable/)).toBeTruthy()
    expect(screen.getByText(/owner-adapter-unavailable/)).toBeTruthy()
  })

  it('renders proposals with per-hunk approval and a disabled apply without dispatch', async () => {
    const controller = controllerWith()
    controller.addAnchor(anchor)
    controller.ingestDirective({
      directiveId: 'dir-1',
      kind: 'propose',
      createdAt: AT,
      proposal: {
        proposalId: 'prop-1',
        anchorIds: ['anc-1'],
        baseVersion: 'v1',
        safeSummary: '修正表头',
        payload: { format: 'table-cells', sheetId: 'sheet-1', cells: [{ row: 3, col: 2, before: 'Naem', after: 'Name' }] },
      },
    })
    render(<InteractionSpaceView controller={controller} />)
    expect(await screen.findByText('修正表头')).toBeTruthy()
    expect(screen.getByText(/Naem/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '通过' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: /应用/ }).disabled).toBe(true) })
  })

  it('applies through the owner adapter and records the receipt', async () => {
    const controller = controllerWith({
      dispatch: { dispatch: async () => ({ kind: 'applied' as const, receiptRef: 'rcpt-9', nextVersion: 'v2' }) },
    })
    controller.addAnchor(anchor)
    controller.ingestDirective({
      directiveId: 'dir-1',
      kind: 'propose',
      createdAt: AT,
      proposal: {
        proposalId: 'prop-1',
        anchorIds: ['anc-1'],
        baseVersion: 'v1',
        safeSummary: '改名',
        payload: { format: 'table-cells', sheetId: 'sheet-1', cells: [{ row: 3, col: 2, before: 'a', after: 'b' }] },
      },
    })
    render(<InteractionSpaceView controller={controller} />)
    fireEvent.click(await screen.findByRole('button', { name: /应用/ }))
    await waitFor(() => { expect(screen.getAllByText(/receipt rcpt-9/).length).toBeGreaterThan(0) })
    expect(screen.getByText(/提案已应用/)).toBeTruthy()
  })

  it('renders rejected directives with their typed reason', async () => {
    const controller = controllerWith()
    controller.ingestDirective({ directiveId: 'd', kind: 'highlight', anchorIds: ['ghost'], createdAt: AT })
    render(<InteractionSpaceView controller={controller} />)
    await waitFor(() => { expect(screen.getByText(/directive 被拒绝/)).toBeTruthy() })
    expect(screen.getByText(/unknown anchor ghost/)).toBeTruthy()
  })
})

describe('client apply', () => {
  function fakeContext(faces: Record<string, unknown>): Context {
    return {
      get: (key: never) => faces[key as unknown as string],
      ...faces,
    } as unknown as Context
  }

  it('registers the interaction.space view and ingests space/ref events', () => {
    const registered: unknown[] = []
    const events: Array<{ name: string; resolve: (event: unknown) => unknown }> = []
    const ctx = fakeContext({
      paneWorkbench: { registerView: (input: unknown) => { registered.push(input); return () => {} }, openView: () => {} },
      conversationEvents: { register: (definition: { name: string; resolve: (event: unknown) => unknown }) => { events.push(definition); return () => {} } },
    })
    const dispose = apply(ctx, { resource: { owner: 'dsh', ref: 'file:data.csv', version: 'v1', title: 'data.csv', mediaType: 'text/csv' } })
    expect(registered).toHaveLength(1)
    const view = registered[0] as { descriptor: { kind: string }; component: (props?: unknown) => unknown }
    expect(view.descriptor.kind).toBe('interaction.space')
    expect(events.map(event => event.name)).toContain('space/ref')
    // 事件 → directive → 时间线（渲染真值在空间）
    events[0]?.resolve({ data: { directiveId: 'p1', kind: 'progress', runRef: 'ordo:r1', stage: 'render', createdAt: AT } })
    dispose()
  })

  it('zero-registers when the paneWorkbench probe is absent', () => {
    const registered: unknown[] = []
    const ctx = fakeContext({ paneWorkbench: undefined })
    const dispose = apply(ctx, { resource: { owner: 'dsh', ref: 'x', version: 'v1', title: 'x', mediaType: 'text/plain' } })
    expect(registered).toHaveLength(0)
    expect(() => dispose()).not.toThrow()
  })
})
