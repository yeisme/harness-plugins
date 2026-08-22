import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FileDocumentPanel } from '../src/client/file-document-panel.tsx'
import type { FileEntryV1 } from '../src/types.ts'

const file: FileEntryV1 = {
  id: 'file-1',
  name: 'notes.txt',
  kind: 'text',
  mediaType: 'text/plain',
  size: 12,
  capabilities: ['preview', 'open'],
}

const pdf: FileEntryV1 = {
  id: 'pdf-1',
  name: 'guide.pdf',
  kind: 'pdf',
  mediaType: 'application/pdf',
  size: 2048,
  capabilities: ['preview', 'download'],
}

describe('FileDocumentPanel', () => {
  it('renders file entries in files tab', () => {
    const html = renderToStaticMarkup(<FileDocumentPanel tabId="files" entries={[file, pdf]} />)
    expect(html).toContain('notes.txt')
    expect(html).toContain('guide.pdf')
  })

  it('filters documents in documents tab', () => {
    const html = renderToStaticMarkup(<FileDocumentPanel tabId="documents" entries={[file, pdf]} />)
    expect(html).toContain('notes.txt')
    expect(html).toContain('guide.pdf')
  })

  it('renders empty state without entries', () => {
    const html = renderToStaticMarkup(<FileDocumentPanel tabId="files" />)
    expect(html).toContain('文件源尚未连接')
    expect(html).toContain('连接工作区文件服务后')
  })
})
