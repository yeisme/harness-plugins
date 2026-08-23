/**
 * @yeisme/dsh-session-tags bundle client face。
 *
 * 直接 re-export Client 包的 probe-gated apply：缺 `ctx.sessionGroupings`
 * seam 时不注册任何 provider/slot（诚实降级），seam 存在时注册
 * `yeisme.session-tags` provider 与 shell.overlay 标签编辑器。
 *
 * @module @yeisme/dsh-session-tags/client
 */

export { apply, inject, name } from '@yeisme/dsh-client-ui-session-tags/client'
