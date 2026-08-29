/**
 * @yeisme/dsh-interaction-space browser entry.
 *
 * 再导出 client 插件包的浏览器面；本 bundle 自身不新增逻辑。
 *
 * @module @yeisme/dsh-interaction-space/client
 */

import { apply, inject, name } from '@yeisme/dsh-client-ui-interaction-space/client'

export { apply, inject, name }

const DshInteractionSpaceClientPlugin = { apply, inject, name }
export default DshInteractionSpaceClientPlugin
