export type GitDiffHunkKindV1 = 'add' | 'delete' | 'context' | 'binary'

export interface GitDiffHunkV1 {
  readonly hunkRef: string
  readonly kind: GitDiffHunkKindV1
  readonly header: string
  readonly loaded: boolean
}

export interface GitDiffWindowStateV1 {
  readonly fileRef: string
  readonly loaded: number
  readonly total: number
  readonly baseRevision: string
  readonly targetRevision: string
  readonly currentRevision: string
  readonly nextCursor?: string
  readonly hunks: readonly GitDiffHunkV1[]
  readonly complete: boolean
  readonly binary: boolean
  readonly currentIndex: number
}

export function createGitDiffWindow(input: {
  readonly fileRef: string
  readonly loaded: number
  readonly total: number
  readonly baseRevision: string
  readonly targetRevision: string
  readonly currentRevision: string
  readonly hunks: readonly GitDiffHunkV1[]
  readonly nextCursor?: string
  readonly binary?: boolean
}): GitDiffWindowStateV1 {
  const complete = input.loaded >= input.total && input.nextCursor === undefined
  return {
    fileRef: input.fileRef,
    loaded: input.loaded,
    total: input.total,
    baseRevision: input.baseRevision,
    targetRevision: input.targetRevision,
    currentRevision: input.currentRevision,
    nextCursor: input.nextCursor,
    hunks: input.hunks,
    complete,
    binary: input.binary === true,
    currentIndex: 0,
  }
}

export function gitDiffLooksComplete(window: GitDiffWindowStateV1): boolean {
  return window.complete
}

export function gitDiffUnloadedRangeLooksComplete(window: GitDiffWindowStateV1): false | true {
  return window.loaded < window.total ? false : window.complete
}

export function gitDiffRevisionDrift(window: GitDiffWindowStateV1, expectedRevision: string): boolean {
  return window.currentRevision !== expectedRevision || window.targetRevision !== expectedRevision
}

export function moveGitDiffHunk(window: GitDiffWindowStateV1, direction: 'next' | 'previous'): GitDiffWindowStateV1 {
  const loadedHunks = window.hunks.filter(hunk => hunk.loaded)
  if (loadedHunks.length === 0) return window
  const delta = direction === 'next' ? 1 : -1
  const next = Math.max(0, Math.min(loadedHunks.length - 1, window.currentIndex + delta))
  return { ...window, currentIndex: next }
}

export function gitDiffTargetActionEnabled(window: GitDiffWindowStateV1, hunkRef?: string): boolean {
  if (window.binary || gitDiffRevisionDrift(window, window.targetRevision)) return false
  if (hunkRef === undefined) return window.complete
  const hunk = window.hunks.find(item => item.hunkRef === hunkRef)
  return hunk?.loaded === true
}
