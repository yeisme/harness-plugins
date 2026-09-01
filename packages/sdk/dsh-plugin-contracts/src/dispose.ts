/**
 * Dispose/订阅合同（G18 §6）：mount/unmount/HMR 循环的统一释放形状。
 * 观测门（dispose-hmr-conformance）以本合同为对称性参照。
 */

/** 具名释放面：幂等（重复调用 no-op），与 V3 7.5 disposal 验证语义一致 */
export interface Disposable {
  dispose(): void
}

/** 释放回调：订阅/注册返回的取消函数 */
export type Disposer = () => void

/** 订阅面：返回取消订阅（与 DomainOwnerSourceService.subscribe 等形状一致） */
export interface SubscribeFace<Event> {
  subscribe(listener: (event: Event) => void): Disposer
}

/**
 * 组合多个 disposer 为单个幂等 disposer：首次调用依序释放全部，
 * 再次调用 no-op。用于 mount 点一次性挂多资源、unmount 一键收口。
 */
export function composeDisposers(...disposers: Disposer[]): Disposer {
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    for (const disposer of disposers) disposer()
  }
}

/**
 * 单个订阅的具名释放句柄（G21）：dispose-hmr-conformance 观测门要求
 * 「acquire 处可见 release」——订阅点经 subscriptionHandle() 取得句柄，
 * 释放点显式 handle.unsubscribe()，释放路径在订阅所在文件内可见，
 * 而不是只存在于裸回调转发里。幂等语义与 Disposable 一致。
 */
export interface SubscriptionHandle extends Disposable {
  unsubscribe(): void
}

/** 把 subscribe 返回的 disposer 收口为幂等的具名 unsubscribe 句柄。 */
export function subscriptionHandle(off: Disposer): SubscriptionHandle {
  let disposed = false
  const unsubscribe = (): void => {
    if (disposed) return
    disposed = true
    off()
  }
  return { unsubscribe, dispose: unsubscribe }
}
