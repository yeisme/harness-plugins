/**
 * Session-local media seeds for overlay preview.
 *
 * Chat cards and Explorer adapters write opaque MediaRefV1 values here before
 * `openView({ kind: 'desktop.media' })`. The Desktop Workbench pane reads the
 * same map. Nothing in this store is a URL, path, or credential.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { isMediaRefV1, type MediaRefV1 } from '../host/types.ts'

const seeds = new Map<string, MediaRefV1>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

/** Remember one validated media ref for overlay preview. */
export function seedMediaPreview(media: MediaRefV1): void {
  if (!isMediaRefV1(media)) return
  seeds.set(media.ref, media)
  notify()
}

/** Snapshot of seeded media, newest last. */
export function listSeededMedia(): readonly MediaRefV1[] {
  return [...seeds.values()]
}

/** Subscribe to seed changes. Returns an exact disposer. */
export function subscribeSeededMedia(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Drop every seed. Tests only: the Desktop Workbench pane reads seeds across
 * plugin lifecycles, so plugin dispose deliberately leaves them in place. */
export function clearSeededMedia(): void {
  seeds.clear()
  notify()
}
