// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MediaRefV1 } from '../src/host/types.ts'
import type { BoundedSource } from '../src/client/preview/sources.ts'
import { DOCX_MEDIA_TYPE, PPTX_MEDIA_TYPE, XLSSM_MEDIA_TYPE, XLSX_MEDIA_TYPE, classifyFileEntry, documentPreviewKindOf } from '../src/client/preview/format-kinds.ts'
import { mediaFamilyOf } from '../src/client/preview/adapters.ts'
import { createPreviewAccessHandle } from '../src/client/preview/access.ts'
import { PreviewRendererRegistry } from '../src/client/preview/registry.ts'
import { FILE_PREVIEW_DESCRIPTORS, registerFilePreviewRenderers } from '../src/client/preview/descriptors.tsx'
import { MediaTextSourceRenderer, TEXT_WINDOW, prettyJsonOrRaw } from '../src/client/preview/text-source.tsx'
import { MediaCsvRenderer } from '../src/client/preview/csv-renderer.tsx'
import { MediaDocxRenderer } from '../src/client/preview/docx-renderer.tsx'
import { MediaSheetRenderer, rowsFromSheetJson } from '../src/client/preview/sheet-renderer.tsx'
import { MediaPreviewPane } from '../src/client/media-preview-pane.tsx'

vi.mock('mammoth', () => ({
  default: {
    convertToHtml: vi.fn(async () => ({ value: '<h1>标题</h1><p>正文<script>evil()</script></p>', messages: [] })),
  },
}))

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '')),
  },
}))

const sheetRows: Record<string, string[][]> = {
  Sheet1: [['Name', 'City'], ['Alice', 'Beijing'], ['Bob', 'Shanghai']],
  汇总: [['总计', '3']],
}

