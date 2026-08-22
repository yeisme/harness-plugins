type Listener = () => void

export function createSnapshotStore<T>(initial: T) {
  let snapshot = initial
  const listeners = new Set<Listener>()
  return {
    getSnapshot: (): T => snapshot,
    set(next: T): void {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
