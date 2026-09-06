// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FILE_IMAGE_REGION_REFERENCE_EVENT, FileOpenPane } from '../src/client/file-open-pane.tsx'
import { strToU8, zipSync } from 'fflate'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { FileHostV1 } from '@yeisme/dsh-file-host'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const entry: FileEntryV1 = {
  id: 'file-1',
  name: 'README.md',
  kind: 'text',
  mediaType: 'text/markdown',
  capabilities: ['preview', 'open'],
}

describe('FileOpenPane', () => {
  it('publishes exact owner/ref/version and UTF-8 byte bounds only on immutable raw text', async () => {
    const raw: FileEntryV1 = { ...entry, id: 'file-opaque', name: 'notes.txt', mediaType: 'text/plain' }
    const content = 'zero 中文 tail'
    const host: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host',
      async listEntries() { return [raw] },
      async readText() { return { content, truncated: false, binary: false, version: 'proof-v1' } },
    }
    render(<FileOpenPane host={host} entry={raw} />)
    const source = await screen.findByText(content)
    expect(source.getAttribute('data-dsh-reference-source')).toBe('true')
    expect(source.getAttribute('data-dsh-reference-source-owner')).toBe('dsh.local')
    expect(source.getAttribute('data-dsh-reference-source-ref')).toBe('file-opaque')
    expect(source.getAttribute('data-dsh-reference-source-version')).toBe('proof-v1')
    expect(source.getAttribute('data-dsh-reference-source-scope')).toBe('file/raw')
    expect(source.getAttribute('data-dsh-reference-source-range-start')).toBe('0')
    expect(source.getAttribute('data-dsh-reference-source-range-end')).toBe(String(new TextEncoder().encode(content).byteLength))
  })

  it('does not advertise transformed, dirty, or truncated text as a raw selection source', async () => {
    const editable: FileEntryV1 = { ...entry, capabilities: ['preview', 'open', 'edit'] }
    const host: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host',
      async listEntries() { return [editable] },
      async readText() { return { content: '# rendered', truncated: false, binary: false, version: 'v1' } },
      async writeText() { return { status: 'ok', version: 'v2' } },
    }
    render(<FileOpenPane host={host} entry={editable} />)
    expect((await screen.findByRole('heading', { name: 'rendered' })).hasAttribute('data-dsh-reference-source')).toBe(false)
    screen.getByRole('button', { name: '编辑模式' }).click()
    fireEvent.change(await screen.findByRole('textbox', { name: '编辑 README.md 的 Markdown 区块 1' }), { target: { value: '# dirty' } })
    screen.getByRole('button', { name: '源码模式' }).click()
    expect((await screen.findByRole('textbox', { name: '编辑 README.md' })).hasAttribute('data-dsh-reference-source')).toBe(false)
  })

  it('renders markdown by default and can switch to source', async () => {
    const host: FileHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'file-host',
      async listEntries() { return [entry] },
      async readText() { return { content: '# opened', truncated: false, binary: false } },
    }
    render(<FileOpenPane host={host} entry={entry} />)
    expect(await screen.findByRole('heading', { name: 'opened' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'README.md' })).toBeTruthy()
    expect(document.querySelector('[data-dsh-file-open-pane]')?.getAttribute('data-file-view')).toBe('preview')
    screen.getByRole('button', { name: '源码模式' }).click()
    expect(await screen.findByText('# opened')).toBeTruthy()
    expect(document.querySelector('[data-dsh-file-open-pane]')?.getAttribute('data-file-view')).toBe('source')
  })

  it('keeps Markdown rendered while editing only the selected block', async () => {
    const editable: FileEntryV1 = { ...entry, capabilities: ['preview', 'open', 'edit'] }
    const host: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host',
      async listEntries() { return [editable] },
      async readText() { return { content: '# first\n\n## second', truncated: false, binary: false, version: 'v1' } },
      async writeText() { return { status: 'ok', version: 'v2' } },
    }
    render(<FileOpenPane host={host} entry={editable} />)
    expect(await screen.findByRole('heading', { name: 'first' })).toBeTruthy()
    screen.getByRole('button', { name: '编辑模式' }).click()

    const first = await screen.findByRole('textbox', { name: '编辑 README.md 的 Markdown 区块 1' })
    expect(screen.getByRole('heading', { name: 'second' })).toBeTruthy()
    fireEvent.change(first, { target: { value: '# changed' } })
    expect(screen.getByRole('heading', { name: 'changed' })).toBeTruthy()
    expect(document.querySelectorAll('[data-dsh-markdown-block]')).toHaveLength(2)

    fireEvent.blur(first)
    expect(await screen.findByRole('button', { name: '编辑 Markdown 区块 1' })).toBeTruthy()
    screen.getByRole('button', { name: '编辑 Markdown 区块 2' }).click()
    expect(await screen.findByRole('textbox', { name: '编辑 README.md 的 Markdown 区块 2' })).toBeTruthy()
  })

  it('uses the full raw textarea only in source mode', async () => {
    const editable: FileEntryV1 = { ...entry, capabilities: ['preview', 'open', 'edit'] }
    const host: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host',
      async listEntries() { return [editable] },
      async readText() { return { content: '# opened\n\nbody', truncated: false, binary: false, version: 'v1' } },
      async writeText() { return { status: 'ok', version: 'v2' } },
    }
    render(<FileOpenPane host={host} entry={editable} />)
    await screen.findByRole('heading', { name: 'opened' })
    screen.getByRole('button', { name: '源码模式' }).click()
    const source = await screen.findByRole('textbox', { name: '编辑 README.md' })
    expect(source.getAttribute('data-dsh-file-source-editor')).toBe('true')
    expect((source as HTMLTextAreaElement).value).toBe('# opened\n\nbody')
    expect(document.querySelector('[data-dsh-markdown-editor]')).toBeNull()
  })

  it('renders the DSH CodeBlock mermaid language banner for shared hydration', async () => {
    const host: FileHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'file-host',
      async listEntries() { return [entry] },
      async readText() { return { content: '```mermaid\ngraph TD\nA-->B\n```', truncated: false, binary: false } },
    }
    render(<FileOpenPane host={host} entry={entry} />)
    expect(await screen.findByText('graph TD', { exact: false })).toBeTruthy()
    expect(screen.getByText('mermaid', { exact: true })).toBeTruthy()
  })

  it('renders native audio when the host authorizes a preview URL', () => {
    const audio: FileEntryV1 = {
      id: 'file-audio',
      name: 'take.mp3',
      kind: 'file',
      mediaType: 'audio/mpeg',
      capabilities: ['preview', 'open'],
    }
    const host: FileHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'file-host',
      async listEntries() { return [audio] },
      resolvePreviewUrl: () => 'https://cdn.example/take.mp3',
    }
    render(<FileOpenPane host={host} entry={audio} />)
    expect(document.querySelector('[data-dsh-file-open-audio]')?.getAttribute('src')).toBe('https://cdn.example/take.mp3')
  })

  it('emits a normalized pixel-region request only for an owner-versioned image', async () => {
    const image: FileEntryV1 = { id: 'image-opaque', name: 'shot.png', kind: 'image', mediaType: 'image/png', capabilities: ['preview', 'open'] }
    const NativeURL = URL
    class TestURL extends NativeURL {
      static createObjectURL(): string { return 'blob:image' }
      static revokeObjectURL(): void {}
    }
    vi.stubGlobal('URL', TestURL)
    const host: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host', async listEntries() { return [image] },
      async readBinary() { return { bytes: new Uint8Array([1, 2, 3]), size: 3, truncated: false, version: 'image-v1', mediaType: 'image/png' } },
    }
    const requests: CustomEvent[] = []
    const listener = (event: Event) => { requests.push(event as CustomEvent) }
    window.addEventListener(FILE_IMAGE_REGION_REFERENCE_EVENT, listener)
    render(<FileOpenPane host={host} entry={image} />)
    const preview = await screen.findByRole('img', { name: 'shot.png' }) as HTMLImageElement
    Object.defineProperties(preview, { naturalWidth: { value: 1000 }, naturalHeight: { value: 500 } })
    preview.getBoundingClientRect = () => ({ x: 10, y: 20, left: 10, top: 20, right: 210, bottom: 120, width: 200, height: 100, toJSON: () => ({}) })
    fireEvent.click(await screen.findByRole('button', { name: '引用图像区域' }))
    fireEvent.pointerDown(preview, { clientX: 30, clientY: 40 })
    fireEvent.pointerUp(preview, { clientX: 110, clientY: 80 })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.detail).toMatchObject({ owner: 'dsh.local', ref: 'image-opaque', resourceVersion: 'image-v1', naturalSize: { width: 1000, height: 500 }, region: { x: 0.1, y: 0.2, width: 0.4, height: 0.4 } })
    window.removeEventListener(FILE_IMAGE_REGION_REFERENCE_EVENT, listener)
  })

  it('shows an honest unsupported state when a media file has no preview URL', () => {
    const pdf: FileEntryV1 = {
      id: 'file-pdf',
      name: 'spec.pdf',
      kind: 'pdf',
      mediaType: 'application/pdf',
      capabilities: ['preview', 'open'],
    }
    const host: FileHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'file-host',
      async listEntries() { return [pdf] },
    }
    render(<FileOpenPane host={host} entry={pdf} />)
    expect(screen.getAllByText('文件服务尚未提供二进制预览能力。').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-dsh-file-open-pdf]')).toBeNull()
  })

  it('renders a DOCX as rich text through the bounded binary file seam', async () => {
    const bytes = zipSync({
      'word/document.xml': strToU8('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>器官会议</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>心脏发言</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>角色</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>目标</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'),
      'word/styles.xml': strToU8('<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>'),
    })
    const docx: FileEntryV1 = {
      id: 'file-docx', name: '我的身体器官都有自己的想法.docx', kind: 'document',
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', capabilities: ['preview', 'open'],
    }
    const host: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host',
      async listEntries() { return [docx] },
      async readBinary() { return { bytes, size: bytes.byteLength, truncated: false } },
    }
    render(<FileOpenPane host={host} entry={docx} />)
    expect(await screen.findByRole('document', { name: /富文本预览/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '器官会议' })).toBeTruthy()
    expect(screen.getByText('心脏发言').closest('span')?.getAttribute('style')).toContain('font-weight: 700')
    expect(screen.getByRole('table').textContent).toContain('角色目标')
  })

  it('keeps files read-only until the owner authorizes edit, then saves with the read version', async () => {
    const editable: FileEntryV1 = { ...entry, capabilities: ['preview', 'open', 'edit'] }
    const writes: Array<{ content: string; version: string }> = []
    const host: FileHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'file-host',
      async listEntries() { return [editable] },
      async readText() { return { content: '# opened', truncated: false, binary: false, version: 'v1' } },
      async writeText(_entry, content, expectedVersion) {
        writes.push({ content, version: expectedVersion })
        return { status: 'ok', version: 'v2' }
      },
    }
    render(<FileOpenPane host={host} entry={editable} />)
    expect(await screen.findByRole('heading', { name: 'opened' })).toBeTruthy()
    expect(document.querySelector('[data-dsh-file-open-pane]')?.getAttribute('data-file-mode')).toBe('readonly')
    screen.getByRole('button', { name: '编辑模式' }).click()
    const editor = await screen.findByRole('textbox', { name: '编辑 README.md 的 Markdown 区块 1' })
    fireEvent.change(editor, { target: { value: '# changed' } })
    screen.getByRole('button', { name: '保存' }).click()
    expect(await screen.findByText('已保存')).toBeTruthy()
    expect(writes).toEqual([{ content: '# changed', version: 'v1' }])
  })

  it('preserves the editor buffer when a version conflict rejects the save', async () => {
    const editable: FileEntryV1 = { ...entry, capabilities: ['preview', 'open', 'edit'] }
    const host: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host',
      async listEntries() { return [editable] },
      async readText() { return { content: 'old', truncated: false, binary: false, version: 'v1' } },
      async writeText() { return { status: 'conflict', version: 'v2', reason: 'changed' } },
    }
    render(<FileOpenPane host={host} entry={editable} />)
    await screen.findByText('old')
    screen.getByRole('button', { name: '编辑模式' }).click()
    const editor = await screen.findByRole('textbox', { name: '编辑 README.md 的 Markdown 区块 1' })
    fireEvent.change(editor, { target: { value: 'my draft' } })
    screen.getByRole('button', { name: '保存' }).click()
    expect((await screen.findAllByRole('alert')).some(alert => alert.textContent?.includes('文件已在外部修改'))).toBe(true)
    expect((editor as HTMLTextAreaElement).value).toBe('my draft')
  })

  it('upgrades opaque text refs to the semantic editor without sending a browser path', async () => {
    const semanticEntry: FileEntryV1 = { id: 'file-opaque', name: 'example.ts', kind: 'text', mediaType: 'text/typescript', capabilities: ['preview', 'open', 'edit'] }
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      calls.push({ url, body })
      const value = url.endsWith('/open') ? {
        capability: 'LanguageIntelligenceHostV1', engine: 'ast-only', languageId: 'typescript', features: ['structure'], reason: 'AST fallback active',
        handleId: 'handle-safe', modelUri: 'dsh-resource://model/handle-safe', title: 'example.ts', text: 'export const value = 1\n', truncated: false, readOnly: false, fileVersion: 'v1', documentVersion: 1,
      } : url.endsWith('/query') && (body.query as { kind?: string } | undefined)?.kind === 'structure' ? {
        kind: 'structure', value: { engine: 'tree-sitter', languageId: 'typescript', documentVersion: 1, rootId: 'n0', partial: false, nodes: [{ id: 'n0', kind: 'program', range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } }, depth: 0, named: true, error: false, missing: false }] },
      } : url.endsWith('/query') ? { kind: 'diagnostics', value: [] } : null
      return new Response(JSON.stringify({ ok: true, value }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    const host: FileHostV1 = {
      version: '0.1.0-rc.1', capability: 'file-host', capabilities: ['FileOpaqueRefCapabilityV1'],
      async listEntries() { return [semanticEntry] },
      async writeText() { return { status: 'ok', version: 'v2' } },
    }
    render(<FileOpenPane host={host} entry={semanticEntry} semanticSessionId="session-safe" />)
    expect(await screen.findByText('typescript · ast-only')).toBeTruthy()
    expect(document.querySelector('[data-dsh-semantic-file-editor]')).toBeTruthy()
    expect(calls[0]?.body).toEqual({ sessionId: 'session-safe', ref: 'file-opaque' })
    expect(JSON.stringify(calls)).not.toContain('cwd')
    expect(JSON.stringify(calls)).not.toContain('/workspace/')
  })
})
