// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { FileDocumentPanel } from '../src/client/file-document-panel.tsx'
import type { ArchiveEntryListPreviewV1, FileEntryV1 } from '../src/types.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const zipEntry: FileEntryV1 = {
  id: 'arch-1',
  name: 'bundle.zip',
  kind: 'archive',
  mediaType: 'application/zip',
  size: 4096,
  capabilities: ['preview', 'open'],
}

const mediaTypeOnlyZip: FileEntryV1 = {
  id: 'arch-2',
  name: 'package.jar',
  kind: 'file',
  mediaType: 'application/java-archive',
  size: 8192,
  capabilities: ['preview'],
}

const ownerList: ArchiveEntryListPreviewV1 = {
  entries: [
    { name: 'docs/', isDirectory: true },
    { name: 'docs/readme.md', uncompressedSize: 1234 },
    { name: 'data.bin', uncompressedSize: 99, nameTruncated: false },
  ],
  totalEntries: 3,
  listedEntries: 3,
  truncated: false,
  expandedBytesTotal: 1333,
}

const truncatedList: ArchiveEntryListPreviewV1 = {
  entries: [{ name: 'only.txt', uncompressedSize: 10 }],
  totalEntries: 230,
  listedEntries: 1,
  truncated: true,
  malformed: true,
  expandedBytesTotal: 10,
}

let container: HTMLDivElement
let root: Root

function render(props: Record<string, unknown>): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(createElement(FileDocumentPanel, { tabId: 'files', ...props })))
}

function selectRow(entry: FileEntryV1): void {
  const row = container.querySelector(`[data-dsh-file-tree-row][aria-label]`) as HTMLElement | null
    ?? [...container.querySelectorAll<HTMLElement>('[data-dsh-file-tree-row]')]
      .find(element => element.textContent?.includes(entry.name))
  expect(row).toBeTruthy()
  act(() => row!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('FileDocumentPanel archive owner entry list (V3 4.8)', () => {
  it('renders the owner-issued entry list for an archive entry with metadata only', () => {
    render({ entries: [zipEntry], archiveEntries: ownerList })
    selectRow(zipEntry)
    const list = container.querySelector('[data-dsh-file-preview-archive]')
    expect(list).toBeTruthy()
    expect(container.textContent).toContain('docs/readme.md')
    expect(container.textContent).toContain('data.bin')
    expect(container.textContent).toContain('owner 提供 · 仅元数据 · 不解压')
    expect(container.textContent).toContain('共 3 条 · 列出 3 条')
    expect(container.textContent).toContain('1.2 KB')
    // Entry-content preview stays honestly unavailable without a new owner safe ref.
    expect(container.textContent).toContain('条目内容预览需 owner 签发新的安全引用')
    // No client extraction affordance anywhere.
    expect(container.querySelector('[data-dsh-file-preview-binary]')).toBeNull()
  })

  it('routes by media type even when the entry kind is not archive', () => {
    render({ entries: [mediaTypeOnlyZip], archiveEntries: ownerList })
    selectRow(mediaTypeOnlyZip)
    expect(container.querySelector('[data-dsh-file-preview-archive]')).toBeTruthy()
  })

  it('reports honest truncation and malformed central-directory metadata', () => {
    render({ entries: [zipEntry], archiveEntries: truncatedList })
    selectRow(zipEntry)
    expect(container.textContent).toContain('229 条未列出（超出列表上限）')
    expect(container.textContent).toContain('列表可能不完整')
  })

  it('keeps the honest unsupported state when the owner issues no entry list', () => {
    render({ entries: [zipEntry] })
    selectRow(zipEntry)
    expect(container.querySelector('[data-dsh-file-preview-archive]')).toBeNull()
    expect(container.textContent).toContain('等待文件服务提供预览授权')
  })

  it('falls back to bounded bytes preview for archives only when no entry list is issued', () => {
    render({ entries: [zipEntry], bytes: new Uint8Array([1, 2, 3, 4]) })
    selectRow(zipEntry)
    expect(container.querySelector('[data-dsh-file-preview-binary]')).toBeTruthy()
    expect(container.querySelector('[data-dsh-file-preview-archive]')).toBeNull()
  })
})
