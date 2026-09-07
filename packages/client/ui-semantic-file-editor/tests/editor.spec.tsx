// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { FileHostV1 } from '@yeisme/dsh-file-host'
import { LANGUAGE_INTELLIGENCE_CAPABILITY, type LanguageIntelligenceHostV1 } from '@yeisme/dsh-language-intelligence-host'
import { SemanticFileEditor } from '../src/index.js'

afterEach(cleanup)

const entry: FileEntryV1 = {
  id: 'file-safe',
  name: 'example.ts',
  kind: 'text',
  mediaType: 'text/typescript',
  capabilities: ['preview', 'open', 'edit'],
}

function languageHost(overrides: Partial<LanguageIntelligenceHostV1> = {}, body: Record<string, string> = { 'file-safe': 'export const value = 1\n' }): LanguageIntelligenceHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: LANGUAGE_INTELLIGENCE_CAPABILITY,
    async probe() { return { capability: LANGUAGE_INTELLIGENCE_CAPABILITY, engine: 'ast-only', languageId: 'typescript', features: ['structure'], reason: 'ready' } },
    async open(input) {
      const ref = (input as { ref?: string }).ref ?? 'file-safe'
      return {
        capability: LANGUAGE_INTELLIGENCE_CAPABILITY,
        engine: 'ast-only',
        languageId: 'typescript',
        features: ['structure'],
        reason: 'AST fallback active',
        handleId: `handle-${ref === 'file-safe' ? 'safe' : ref}`,
        modelUri: `dsh-resource://model/handle-${ref === 'file-safe' ? 'safe' : ref}`,
        title: `${ref === 'file-safe' ? 'example' : ref}.ts`,
        text: body[ref] ?? body['file-safe'] ?? 'export const value = 1\n',
        truncated: false,
        readOnly: false,
        fileVersion: 'v1',
        documentVersion: 1,
      }
    },
    async change(input) { return { accepted: true, documentVersion: input.documentVersion } },
    async query(_handleId, version, query) {
      if (query.kind === 'structure') return {
        kind: 'structure',
        value: {
          engine: 'tree-sitter', languageId: 'typescript', documentVersion: version, rootId: 'n0', partial: false,
          nodes: [{ id: 'n0', kind: 'program', range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } }, depth: 0, named: true, error: false, missing: false }],
        },
      }
      if (query.kind === 'diagnostics') return { kind: 'diagnostics', value: [] }
      if (query.kind === 'symbols') return { kind: 'symbols', value: [] }
      if (query.kind === 'semanticTokens') return { kind: 'semanticTokens', value: [] }
      if (query.kind === 'hover') return { kind: 'hover' }
      if (query.kind === 'completion') return { kind: 'completion', value: [] }
      if (query.kind === 'definition' || query.kind === 'references') return { kind: query.kind, value: [] }
      return { kind: 'workspaceEdit', value: { title: 'Edit', kind: query.kind, files: [] } }
    },
    async didSave() {},
    async close() {},
    ...overrides,
  }
}

function fileHost(writeText = vi.fn(async () => ({ status: 'ok' as const, version: 'v2' }))): FileHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'file-host',
    capabilities: ['FileOpaqueRefCapabilityV1'],
    async listEntries() { return [entry] },
    writeText,
  }
}

