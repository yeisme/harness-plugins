/**
 * Refcounted per-workspace file watchers for the yeisme-files owner
 * (dsh-explorer-live-watch-v1). One chokidar instance per canonical
 * workspace root: created on the first subscriber, closed when the last
 * subscriber leaves — no subscribers, no filesystem watcher. Events are
 * mapped onto `FileWatchEventV1` with opaque refs minted through the shared
 * `OpaqueFileRefRegistry` (deterministic, so a watched path and its later
 * tree listing resolve to the same ref). Absolute paths never leave this
 * module. Sequences are monotonic per workspace for the whole registry
 * lifetime (they survive watcher restarts so clients never see a sequence
 * reset); the replay buffer resets per watcher generation.
 *
 * @module @yeisme/dsh-file-host/node
 */

import { watch, type FSWatcher } from 'chokidar'
import { dirname } from 'node:path'
import { realpath } from 'node:fs/promises'
import type { FileWatchEventV1, FileWatchOp } from './index.js'

/** Mints (or reuses) the opaque record for one watched path. */
export type WatchRefMinter = (workspace: string, target: string, directory: boolean) => { readonly ref: string }

/** Retained events per workspace for `since` replay on reconnect. */
export const WATCH_BUFFER_MAX = 512

/** `.git` internals never reach the tree contract. */
const ALWAYS_IGNORED = /(^|\/)\.git(?:\/|$)/

export interface WorkspaceWatchHandleV1 {
  subscribe(listener: (event: FileWatchEventV1) => void): () => void
  /** Owner-side cursor at call time (`g<generation>:s<sequence>`). */
  snapshotCursor(): string
  /** Buffered events with a sequence beyond the given cursor (replay). */
  eventsSince(cursor: string | undefined): readonly FileWatchEventV1[]
  release(): void
}

interface WorkspaceWatchEntry {
  readonly workspace: string
  watcher: FSWatcher | undefined
  ready: Promise<void> | undefined
  listeners: Set<(event: FileWatchEventV1) => void>
  buffer: readonly FileWatchEventV1[]
  refCount: number
  /** Survives watcher restarts; see module doc. */
  sequence: number
  generation: number
}

export interface WorkspaceWatchRegistry {
  /** Starts (or joins) the workspace watcher; resolves once ready to stream. */
  acquire(cwd: string): Promise<WorkspaceWatchHandleV1>
  /** Hard shutdown for bundle dispose. */
  dispose(): void
  /** Number of workspaces with a live watcher (tests/lifecycle evidence). */
  activeWorkspaces(): number
}

export function createWorkspaceWatchRegistry(mint: WatchRefMinter): WorkspaceWatchRegistry {
  const entries = new Map<string, WorkspaceWatchEntry>()
  // Registry-lifetime sequence per workspace: survives watcher restarts so a
  // reconnecting client never observes a sequence reset (only a gap, which
  // its one-shot reconcile absorbs).
  const sequences = new Map<string, number>()

  const emit = (entry: WorkspaceWatchEntry, op: FileWatchOp, target: string, directory: boolean): void => {
    const parentTarget = dirname(target)
    const parentRef = parentTarget === target ? undefined : mint(entry.workspace, parentTarget, true).ref
    entry.sequence = (sequences.get(entry.workspace) ?? 0) + 1
    sequences.set(entry.workspace, entry.sequence)
    const event: FileWatchEventV1 = {
      cursor: `g${entry.generation}:s${entry.sequence}`,
      sequence: entry.sequence,
      op,
      entryRef: mint(entry.workspace, target, directory).ref,
      ...(parentRef === undefined ? {} : { parentRef }),
      occurredAt: new Date().toISOString(),
    }
    const buffer = [...entry.buffer, event]
    entry.buffer = buffer.length > WATCH_BUFFER_MAX ? buffer.slice(buffer.length - WATCH_BUFFER_MAX) : buffer
    for (const listener of [...entry.listeners]) listener(event)
  }

  const start = async (entry: WorkspaceWatchEntry): Promise<void> => {
    const watcher = watch(entry.workspace, {
      ignoreInitial: true,
      ignored: (path: string) => ALWAYS_IGNORED.test(path) && path !== entry.workspace,
      // SSE subscribers coalesce bursts client-side; keep server pass-through.
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 40 },
    })
    entry.watcher = watcher
    watcher.on('add', path => { emit(entry, 'created', path, false) })
    watcher.on('change', path => { emit(entry, 'changed', path, false) })
    watcher.on('unlink', path => { emit(entry, 'deleted', path, false) })
    watcher.on('addDir', path => { if (path !== entry.workspace) emit(entry, 'created', path, true) })
    watcher.on('unlinkDir', path => { if (path !== entry.workspace) emit(entry, 'deleted', path, true) })
    await new Promise<void>((resolveStart, rejectStart) => {
      watcher.once('ready', resolveStart)
      watcher.once('error', rejectStart)
    })
  }

  const stop = (entry: WorkspaceWatchEntry): void => {
    const watcher = entry.watcher
    entry.watcher = undefined
    entry.ready = undefined
    entry.buffer = []
    entry.generation += 1
    entry.listeners.clear()
    void watcher?.close().catch(() => { /* already closed */ })
  }

  return {
    async acquire(cwd: string) {
      const workspace = await realpath(cwd)
      let existing = entries.get(workspace)
      if (existing === undefined) {
        existing = { workspace, watcher: undefined, ready: undefined, listeners: new Set(), buffer: [], refCount: 0, sequence: 0, generation: 1 }
        entries.set(workspace, existing)
      }
      const entry = existing
      entry.refCount += 1
      if (entry.ready === undefined) entry.ready = start(entry)
      let released = false
      try {
        await entry.ready
      } catch (caught) {
        // Watcher startup failed (permission, vanished workspace): fail the
        // acquire honestly and drop this reference.
        entry.refCount -= 1
        if (entry.refCount <= 0) { stop(entry); entries.delete(workspace) }
        throw caught instanceof Error ? caught : new Error('workspace watcher failed to start')
      }
      const handle: WorkspaceWatchHandleV1 = {
        subscribe(listener) {
          if (released) return () => {}
          entry.listeners.add(listener)
          return () => { entry.listeners.delete(listener) }
        },
        snapshotCursor: () => `g${entry.generation}:s${entry.sequence}`,
        eventsSince: cursor => {
          // Unknown/garbage cursor = fresh client: replay nothing and let the
          // first live event trigger the client's one-shot gap reconcile.
          const match = /^g\d+:s(\d+)$/.exec(cursor ?? '')
          if (match === null) return []
          const sequence = Number(match[1])
          return entry.buffer.filter(event => event.sequence > sequence)
        },
        release() {
          if (released) return
          released = true
          entry.refCount -= 1
          if (entry.refCount <= 0) {
            stop(entry)
            entries.delete(workspace)
          }
        },
      }
      return handle
    },
    dispose() {
      for (const entry of [...entries.values()]) stop(entry)
      entries.clear()
    },
    activeWorkspaces: () => entries.size,
  }
}
