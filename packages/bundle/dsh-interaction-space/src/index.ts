/**
 * @yeisme/dsh-interaction-space root entry.
 *
 * Host 面为 no-op re-export：交互空间的读写全部经官方 client services
 * （sessions binding/fork、paneWorkbench 视图注册、conversationEvents
 * `space/ref`）与宿主注入的 composer/owner dispatch adapter。工件的
 * canonical state 与变更鉴权归领域 owner。
 *
 * @module @yeisme/dsh-interaction-space
 */

export const name = 'dsh-interaction-space'
export function apply(): void {}
