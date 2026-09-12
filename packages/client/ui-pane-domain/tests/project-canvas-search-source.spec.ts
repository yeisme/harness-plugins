import { describe, expect, it, vi } from 'vitest'
import { createProjectCanvasSearchSource } from '../src/project-canvas-search-source.js'

describe('project canvas search source', () => {
  it('searches owner metadata within the declared workspace and opens the original canvas pane', async () => {
    const open = vi.fn()
    const service = { snapshot: vi.fn(async () => ({ context: { workspaceRef: 'workspace:w1', projectRef: 'project:p1' } })), canvasRead: vi.fn(async () => ({ revision: 4, document: { schema: 'dsh.project-canvas.v1alpha1', id: 'main', revision: 4, nodes: [{ id: 'node:a', title: 'Draft brief', kind: 'text' }], edges: [], camera: { x: 0, y: 0, zoom: 1 } } })) }
    const source = createProjectCanvasSearchSource({ service, open })
    const page = await source.source.search({ query: 'Draft', scope: { kind: 'workspace', ref: 'workspace:w1' }, kinds: ['canvas-node'], filters: {}, sort: 'relevance' }, new AbortController().signal)
    expect(page).toMatchObject({ status: 'ready', resources: [{ ref: 'project:p1:node:a', revision: 'canvas:4', projectRef: 'workspace:w1' }] })
    expect(await source.source.open!(page.resources[0]!, { kind: 'workspace', ref: 'workspace:w1' })).toEqual({ status: 'opened' })
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ kind: 'creator.canvas', metadata: { projectRef: 'project:p1', nodeId: 'a' } }))
    expect(service.canvasRead).toHaveBeenCalledOnce()
    source.dispose()
  })

  it('denies a mismatched workspace and never treats a missing canvas as empty success', async () => {
    const service = { snapshot: vi.fn(async () => ({ context: { workspaceRef: 'workspace:w1', projectRef: 'project:p1' } })), canvasRead: vi.fn(async () => ({ document: undefined })) }
    const source = createProjectCanvasSearchSource({ service, open: () => {} })
    expect(await source.source.search({ query: '', scope: { kind: 'workspace', ref: 'workspace:w2' }, kinds: ['canvas-node'], filters: {}, sort: 'relevance' }, new AbortController().signal)).toEqual({ status: 'denied', resources: [] })
    expect(await source.source.search({ query: '', scope: { kind: 'workspace', ref: 'workspace:w1' }, kinds: ['canvas-node'], filters: {}, sort: 'relevance' }, new AbortController().signal)).toEqual({ status: 'offline', resources: [] })
    source.dispose()
  })
})