vi.mock('@e965/xlsx', () => ({
  read: vi.fn(() => ({
    SheetNames: Object.keys(sheetRows),
    Sheets: { Sheet1: { '!ref': 'A1:B3' }, 汇总: { '!ref': 'A1:B1' } },
  })),
  utils: {
    sheet_to_json: vi.fn((worksheet: { '!ref': string }) => {
      const name = worksheet['!ref'] === 'A1:B3' ? 'Sheet1' : '汇总'
      return sheetRows[name] as unknown[][]
    }),
  },
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mediaOf(kind: MediaRefV1['kind'], mediaType: string, overrides: Partial<MediaRefV1> = {}): MediaRefV1 {
  return {
    owner: 'dsh',
    kind,
    ref: `${kind}-${mediaType}`,
    version: 'v1',
    mediaType,
    title: `${kind}-${mediaType}`,
    capabilities: ['preview', 'open', 'download'],
    ...overrides,
  }
}

function textSourceOf(body: string): BoundedSource {
  return {
    async readText(cap) { return body.slice(0, cap) },
    async readBytes(cap) { return new TextEncoder().encode(body.slice(0, cap)) },
  }
}

function bytesSourceOf(bytes: Uint8Array): BoundedSource {
  return {
    async readText(cap) { return new TextDecoder().decode(bytes.slice(0, cap)) },
    async readBytes(cap) { return bytes.slice(0, cap) },
  }
}

describe('documentPreviewKindOf + classifyFileEntry', () => {
  it('routes media types to renderer families', () => {
    expect(documentPreviewKindOf('text/csv')).toBe('csv')
    expect(documentPreviewKindOf('TEXT/TAB-SEPARATED-VALUES')).toBe('csv')
    expect(documentPreviewKindOf(XLSX_MEDIA_TYPE)).toBe('sheet')
    expect(documentPreviewKindOf(XLSSM_MEDIA_TYPE)).toBe('sheet')
    expect(documentPreviewKindOf(DOCX_MEDIA_TYPE)).toBe('docx')
    expect(documentPreviewKindOf('application/pdf')).toBe('pdf')
    expect(documentPreviewKindOf('application/json')).toBe('text')
    expect(documentPreviewKindOf('application/geo+json')).toBe('text')
    expect(documentPreviewKindOf('text/markdown')).toBe('text')
    expect(documentPreviewKindOf(PPTX_MEDIA_TYPE)).toBe('binary')
    expect(documentPreviewKindOf('application/vnd.ms-excel')).toBe('binary')
  })

  it('classifies file entries by extension then media type', () => {
    expect(classifyFileEntry('data.csv', undefined)).toEqual({ kind: 'document', mediaType: 'text/csv' })
    expect(classifyFileEntry('report.xlsx', undefined)).toEqual({ kind: 'document', mediaType: XLSX_MEDIA_TYPE })
    expect(classifyFileEntry('brief.docx', undefined)).toEqual({ kind: 'document', mediaType: DOCX_MEDIA_TYPE })
    expect(classifyFileEntry('notes.md', undefined)).toEqual({ kind: 'text', mediaType: 'text/markdown' })
    expect(classifyFileEntry('conf.yaml', undefined)).toEqual({ kind: 'text', mediaType: 'application/yaml' })
    expect(classifyFileEntry('cover.svg', 'image/svg+xml')).toEqual({ kind: 'image', mediaType: 'image/svg+xml' })
    expect(classifyFileEntry('deck.pptx', undefined)).toEqual({ kind: 'document', mediaType: PPTX_MEDIA_TYPE })
    expect(classifyFileEntry('binary', undefined)).toBeUndefined()
  })
})

describe('mediaFamilyOf routing', () => {
  it('keeps legacy families and routes new formats', () => {
    expect(mediaFamilyOf('image', 'image/png')).toBe('image')
    expect(mediaFamilyOf('document', 'text/csv')).toBe('table')
    expect(mediaFamilyOf('document', XLSX_MEDIA_TYPE)).toBe('table')
    expect(mediaFamilyOf('document', DOCX_MEDIA_TYPE)).toBe('document')
    expect(mediaFamilyOf('document', PPTX_MEDIA_TYPE)).toBe('binary')
    expect(mediaFamilyOf('document', 'application/json')).toBe('text')
    expect(mediaFamilyOf('file', 'application/pdf')).toBe('pdf')
    expect(mediaFamilyOf('file', 'application/octet-stream')).toBe('binary')
  })
})

describe('registry descriptors', () => {
  it('resolves exact MIME descriptors deterministically', () => {
    const registry = new PreviewRendererRegistry()
    const dispose = registerFilePreviewRenderers(descriptor => registry.register(descriptor))
    expect(registry.resolve({ mediaType: 'text/csv', family: 'table' })?.id).toBe('yeisme:csv')
    expect(registry.resolve({ mediaType: XLSX_MEDIA_TYPE, family: 'table' })?.id).toBe('yeisme:sheet')
    expect(registry.resolve({ mediaType: DOCX_MEDIA_TYPE, family: 'document' })?.id).toBe('yeisme:docx')
    expect(registry.resolve({ mediaType: 'text/plain', family: 'text' })?.id).toBe('yeisme:text')
    expect(registry.resolve({ mediaType: 'application/pdf', family: 'pdf' })?.id).toBe('yeisme:pdf')
    // Unknown binaries and PPTX land on the honest degrade notice, never a format guess.
    expect(registry.resolve({ mediaType: 'application/octet-stream', family: 'binary' })?.id).toBe('yeisme:binary-notice')
    expect(registry.resolve({ mediaType: PPTX_MEDIA_TYPE, family: 'document' })?.id).toBe('yeisme:binary-notice')
    dispose()
    expect(registry.size()).toBe(0)
  })
})

describe('createPreviewAccessHandle columns', () => {
  it('emits the additive column schema on every table page', async () => {
    const handle = createPreviewAccessHandle({
      resource: {
        key: 'dsh:t', sourceKind: 'media', ref: { owner: 'dsh', ref: 't', version: 'v1' },
        title: 't', mediaType: 'text/csv', family: 'table', capabilities: ['preview'],
      },
      table: [['h1', 'h2'], ['a', 'b']],
      columns: [{ id: 'col-0', label: 'h1', type: 'text' }],
    })
    const page = await handle.readTablePage({ page: 1, pageSize: 1 })
    expect(page.columns).toEqual([{ id: 'col-0', label: 'h1', type: 'text' }])
    handle.release('close')
  })
})

describe('MediaTextSourceRenderer', () => {
  it('renders bounded text with line numbers', async () => {
    render(<MediaTextSourceRenderer media={mediaOf('text', 'text/plain')} source={textSourceOf('alpha\nbeta')} />)
    await waitFor(() => { expect(screen.getByText('beta')).toBeTruthy() })
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('pretty-prints JSON media types', async () => {
    render(<MediaTextSourceRenderer media={mediaOf('text', 'application/json')} source={textSourceOf('{"a":1}')} />)
    await waitFor(() => { expect(screen.getByText('"a": 1')).toBeTruthy() })
  })

  it('shows load-more and truncation notes for large text', async () => {
    const body = `${'line\n'.repeat(20_000)}`
    render(<MediaTextSourceRenderer media={mediaOf('text', 'text/plain', { size: 10 * 1024 * 1024 })} source={textSourceOf(body)} />)
    await waitFor(() => { expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy() })
  })

  it('degrades when the source is unavailable', async () => {
    const empty: BoundedSource = { async readText() { return undefined }, async readBytes() { return undefined } }
    render(<MediaTextSourceRenderer media={mediaOf('text', 'text/plain')} source={empty} />)
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('文本不可用') })
  })

  it('falls back to raw text for invalid JSON', () => {
    expect(prettyJsonOrRaw('{"broken": ')).toBe('{"broken": ')
  })
})

describe('MediaCsvRenderer', () => {
  it('parses CSV and promotes the first row to column labels', async () => {
    render(<MediaCsvRenderer media={mediaOf('document', 'text/csv')} source={textSourceOf('Name,City\nAlice,Beijing')} />)
    expect(await screen.findByRole('columnheader', { name: /Name/ })).toBeTruthy()
    expect(await screen.findByRole('columnheader', { name: /City/ })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 / 1 rows')
  })

  it('degrades to unavailable when empty', async () => {
    render(<MediaCsvRenderer media={mediaOf('document', 'text/csv')} source={textSourceOf('')} />)
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('无法内嵌预览') })
  })
})

describe('MediaDocxRenderer', () => {
  it('converts, sanitizes, and renders sanitized HTML', async () => {
    render(<MediaDocxRenderer media={mediaOf('document', DOCX_MEDIA_TYPE)} source={bytesSourceOf(new TextEncoder().encode('PK\x03\x04docx-bytes'))} />)
    await waitFor(() => { expect(screen.getByLabelText('document-application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeTruthy() })
    expect(document.querySelector('[data-dsh-docx-preview]')?.innerHTML).not.toContain('<script')
    expect(document.querySelector('[data-dsh-docx-preview]')?.innerHTML).toContain('标题')
  })

  it('degrades on converter failure', async () => {
    const { default: mammoth } = await import('mammoth')
    vi.mocked(mammoth.convertToHtml).mockRejectedValueOnce(new Error('corrupt'))
    render(<MediaDocxRenderer media={mediaOf('document', DOCX_MEDIA_TYPE)} source={bytesSourceOf(new TextEncoder().encode('not-a-doc'))} />)
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('无法内嵌预览') })
  })

  it('refuses oversized documents before fetching', async () => {
    render(<MediaDocxRenderer media={mediaOf('document', DOCX_MEDIA_TYPE, { size: 32 * 1024 * 1024 })} source={bytesSourceOf(new TextEncoder().encode('x'))} />)
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('超出预览预算') })
  })
})

describe('MediaSheetRenderer', () => {
  it('lists sheets, renders the active grid, and switches tabs', async () => {
    render(<MediaSheetRenderer media={mediaOf('document', XLSX_MEDIA_TYPE)} source={bytesSourceOf(new TextEncoder().encode('PK\x03\x04xlsx'))} />)
    expect(await screen.findByRole('tab', { name: 'Sheet1' })).toBeTruthy()
    expect(await screen.findByRole('columnheader', { name: /Name/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '汇总' }))
    await waitFor(() => { expect(screen.getByRole('columnheader', { name: /总计/ })).toBeTruthy() })
  })

  it('degrades when the workbook has no usable sheets', async () => {
    const { read } = await import('@e965/xlsx')
    vi.mocked(read).mockReturnValueOnce({ SheetNames: [], Sheets: {} })
    render(<MediaSheetRenderer media={mediaOf('document', XLSX_MEDIA_TYPE)} source={bytesSourceOf(new TextEncoder().encode('PK\x03\x04'))} />)
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('无法内嵌预览') })
  })

  it('marks row-budget truncation in rowsFromSheetJson', () => {
    const rows = Array.from({ length: 10_100 }, (_, index) => [`r${index}`])
    const parsed = rowsFromSheetJson(rows)
    expect(parsed.truncated).toBe(true)
  })
})

