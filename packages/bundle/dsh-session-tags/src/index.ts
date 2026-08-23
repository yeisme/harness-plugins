/**
 * @yeisme/dsh-session-tags bundle root（Host face）。
 *
 * Host 半边直接组合 `@yeisme/dsh-session-tags-host` 插件：打开
 * `yeisme.session-tags.v1` storage domain 并注册 `sessionTags` Typert
 * Remote。bundle 不复制任何包实现——host 行挂载本入口，client 行挂载
 * `./client`。
 *
 * @module @yeisme/dsh-session-tags
 */

import { apply as hostApply, inject as hostInject, name as hostName } from '@yeisme/dsh-session-tags-host'

export const name = hostName
export const inject = hostInject
export { hostApply }

/** Host 生命周期：与 Host 包 apply 相同（打开 domain + 注册 Remote）。 */
export const apply = hostApply

const DshSessionTagsPlugin = { name, inject, apply }
export default DshSessionTagsPlugin
