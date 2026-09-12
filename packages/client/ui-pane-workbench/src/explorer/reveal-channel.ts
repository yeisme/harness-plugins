import type { ExplorerRuntimeV2 } from './runtime.js'

export interface ExplorerRevealRequest {
  readonly ref: string
  readonly version: string
  readonly runtime: ExplorerRuntimeV2
  readonly signal: AbortSignal
  readonly isActive: () => boolean
}

/** One transient navigation per controller; no domain state or serialized payloads. */
export function createExplorerRevealChannel() {
  let current: ExplorerRevealRequest | undefined
  let settle: ((ok: boolean) => void) | undefined
  let abort: (() => void) | undefined
  let detachPending: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let guard: (() => boolean) | undefined
  const listeners = new Set<() => void>()
  const emit = () => { for (const listener of listeners) listener() }
  const cancel = () => {
    if (!current) return
    current = undefined
    clearTimeout(timer); timer = undefined
    detachPending?.(); detachPending = undefined
    abort?.(); abort = undefined
    settle?.(false); settle = undefined
    emit()
  }
  return {
    getSnapshot: () => current,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    canNavigate: () => guard?.() !== false,
    setNavigationGuard(check: () => boolean) { guard = check; return () => { if (guard === check) guard = undefined } },
    request(input: Omit<ExplorerRevealRequest, 'signal'>, signal?: AbortSignal, pendingSignal?: AbortSignal): Promise<boolean> {
      if (guard?.() === false) return Promise.resolve(false)
      if (!input.ref || input.ref.length > 2048 || !input.version || input.version.length > 256 || signal?.aborted || pendingSignal?.aborted || !input.runtime.revealResource || !input.isActive()) return Promise.resolve(false)
      cancel()
      const controller = new AbortController()
      current = { ...input, signal: controller.signal }
      const result = new Promise<boolean>(resolve => { settle = resolve })
      signal?.addEventListener('abort', cancel, { once: true })
      pendingSignal?.addEventListener('abort', cancel, { once: true })
      detachPending = () => pendingSignal?.removeEventListener('abort', cancel)
      abort = () => { signal?.removeEventListener('abort', cancel); controller.abort() }
      timer = setTimeout(cancel, 3000)
      emit()
      return result
    },
    isCurrent(request: ExplorerRevealRequest) { return current === request && !request.signal.aborted && request.isActive() },
    acknowledge(request: ExplorerRevealRequest, rendered: boolean): boolean {
      if (current !== request || !settle) return false
      if (!rendered || request.signal.aborted || !request.isActive()) { cancel(); return false }
      clearTimeout(timer); timer = undefined
      detachPending?.(); detachPending = undefined
      settle(true); settle = undefined
      // Retain only this accepted location until navigation or owner cancellation.
      return true
    },
    cancel,
  }
}
