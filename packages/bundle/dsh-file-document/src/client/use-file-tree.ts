/**
 * On-demand file tree loading hook.
 *
 * The hook starts in `idle` and only calls the Host adapter when `enabled` is
 * true. This keeps directory listing traffic tied to workbench usage.
 *
 * @module @yeisme/dsh-file-document/client/use-file-tree
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileEntryV1 } from '../types.ts'
import type { FileTreeHostAdapter } from '../file-tree-host.ts'

export type FileTreeLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface UseFileTreeResult {
  readonly status: FileTreeLoadStatus
  readonly entries: readonly FileEntryV1[]
  readonly error: string | undefined
  readonly retry: () => void
  readonly loadChildren: (entry: FileEntryV1) => Promise<void>
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name !== 'AbortError') return error.message
  return 'Failed to load file tree.'
}

/**
 * Load the root directory when `enabled` becomes true and expose a
 * `loadChildren` callback for expanding directories on demand.
 */
export function useFileTree(
  adapter: FileTreeHostAdapter | undefined,
  rootPath: string | undefined,
  enabled: boolean,
): UseFileTreeResult {
  const [status, setStatus] = useState<FileTreeLoadStatus>('idle')
  const [entries, setEntries] = useState<readonly FileEntryV1[]>([])
  const [error, setError] = useState<string>()
  const [generation, setGeneration] = useState(0)
  const adapterRef = useRef(adapter)
  adapterRef.current = adapter

  useEffect(() => {
    if (!enabled || adapter === undefined) {
      setStatus('idle')
      setEntries([])
      setError(undefined)
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    setError(undefined)
    void adapter.listEntries(rootPath === undefined ? {} : { path: rootPath }, controller.signal).then(
      next => {
        setEntries(next)
        setStatus('ready')
      },
      reason => {
        if (controller.signal.aborted) return
        setStatus('error')
        setError(errorMessage(reason))
      },
    )
    return () => controller.abort()
  }, [adapter, rootPath, enabled, generation])

  const retry = useCallback(() => setGeneration(value => value + 1), [])

  const loadChildren = useCallback(async (entry: FileEntryV1): Promise<void> => {
    const current = adapterRef.current
    if (current === undefined) return
    const path = current.resolvePath(entry.id)
    if (path === undefined) return
    const children = await current.listEntries({ path, parentId: entry.id })
    setEntries(previous => {
      const seen = new Set(previous.map(item => item.id))
      const merged = [...previous]
      for (const child of children) {
        if (!seen.has(child.id)) {
          merged.push(child)
          seen.add(child.id)
        }
      }
      return merged
    })
  }, [])

  return { status, entries, error, retry, loadChildren }
}
