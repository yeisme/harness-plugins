/**
 * @yeisme/dsh-client-ui-pane-side-chat root entry.
 *
 * 侧边对话 client 包：附着/新建/fork session 的 pane 视图与控制器。
 * 数据面全部为官方 client runtime 公开合同（binding/prompt/ConversationSnapshot、
 * fork、可选 create）；主选择不变量见 controller。
 *
 * @module @yeisme/dsh-client-ui-pane-side-chat
 */

export { SideChatController } from './controller.ts'
export type {
  SideChatConversationSnapshot,
  SideChatNodeLike,
  SideChatPhase,
  SideChatSessionBinding,
  SideChatSessionsFace,
  SideChatState,
} from './controller.ts'
export { SideChatView } from './view.tsx'
export {
  SIDE_CHAT_NS,
  fallbackSideChatTranslator,
  interpolate,
  sideChatEn,
  sideChatZh,
} from './locales.ts'
export type { SideChatKey, SideChatTranslator } from './locales.ts'