describe('MediaPreviewPane format dispatch', () => {
  function stubFetchCsv() {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Name,City\nAlice,Beijing', { headers: { 'content-type': 'text/csv' } })))
  }

  it('previews CSV entries through the grid', async () => {
    stubFetchCsv()
    render(<MediaPreviewPane media={[mediaOf('document', 'text/csv', { title: 'people.csv' })]} resolveUrl={async () => 'blob:csv'} />)
    expect(await screen.findByRole('columnheader', { name: /Name/ })).toBeTruthy()
  })

  it('degrades PPTX honestly with open/download affordances', async () => {
    stubFetchCsv()
    const pptx = mediaOf('document', PPTX_MEDIA_TYPE, { title: 'deck.pptx' })
    const csv = mediaOf('document', 'text/csv', { title: 'people.csv' })
    render(<MediaPreviewPane media={[csv, pptx]} resolveUrl={async () => 'blob:mock'} />)
    expect(await screen.findByRole('columnheader', { name: /Name/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: /deck\.pptx/ }))
    await waitFor(() => { expect(screen.getByText(/此文件类型暂不支持内嵌预览/)).toBeTruthy() })
    expect(screen.getByRole('link', { name: '打开' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '下载' })).toBeTruthy()
  })

  it('previews plain text entries through the source view', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('hello pane', { headers: { 'content-type': 'text/plain' } })))
    render(<MediaPreviewPane media={[mediaOf('text', 'text/plain', { title: 'readme.txt' })]} resolveUrl={async () => 'blob:txt'} />)
    await waitFor(() => { expect(screen.getByText('hello pane')).toBeTruthy() })
  })
})

