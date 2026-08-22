import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FileDocumentPanel } from '../src/client/file-document-panel.tsx'
import {
  buildFileTree,
  initialFileTreeUiState,
  selectFileTreeEntry,
  toggleFileTreeDirectory,
} from '../src/file-tree.ts'
import type { FileEntryV1 } from '../src/types.ts'

const directory: FileEntryV1 = {
  id: 'src',
  name: 'src',
  kind: 'directory',
  summary: 'Source files',
  capabilities: [],
}

const childFile: FileEntryV1 = {
  id: 'file-1',
  parentId: 'src',
  name: 'notes.txt',
  kind: 'text',
  mediaType: 'text/plain',
  size: 12,
  capabilities: ['preview', 'open'],
}

const rootFile: FileEntryV1 = {
  id: 'readme',
  name: 'README.md',
  kind: 'text',
  mediaType: 'text/markdown',
  size: 30,
  capabilities: ['preview', 'open'],
}

describe('file tree state', () => {
  it('builds a tree with roots and directory children', () => {
    const tree = buildFileTree([directory, childFile, rootFile])
    expect(tree.map(node => node.entry.id)).toEqual(['src', 'readme'])
    expect(tree[0]?.children.map(node => node.entry.id)).toEqual(['file-1'])
  })

  it('toggles a directory expanded state', () => {
    let state = toggleFileTreeDirectory(initialFileTreeUiState, 'src')
    expect(state.expandedIds.has('src')).toBe(true)
    state = toggleFileTreeDirectory(state, 'src')
    expect(state.expandedIds.has('src')).toBe(false)
  })

  it('selects an entry without mutating the previous state', () => {
    const state = selectFileTreeEntry(initialFileTreeUiState, 'file-1')
    expect(state.selectedId).toBe('file-1')
    expect(initialFileTreeUiState.selectedId).toBeNull()
  })

  it('treats entries with missing parents as roots', () => {
    const orphan = { ...childFile, id: 'missing-child', parentId: 'missing' }
    const tree = buildFileTree([directory, orphan])
    expect(tree.map(node => node.entry.id).sort()).toEqual(['missing-child', 'src'])
  })
})

describe('FileDocumentPanel tree rendering (server)', () => {
  it('renders empty state without entries', () => {
    const html = renderToStaticMarkup(createElement(FileDocumentPanel, { tabId: 'files', entries: [] }))
    expect(html).toContain('文件源尚未连接')
  })

  it('renders directory and root file names without expanding children', () => {
    const html = renderToStaticMarkup(createElement(FileDocumentPanel, { tabId: 'files', entries: [directory, childFile, rootFile] }))
    expect(html).toContain('src')
    expect(html).toContain('README.md')
    expect(html).not.toContain('notes.txt')
  })
})
