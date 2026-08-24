import type { ExplorerTreeNodeV1 } from './tree-state.js'

export interface ExplorerOpenAdapterV1 {
  openResource(node: ExplorerTreeNodeV1, mode: 'preview' | 'pin'): void
  openDiff?(node: ExplorerTreeNodeV1): void
}