describe('interaction-space anchor hints (data-source-*)', () => {
  it('stamps line hints on text source rows', async () => {
    render(<MediaTextSourceRenderer media={mediaOf('text', 'text/plain')} source={textSourceOf('alpha\nbeta')} />)
    await waitFor(() => { expect(screen.getByText('beta')).toBeTruthy() })
    expect(document.querySelector('[data-source-line="2"]')?.textContent).toContain('beta')
  })

  it('stamps the sheet hint on local table wrappers', async () => {
    render(<MediaCsvRenderer media={mediaOf('document', 'text/csv')} source={textSourceOf('Name,City\nAlice,Beijing')} />)
    await waitFor(() => { expect(document.querySelector('[data-dsh-local-table]')).toBeTruthy() })
    expect(document.querySelector('[data-dsh-local-table]')?.getAttribute('data-source-sheet')).toBe('csv')
  })

  it('computes 1-based absolute data rows across pages', async () => {
    const { tableDataRowOf } = await import('../src/client/preview/table-renderer.tsx')
    expect(tableDataRowOf({ rows: [], page: 0, pageSize: 200, loaded: 0, truncated: false }, 3)).toBe(4)
    expect(tableDataRowOf({ rows: [], page: 1, pageSize: 200, loaded: 0, truncated: false }, 0)).toBe(201)
  })
})

describe('descriptor exports', () => {
  it('exposes six descriptors covering the format matrix', () => {
    expect(FILE_PREVIEW_DESCRIPTORS.map(descriptor => descriptor.id)).toEqual([
      'yeisme:text', 'yeisme:csv', 'yeisme:sheet', 'yeisme:docx', 'yeisme:pdf', 'yeisme:binary-notice',
    ])
  })
})
