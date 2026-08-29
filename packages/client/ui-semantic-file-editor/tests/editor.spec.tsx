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

function languageHost(overrides: Partial<LanguageIntelligenceHostV1> = {}): LanguageIntelligenceHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: LANGUAGE_INTELLIGENCE_CAPABILITY,
    async probe() { return { capability: LANGUAGE_INTELLIGENCE_CAPABILITY, engine: 'ast-only', languageId: 'typescript', features: ['structure'], reason: 'ready' } },
    async open() {
      return {
        capability: LANGUAGE_INTELLIGENCE_CAPABILITY,
        engine: 'ast-only',
        languageId: 'typescript',
        features: ['structure'],
        reason: 'AST fallback active',
        handleId: 'handle-safe',
        modelUri: 'dsh-resource://model/handle-safe',
        title: 'example.ts',
        text: 'export const value = 1\n',
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
