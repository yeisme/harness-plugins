/**
 * @yeisme/dsh-side-chat browser entry.
 *
 * 再导出 client 插件包的浏览器面；本 bundle 自身不新增逻辑。
 *
 * @module @yeisme/dsh-side-chat/client
 */

import { apply, inject, name } from '@yeisme/dsh-client-ui-pane-side-chat/client'

export { apply, inject, name }

const DshSideChatClientPlugin = { apply, inject, name }
export default DshSideChatClientPlugin
