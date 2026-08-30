// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { applyFileDocumentPaneViews, WORKSPACE_DOCUMENT_VIEW_KIND, WORKSPACE_EXPLORER_VIEW_KIND } from '../src/client/pane-views.ts'
import type { FileEntryV1 } from '../src/types.ts'

interface Registration {
  descriptor: { kind: string; singleton: boolean; role: string; retention: string }
  presentation?: { icon?: string; defaultEdge?: string } | undefined
  component: () => unknown
}

function fakePane() {
  const registrations = new Map<string, Registration>()
  const opens: Array<Record<string, unknown>> = []
  const registerView = vi.fn((input: Registration) => {
    registrations.set(input.descriptor.kind, input)
    return () => { registrations.delete(input.descriptor.kind) }
  })
  const openView = vi.fn((request: Record<string, unknown>) => { opens.push(request) })
  return { registerView, openView, registrations, opens }
}

function entry(id: string, name = `${id}.md`): FileEntryV1 {
  return { id, name, kind: 'file', mediaType: 'text/markdown', capabilities: ['preview', 'open'] } as FileEntryV1
}

describe('workspace.explorer singleton (V3 4.1)', () => {
  it('registers exactly one singleton navigator with semantic presentation', () => {
    const pane = fakePane()
    const surface = applyFileDocumentPaneViews(pane)
    expect(surface.registered).toBe(true)
    const explorer = pane.registrations.get(WORKSPACE_EXPLORER_VIEW_KIND)
    expect(explorer?.descriptor.singleton).toBe(true)
    expect(explorer?.descriptor.role).toBe('navigator')
    expect(explorer?.descriptor.retention).toBe('keep-alive')
    expect(explorer?.presentation?.icon).toBe('folder')
    expect(explorer?.presentation?.defaultEdge).toBe('right')
  })

  it('openExplorer targets the stable singleton resource key', () => {
    const pane = fakePane()
    const surface = applyFileDocumentPaneViews(pane)
    surface.openExplorer()
    expect(pane.opens).toHaveLength(1)
    expect(pane.opens[0]).toMatchObject({ kind: WORKSPACE_EXPLORER_VIEW_KIND, resourceKey: 'explorer:root', singleton: true })
  })
})

describe('workspace.document non-singleton (V3 4.1)', () => {
  it('registers a non-singleton content view — documents are not the singleton landing path', () => {
    const pane = fakePane()
    applyFileDocumentPaneViews(pane)
    const document = pane.registrations.get(WORKSPACE_DOCUMENT_VIEW_KIND)
    expect(document?.descriptor.singleton).toBe(false)
    expect(document?.descriptor.role).toBe('content')
  })

  it('opens one view per document keyed by the owner-issued opaque id; same id dedupes', () => {
    const pane = fakePane()
    const surface = applyFileDocumentPaneViews(pane)
    surface.openDocument(entry('doc-42'))
    surface.openDocument(entry('doc-42'))
    surface.openDocument(entry('doc-43'))
    expect(pane.opens.map(open => open.resourceKey)).toEqual(['document:doc-42', 'document:doc-42', 'document:doc-43'])
    for (const open of pane.opens) {
      expect(String(open.resourceKey)).not.toMatch(/[/\\]|:\/\//)
      expect(open.singleton).toBe(false)
    }
  })

  it('rejects path-shaped, traversal, and invalid ids instead of constructing keys', () => {
    const pane = fakePane()
    const surface = applyFileDocumentPaneViews(pane)
    surface.openDocument(entry('a/b'))
    surface.openDocument(entry('../etc/passwd'))
    surface.openDocument(entry(''))
    surface.openDocument({ ...entry('ok'), kind: 'directory' } as never)
    expect(pane.opens).toHaveLength(0)
  })

  it('carries only the opaque entryId in the projection, never a path or URL', () => {
    const pane = fakePane()
    const surface = applyFileDocumentPaneViews(pane)
    const e = entry('doc-9', 'Notes — draft final')
    surface.openDocument(e)
    expect(pane.opens[0]!.projection).toEqual({ entryId: 'doc-9' })
    expect(JSON.stringify(pane.opens[0])).not.toContain('draft/../')
  })
})

describe('openEntry interaction surface (V3 4.2)', () => {
  it('single click previews, double-click edits durably, duplicate copies, dirty blocks', () => {
    const pane = fakePane()
    const surface = applyFileDocumentPaneViews(pane)
    expect(surface.openEntry(entry('doc-1'), 'preview')).toMatchObject({ mode: 'preview', retention: 'snapshot' })
    expect(surface.openEntry(entry('doc-1'), 'edit')).toMatchObject({ mode: 'edit', retention: 'keep-alive' })
    expect(surface.openEntry(entry('doc-1'), 'duplicate')?.resourceKey).toBe('document:doc-1:copy-1')
    surface.markDirty('doc-1', true)
    expect(surface.openEntry(entry('doc-1'), 'preview')).toMatchObject({ blocked: 'dirty' })
    expect(pane.opens.at(-1)?.resourceKey).toBe('document:doc-1:copy-1') // blocked preview swallowed, no open
    surface.switchSession('s2')
    expect(pane.opens).toHaveLength(3) // session switch itself never opens
  })

  it('directories and path-shaped ids never open through openEntry', () => {
    const pane = fakePane()
    const surface = applyFileDocumentPaneViews(pane)
    expect(surface.openEntry({ ...entry('d1'), kind: 'directory' } as never, 'preview')).toBeUndefined()
    expect(surface.openEntry(entry('a/b'), 'edit')).toBeUndefined()
    expect(pane.opens).toHaveLength(0)
  })
})

describe('honest degradation and disposal (V3 4.1)', () => {
  it('degrades to registered=false without a pane workbench face', () => {
    for (const absent of [undefined, null, {}, { registerView: 1 }, { registerView: () => () => {}, openView: 'nope' }]) {
      const surface = applyFileDocumentPaneViews(absent)
      expect(surface.registered).toBe(false)
      expect(() => { surface.openExplorer(); surface.openDocument(entry('x')); surface.dispose() }).not.toThrow()
    }
  })

  it('dispose unregisters every view exactly once', () => {
    const pane = fakePane()
    const surface = applyFileDocumentPaneViews(pane)
    expect(pane.registrations.size).toBe(2)
    surface.dispose()
    expect(pane.registrations.size).toBe(0)
    surface.dispose()
    expect(pane.registerView).toHaveBeenCalledTimes(2)
  })
})
