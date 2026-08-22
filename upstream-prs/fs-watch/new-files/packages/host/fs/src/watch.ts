/**
 * Proposed DSH FileWatchCapabilityV1.
 *
 * This file is a contract sketch for an upstream PR. It must not run in the
 * Yeisme monorepo. Absolute paths, file:// URLs, and credentials stay on the
 * Host side of the watch handle.
 */

export const FILE_WATCH_CAPABILITY = 'FileWatchCapabilityV1' as const

export type FileWatchOp = 'created' | 'changed' | 'deleted' | 'renamed'

export interface FileWatchEventV1 {
  readonly cursor: string
  readonly sequence: number
  readonly op: FileWatchOp
  readonly entryRef: string
  readonly parentRef?: string
  readonly occurredAt: string
}

export interface FileWatchHandle {
  readonly capability: typeof FILE_WATCH_CAPABILITY
  subscribe(listener: (event: FileWatchEventV1) => void): () => void
  snapshotCursor(): string
}

export interface FileWatchSource {
  readonly capabilities?: readonly string[]
  watch?(parentRef?: string): FileWatchHandle
}

export function hasFileWatchCapability(source: FileWatchSource | undefined): boolean {
  return source?.capabilities?.includes(FILE_WATCH_CAPABILITY) === true && typeof source.watch === 'function'
}
