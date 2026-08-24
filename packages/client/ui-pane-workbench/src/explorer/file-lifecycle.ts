import type { PaneViewInstanceV1 } from '../workspace.js'

export type FileLifecycleActionV1 = 'compare' | 'reload' | 'save_as' | 'keep_local'
export type FileLifecycleStatusV1 = 'ready' | 'stale' | 'conflict' | 'offline'

export interface FileOpenBufferV1 {
  readonly resourceKey: string
  readonly openedVersion: string
  readonly dirty: boolean
  readonly localDigest?: string
}

export interface FileExternalVersionChangeV1 {
  readonly resourceKey: string
  readonly ownerVersion: string
}

export interface FileLifecycleDecisionV1 {
  readonly status: FileLifecycleStatusV1
  readonly actions: readonly FileLifecycleActionV1[]
  readonly autoOverwrite: false
  readonly dropBuffer: false
}

export interface FileOpenRequestV1 {
  readonly kind: 'file.preview'
  readonly resourceKey: string
  readonly role: 'content'
  readonly preferredRegion: 'right'
  readonly retention: 'recreate'
  readonly singleton: false
  readonly preview: boolean
  readonly pinned: boolean
  readonly dirty?: boolean
  readonly title: string
  readonly resourceVersion?: string
}

export function createFileOpenRequest(
  resourceKey: string,
  title: string,
  mode: 'preview' | 'pin',
  version?: string,
): FileOpenRequestV1 {
  return {
    kind: 'file.preview',
    resourceKey,
    role: 'content',
    preferredRegion: 'right',
    retention: 'recreate',
    singleton: false,
    preview: mode === 'preview',
    pinned: mode === 'pin',
    title,
    resourceVersion: version,
  }
}

export function decideFileLifecycle(
  buffer: FileOpenBufferV1,
  change: FileExternalVersionChangeV1,
): FileLifecycleDecisionV1 {
  if (buffer.resourceKey !== change.resourceKey) {
    return { status: 'ready', actions: [], autoOverwrite: false, dropBuffer: false }
  }
  if (buffer.openedVersion === change.ownerVersion) {
    return { status: 'ready', actions: [], autoOverwrite: false, dropBuffer: false }
  }
  if (buffer.dirty) {
    return {
      status: 'conflict',
      actions: ['compare', 'reload', 'save_as', 'keep_local'],
      autoOverwrite: false,
      dropBuffer: false,
    }
  }
  return {
    status: 'stale',
    actions: ['compare', 'reload', 'keep_local'],
    autoOverwrite: false,
    dropBuffer: false,
  }
}

export function applyFileLifecycleToView(
  view: PaneViewInstanceV1,
  decision: FileLifecycleDecisionV1,
): PaneViewInstanceV1 {
  if (decision.status === 'ready') return view
  return {
    ...view,
    status: decision.status === 'conflict' ? 'conflict' : 'stale',
    stale: true,
    attention: decision.status === 'conflict' || view.attention,
  }
}

export function fileLifecycleAutoOverwrite(): false {
  return false
}

export function fileLifecycleDropsBuffer(): false {
  return false
}
