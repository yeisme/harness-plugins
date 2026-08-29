import { describe, expect, it } from 'vitest'
import { fileEntryToMediaRef, mediaKindOf } from '../src/client/apply.ts'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'

function entryOf(name: string, kind = 'file', mediaType: string | undefined = undefined): FileEntryV1 {
  return { id: `id-${name}`, name, kind, mediaType, capabilities: ['preview', 'open'] }
}

describe('file-preview-formats file mapping', () => {
  it('keeps legacy media mappings unchanged', () => {
    expect(mediaKindOf(entryOf('cover.png', 'image'))).toBe('image')
    expect(mediaKindOf(entryOf('manual.pdf', 'file'))).toBe('pdf')
    expect(mediaKindOf(entryOf('voice.mp3', 'file'))).toBe('audio')
    expect(mediaKindOf(entryOf('clip.mp4', 'file'))).toBe('video')
  })

  it('routes table formats into the grid preview path', () => {
    expect(fileEntryToMediaRef(entryOf('data.csv'))).toMatchObject({ kind: 'document', mediaType: 'text/csv' })
    expect(fileEntryToMediaRef(entryOf('sheet.tsv'))).toMatchObject({ kind: 'document', mediaType: 'text/tab-separated-values' })
    expect(fileEntryToMediaRef(entryOf('report.xlsx'))).toMatchObject({
      kind: 'document',
      mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  })

  it('routes documents with classified media types and keeps text in desktop.file', () => {
    expect(fileEntryToMediaRef(entryOf('brief.docx'))).toMatchObject({
      kind: 'document',
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    // 文本类保留既有 desktop.file 视图（语义编辑器），不进媒体 pane。
    expect(fileEntryToMediaRef(entryOf('notes.md'))).toBeUndefined()
    expect(fileEntryToMediaRef(entryOf('conf.yaml'))).toBeUndefined()
    expect(fileEntryToMediaRef(entryOf('dump.json'))).toBeUndefined()
  })

  it('keeps unsupported office formats visible for honest degrade', () => {
    expect(fileEntryToMediaRef(entryOf('deck.pptx'))).toMatchObject({
      kind: 'document',
      mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    expect(fileEntryToMediaRef(entryOf('legacy.doc'))).toMatchObject({ kind: 'document', mediaType: 'application/msword' })
  })

  it('still drops unknown extensionless binaries', () => {
    expect(mediaKindOf(entryOf('binary-blob'))).toBeUndefined()
    expect(fileEntryToMediaRef(entryOf('binary-blob'))).toBeUndefined()
  })

  it('honors a declared media type when the extension is unknown', () => {
    expect(fileEntryToMediaRef(entryOf('export-2026', 'file', 'text/csv'))).toMatchObject({ kind: 'document', mediaType: 'text/csv' })
    expect(fileEntryToMediaRef(entryOf('snapshot', 'file', 'application/pdf'))).toMatchObject({ kind: 'pdf', mediaType: 'application/pdf' })
  })
})
