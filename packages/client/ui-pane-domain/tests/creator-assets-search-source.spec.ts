import { describe, expect, it, vi } from 'vitest'
import { createCreatorAssetsSearchSource } from '../src/creator-assets-search-source.js'

describe('Creator asset search source', () => {
  it('projects owner asset metadata with pagination and opens the original owner view', async () => {
    const open = vi.fn(); const service = { snapshot: vi.fn(async () => ({ context: { workspaceRef: 'workspace:w1', projectRef: 'project:p1' } })), assets: vi.fn(async () => ({ status: 'partial', nextCursor: 'asset-next', items: [{ ref: 'asset:1', version: 'v3', kind: 'image', title: 'Cover', summary: 'Approved cover', owner: 'eikona', status: 'completed' }] })) }
    const source = createCreatorAssetsSearchSource({ service, open })
    const page = await source.source.search({ query: 'Cover', scope: { kind: 'workspace', ref: 'workspace:w1' }, kinds: ['image'], filters: {}, sort: 'relevance' }, new AbortController().signal)
    expect(page).toMatchObject({ status: 'partial', nextCursor: 'asset-next', resources: [{ ref: 'asset:1', revision: 'v3', kind: 'image', projectRef: 'workspace:w1' }] })
    expect(await source.source.open!(page.resources[0]!, { kind: 'workspace', ref: 'workspace:w1' })).toEqual({ status: 'opened' })
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ metadata: { ref: 'asset:1', revision: 'v3', kind: 'image' } }))
    source.dispose()
  })
  it('fails closed on denied owner and does not turn empty capability into zero results', async () => {
    const service = { snapshot: vi.fn(async () => ({ context: { workspaceRef: 'workspace:w1' } })), assets: vi.fn(async () => ({ status: 'needs_contract', items: [] })) }
    const source = createCreatorAssetsSearchSource({ service, open: () => {} })
    expect(await source.source.search({ query: '', scope: { kind: 'workspace', ref: 'workspace:w1' }, kinds: ['image'], filters: {}, sort: 'relevance' }, new AbortController().signal)).toEqual({ status: 'disabled', resources: [] })
    source.dispose()
  })
})
