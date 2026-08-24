export interface VirtualWindowV1<T> {
  readonly start: number
  readonly end: number
  readonly offset: number
  readonly height: number
  readonly items: readonly T[]
  readonly total: number
}

export const VIRTUAL_OVERSCAN_DEFAULT = 8

/** Bounded visible slice. Large trees and change lists share this window. */
export function windowVirtualRows<T>(
  rows: readonly T[],
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  overscan = VIRTUAL_OVERSCAN_DEFAULT,
): VirtualWindowV1<T> {
  const total = rows.length
  const height = Math.max(0, rowHeight)
  const view = Math.max(1, viewportHeight)
  if (total === 0 || height === 0) {
    return { start: 0, end: 0, offset: 0, height: 0, items: [], total }
  }
  const rawStart = Math.floor(Math.max(0, scrollTop) / height)
  const start = Math.max(0, rawStart - overscan)
  const visible = Math.ceil(view / height) + overscan * 2
  const end = Math.min(total, start + visible)
  return {
    start,
    end,
    offset: start * height,
    height: total * height,
    items: rows.slice(start, end),
    total,
  }
}
