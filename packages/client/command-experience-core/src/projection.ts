/**
 * Bounded list projection with stable keys and selection anchors.
 *
 * Capability refresh must keep the selected key, never jump to a neighbor.
 */

export interface ProjectableItem {
  readonly key: string;
}

export interface BoundedProjection<T extends ProjectableItem> {
  readonly items: readonly T[];
  readonly startIndex: number;
  readonly endIndex: number;
  readonly selectedKey: string | null;
  readonly selectedIndex: number;
  readonly total: number;
  readonly virtualized: boolean;
}

export interface ProjectionOptions {
  readonly windowSize?: number;
  readonly selectedKey?: string | null;
}

export function commandStableKey(canonicalName: string): string {
  return `cmd:${canonicalName.trim().toLowerCase()}`;
}

export function selectorStableKey(kind: string, ref: string): string {
  return `${kind}:${ref}`;
}

/**
 * Project a bounded window around the selected key.
 * If the selected key disappears, selection becomes empty (stale) instead
 * of snapping to a neighbor.
 */
export function projectBoundedWindow<T extends ProjectableItem>(
  items: readonly T[],
  options: ProjectionOptions = {},
): BoundedProjection<T> {
  const windowSize = Math.max(1, options.windowSize ?? 40);
  const selectedKey = options.selectedKey ?? null;
  const selectedIndex = selectedKey === null
    ? -1
    : items.findIndex((item) => item.key === selectedKey);

  const virtualized = items.length > windowSize;
  if (!virtualized) {
    return {
      items: [...items],
      startIndex: 0,
      endIndex: items.length,
      selectedKey: selectedIndex >= 0 ? selectedKey : null,
      selectedIndex,
      total: items.length,
      virtualized: false,
    };
  }

  const anchor = selectedIndex >= 0 ? selectedIndex : 0;
  const half = Math.floor(windowSize / 2);
  let startIndex = Math.max(0, anchor - half);
  let endIndex = Math.min(items.length, startIndex + windowSize);
  startIndex = Math.max(0, endIndex - windowSize);

  return {
    items: items.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    selectedKey: selectedIndex >= 0 ? selectedKey : null,
    selectedIndex,
    total: items.length,
    virtualized: true,
  };
}

/**
 * Keep the previous selected key across a catalog refresh.
 * Returns null when the key is gone so callers can mark stale.
 */
export function retainSelectionAnchor(
  previousKey: string | null,
  nextKeys: readonly string[],
): { readonly key: string | null; readonly jumpedToNeighbor: false } {
  if (previousKey !== null && nextKeys.includes(previousKey)) {
    return { key: previousKey, jumpedToNeighbor: false };
  }
  return { key: null, jumpedToNeighbor: false };
}
