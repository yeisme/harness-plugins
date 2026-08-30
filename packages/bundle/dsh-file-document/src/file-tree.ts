/**
 * Pure File/Document tree state.
 *
 * This module keeps tree construction and expand/select transitions headless
 * so they can be unit-tested without a browser or React testing dependency.
 * The React panel is a thin shell over these deterministic transitions.
 *
 * @module @yeisme/dsh-file-document/file-tree
 */

import type { FileEntryV1 } from './types.ts'

export interface FileTreeNode {
  entry: FileEntryV1
  children: FileTreeNode[]
}

export interface FileTreeUiState {
  expandedIds: ReadonlySet<string>
  selectedId: string | null
}

export const initialFileTreeUiState: FileTreeUiState = {
  expandedIds: new Set<string>(),
  selectedId: null,
}

export function buildFileTree(entries: readonly FileEntryV1[]): FileTreeNode[] {
  const nodes: FileTreeNode[] = entries.map(entry => ({ entry, children: [] }))
  const nodeById = new Map(nodes.map(node => [node.entry.id, node]))
  const roots: FileTreeNode[] = []
  for (const node of nodes) {
    const parentId = node.entry.parentId
    const parent = parentId === undefined ? undefined : nodeById.get(parentId)
    if (parent !== undefined && parent !== node) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortNodes = (list: FileTreeNode[]): void => {
    list.sort((left, right) => {
      if (left.entry.kind === 'directory' && right.entry.kind !== 'directory') return -1
      if (left.entry.kind !== 'directory' && right.entry.kind === 'directory') return 1
      return left.entry.name.localeCompare(right.entry.name)
    })
    for (const node of list) sortNodes(node.children)
  }
  sortNodes(roots)
  return roots
}

export function toggleFileTreeDirectory(state: FileTreeUiState, entryId: string): FileTreeUiState {
  const expandedIds = new Set(state.expandedIds)
  if (expandedIds.has(entryId)) expandedIds.delete(entryId)
  else expandedIds.add(entryId)
  return { expandedIds, selectedId: state.selectedId }
}

export function selectFileTreeEntry(state: FileTreeUiState, entryId: string): FileTreeUiState {
  return { expandedIds: new Set(state.expandedIds), selectedId: entryId }
}

/** Ancestor chain (root first) ending at the entry id, or [] when absent. */
export function fileTreePathOf(entries: readonly FileEntryV1[], entryId: string | null): readonly FileEntryV1[] {
  if (entryId === null) return []
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const chain: FileEntryV1[] = []
  let current = byId.get(entryId)
  const seen = new Set<string>()
  while (current !== undefined && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parentId === undefined ? undefined : byId.get(current.parentId)
  }
  return chain
}
