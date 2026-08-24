/** Browser 侧仅消费的 Ordo 安全投影 wire type；它不声明或拥有任何 canonical facts。 */

import type {
  OrdoAgentOpsSnapshot as HostOrdoAgentOpsSnapshot,
  OrdoAgentOpsActionDescriptor,
} from '../host/types.ts'

/** Host Remote 已校验、可跨 browser boundary 使用的 projection。 */
export type OrdoAgentOpsSnapshot = HostOrdoAgentOpsSnapshot

/** Host 已验证的 action descriptor，可用于 browser 侧渲染。 */
export type { OrdoAgentOpsActionDescriptor }
