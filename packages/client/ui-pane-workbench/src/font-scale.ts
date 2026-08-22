/** Unified workbench font size: 12–18px, stored in localStorage. */

export const WORKBENCH_FONT_SIZE_MIN = 12
export const WORKBENCH_FONT_SIZE_MAX = 18
export const WORKBENCH_FONT_SIZE_DEFAULT = 14
export const WORKBENCH_FONT_SIZE_STORAGE_KEY = 'dsh-wb-font-size'
export const WORKBENCH_FONT_SIZE_VAR = '--dsh-wb-font-size'

const listeners = new Set<(size: number) => void>()
let cached: number | undefined

function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return WORKBENCH_FONT_SIZE_DEFAULT
  return Math.min(WORKBENCH_FONT_SIZE_MAX, Math.max(WORKBENCH_FONT_SIZE_MIN, Math.round(value)))
}

function storage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return undefined
    return localStorage
  } catch {
    return undefined
  }
}

function readStoredFontSize(): number {
  const store = storage()
  if (store === undefined) return WORKBENCH_FONT_SIZE_DEFAULT
  try {
    const raw = store.getItem(WORKBENCH_FONT_SIZE_STORAGE_KEY)
    if (raw === null) return WORKBENCH_FONT_SIZE_DEFAULT
    return clampFontSize(Number(raw))
  } catch {
    return WORKBENCH_FONT_SIZE_DEFAULT
  }
}

export function getWorkbenchFontSize(): number {
  if (cached === undefined) cached = readStoredFontSize()
  return cached
}

export function setWorkbenchFontSize(size: number): number {
  const next = clampFontSize(size)
  cached = next
  try { storage()?.setItem(WORKBENCH_FONT_SIZE_STORAGE_KEY, String(next)) } catch { /* ignore quota */ }
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(WORKBENCH_FONT_SIZE_VAR, `${next}px`)
  }
  for (const listener of listeners) listener(next)
  return next
}

export function stepWorkbenchFontSize(delta: -1 | 1): number {
  return setWorkbenchFontSize(getWorkbenchFontSize() + delta)
}

export function subscribeWorkbenchFontSize(listener: (size: number) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function applyWorkbenchFontSizeTo(element: HTMLElement | null | undefined, size = getWorkbenchFontSize()): void {
  element?.style.setProperty(WORKBENCH_FONT_SIZE_VAR, `${size}px`)
}