describe('SemanticFileEditor', () => {
  it('renders AST structure, edits through the document version fence, and saves through FileHost', async () => {
    const writeText = vi.fn(async () => ({ status: 'ok' as const, version: 'v2' }))
    const didSave = vi.fn(async () => {})
    render(<SemanticFileEditor entry={entry} fileHost={fileHost(writeText)} languageHost={languageHost({ didSave })} sessionId="session-safe" />)

    const editor = await screen.findByRole('textbox', { name: 'example.ts 源码' })
    expect((await screen.findAllByText('program')).length).toBeGreaterThan(0)
    fireEvent.change(editor, { target: { value: 'export const value = 2\n' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => { expect(writeText).toHaveBeenCalledWith(entry, 'export const value = 2\n', 'v1') })
    await waitFor(() => { expect(didSave).toHaveBeenCalledWith('handle-safe', 'v2') })
    expect(await screen.findByText('已保存')).toBeTruthy()
  })

  it('renders the caller fallback when the host capability is absent', async () => {
    render(<SemanticFileEditor
      entry={entry}
      fileHost={fileHost()}
      languageHost={languageHost({ async open() { throw new Error('missing bundle') } })}
      sessionId="session-safe"
      fallback={<p>legacy file pane</p>}
    />)
    expect(await screen.findByText('legacy file pane')).toBeTruthy()
  })

  it('previews and explicitly confirms a Language Server workspace edit', async () => {
    const base = languageHost()
    const didSave = vi.fn(async () => {})
    const host: LanguageIntelligenceHostV1 = {
      ...base,
      async open(input) { return { ...await base.open(input), features: ['structure', 'format'] } },
      async query(handleId, version, query) {
        if (query.kind === 'format') return { kind: 'workspaceEdit', value: { title: 'Format document', kind: 'format', files: [{ ref: entry.id, expectedVersion: 'v1', edits: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, newText: '// formatted\n' }] }] } }
        return base.query(handleId, version, query)
      },
      didSave,
    }
    const preview = vi.fn(async () => ({ previewId: 'preview-safe', expiresAt: new Date(Date.now() + 60_000).toISOString(), files: [{ ref: entry.id, editCount: 1, beforeBytes: 23, afterBytes: 36, diff: '- export\n+ // formatted' }] }))
    const apply = vi.fn(async () => ({ status: 'ok' as const, previewId: 'preview-safe', files: [{ ref: entry.id, status: 'ok' as const, version: 'v2' }] }))
    render(<SemanticFileEditor entry={entry} fileHost={fileHost()} languageHost={host} workspaceEditHost={{ preview, apply }} sessionId="session-safe" />)
    await screen.findByRole('textbox', { name: 'example.ts 源码' })
    fireEvent.click(screen.getByRole('button', { name: '格式化' }))
    expect(await screen.findByRole('dialog', { name: '工作区编辑预览' })).toBeTruthy()
    expect(screen.getByText(/formatted/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认应用' }))
    await waitFor(() => { expect(apply).toHaveBeenCalledWith('session-safe', 'preview-safe') })
    await waitFor(() => { expect(didSave).toHaveBeenCalledWith('handle-safe', 'v2') })
    expect((screen.getByRole('textbox', { name: 'example.ts 源码' }) as HTMLTextAreaElement).value).toContain('// formatted')
  })
})

describe('renderer buffer independence across layout restore', () => {
  const first: FileEntryV1 = { ...entry, id: 'file-a', name: 'alpha.ts' }
  const second: FileEntryV1 = { ...entry, id: 'file-b', name: 'beta.ts' }
  const bodies = { 'file-a': 'export const alpha = 1\n', 'file-b': 'export const beta = 2\n' }
  const host = () => languageHost({}, bodies)
  const listing = async () => [first, second]

  function twoEditors() {
    return <div>
      <SemanticFileEditor entry={first} fileHost={{ ...fileHost(), listEntries: listing }} languageHost={host()} sessionId="session-layout" />
      <SemanticFileEditor entry={second} fileHost={{ ...fileHost(), listEntries: listing }} languageHost={host()} sessionId="session-layout" />
    </div>
  }

  it('keeps two unsaved bodies independent while mounted and never swaps bindings on remount', async () => {
    const { unmount } = render(twoEditors())
    const alphaBox = await screen.findByRole('textbox', { name: 'alpha.ts 源码' })
    const betaBox = await screen.findByRole('textbox', { name: 'beta.ts 源码' })
    expect((alphaBox as HTMLTextAreaElement).value).toBe('export const alpha = 1\n')
    expect((betaBox as HTMLTextAreaElement).value).toBe('export const beta = 2\n')
    // Both editors carry unsaved local edits; dirty state stays per instance.
    fireEvent.change(alphaBox, { target: { value: 'export const alpha = 11 // unsaved\n' } })
    fireEvent.change(betaBox, { target: { value: 'export const beta = 22 // unsaved\n' } })
    expect((alphaBox as HTMLTextAreaElement).value).toContain('alpha = 11')
    expect((betaBox as HTMLTextAreaElement).value).toContain('beta = 22')
    expect((alphaBox as HTMLTextAreaElement).value).not.toContain('beta')
    // Layout restore remounts the renderer: each pane reopens its own entry and
    // one pane's unsaved body never surfaces in the other pane.
    unmount()
    render(twoEditors())
    const nextAlpha = await screen.findByRole('textbox', { name: 'alpha.ts 源码' })
    const nextBeta = await screen.findByRole('textbox', { name: 'beta.ts 源码' })
    expect((nextAlpha as HTMLTextAreaElement).value).toBe('export const alpha = 1\n')
    expect((nextBeta as HTMLTextAreaElement).value).toBe('export const beta = 2\n')
    expect((nextAlpha as HTMLTextAreaElement).value).not.toContain('beta')
    expect((nextBeta as HTMLTextAreaElement).value).not.toContain('alpha')
  })

  it('does not let one pane save into the other entry after remount', async () => {
    const writeText = vi.fn(async () => ({ status: 'ok' as const, version: 'v2' }))
    const { unmount } = render(twoEditors())
    await screen.findAllByRole('textbox')
    unmount()
    const hosts = host()
    render(<SemanticFileEditor entry={first} fileHost={{ ...fileHost(writeText), listEntries: listing }} languageHost={hosts} sessionId="session-layout" />)
    const box = await screen.findByRole('textbox', { name: 'alpha.ts 源码' })
    fireEvent.change(box, { target: { value: 'export const alpha = 3\n' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => { expect(writeText).toHaveBeenCalledWith(first, 'export const alpha = 3\n', 'v1') })
    expect(writeText).toHaveBeenCalledTimes(1)
  })
})
