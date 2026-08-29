// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewTableRenderer } from '../src/client/preview/table-renderer.tsx'
import type { PreviewAccessHandleV1, PreviewResourceV1 } from '../src/client/preview/types.ts'

afterEach(cleanup)

const resource: PreviewResourceV1 = {
  key: 'dsh:data-1', sourceKind: 'file', ref: { owner: 'dsh', ref: 'data-1', version: 'v1' },
  title: 'results.csv', mediaType: 'text/csv', family: 'table', capabilities: ['preview'],
}

function access(overrides: Partial<PreviewAccessHandleV1>): PreviewAccessHandleV1 {
  return {
    expiresAt: '2099-01-01T00:00:00Z',
    release() {},
    getSnapshot: () => ({ owner: 'dsh', ref: 'data-1', version: 'v1', rendition: 'table', expiresAt: '2099-01-01T00:00:00Z', released: false, capabilities: ['preview'] }),
    subscribe: () => () => {},
    ...overrides,
  }
}

describe('PreviewTableRenderer', () => {
  it('renders owner schema and routes global sort through queryTable', async () => {
    const queryTable = vi.fn(async () => ({
      columns: [{ id: 'name', label: 'Name' }, { id: 'value', label: 'Value', align: 'end' as const }],
      rows: [['alpha', '=1+1'], ['beta', '2']], rowKeys: ['a', 'b'], page: 0, pageSize: 200, loaded: 2, total: 2, truncated: false,
    }))
    render(<PreviewTableRenderer resource={resource} access={access({ queryTable })} />)
    expect(await screen.findByRole('columnheader', { name: /Name/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Name' }))
    await waitFor(() => { expect(queryTable).toHaveBeenLastCalledWith(expect.objectContaining({ sort: { columnId: 'name', direction: 'asc' } }), expect.any(AbortSignal)) })
    expect(screen.getByRole('status').textContent).toContain('2 / 2 rows')
  })

  it('keeps global operations disabled without owner query capability', async () => {
    const readTablePage = vi.fn(async () => ({
      columns: [{ id: 'name', label: 'Name' }], rows: [['alpha']], page: 0, pageSize: 200, loaded: 1, truncated: true,
    }))
    render(<PreviewTableRenderer resource={resource} access={access({ readTablePage })} />)
    expect(await screen.findByRole('columnheader', { name: /Name/ })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Search all rows' }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Name' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('partial')
  })

  it('shows an honest unsupported state when the owner omits schema', async () => {
    render(<PreviewTableRenderer resource={resource} access={access({ readTablePage: async () => ({ rows: [['x']], page: 0, pageSize: 200, loaded: 1, truncated: false }) })} />)
    expect(await screen.findByText('The owner did not provide a table schema.')).toBeTruthy()
  })
})
