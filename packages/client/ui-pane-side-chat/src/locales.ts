/**
 * Side chat 的 locale 表（zh/en）。
 *
 * @module @yeisme/dsh-client-ui-pane-side-chat/locales
 */

export const SIDE_CHAT_NS = 'yeisme.dsh-side-chat'

export type SideChatKey =
  | 'title'
  | 'picker.label'
  | 'picker.placeholder'
  | 'action.new'
  | 'action.new.unavailable'
  | 'action.fork'
  | 'action.detach'
  | 'state.unresolvable'
  | 'state.removed'
  | 'composer.placeholder'
  | 'composer.send'
  | 'composer.steer'
  | 'composer.queue'
  | 'composer.sending'
  | 'action.cancel'
  | 'action.older'
  | 'action.older.loading'
  | 'queue.count'
  | 'node.tool'
  | 'node.error'
  | 'node.unknown'
  | 'empty.body'

export const sideChatEn: Readonly<Record<SideChatKey, string>> = {
  'title': 'Side chat',
  'picker.label': 'Session',
  'picker.placeholder': 'Pick a session…',
  'action.new': 'New session',
  'action.new.unavailable': 'New session is unavailable on this runtime (no sessions.create); use fork or attach instead.',
  'action.fork': 'Fork current',
  'action.detach': 'Detach',
  'state.unresolvable': 'This session cannot be attached for side chat (not listed and not scoped).',
  'state.removed': 'This session was removed on the host. Input is disabled.',
  'composer.placeholder': 'Message this session…',
  'composer.send': 'Send',
  'composer.steer': 'Running — will steer',
  'composer.queue': 'Running — will queue',
  'composer.sending': 'Sending…',
  'action.cancel': 'Stop',
  'action.older': 'Load earlier messages',
  'action.older.loading': 'Loading…',
  'queue.count': '{count} queued',
  'node.tool': 'tool {name}',
  'node.error': 'turn error',
  'node.unknown': '{kind}',
  'empty.body': 'Attach an existing session, start a new one, or fork the current conversation — the main chat area stays untouched.',
}

export const sideChatZh: Readonly<Record<SideChatKey, string>> = {
  'title': '侧边对话',
  'picker.label': '会话',
  'picker.placeholder': '选择一个会话…',
  'action.new': '新建会话',
  'action.new.unavailable': '当前 runtime 不支持新建（缺少 sessions.create）；可改用 fork 或附着既有会话。',
  'action.fork': '从当前 fork',
  'action.detach': '取消附着',
  'state.unresolvable': '该会话无法附着为侧边对话（既不在列表也未 scope）。',
  'state.removed': '该会话已在宿主侧移除，输入已禁用。',
  'composer.placeholder': '向该会话发送消息…',
  'composer.send': '发送',
  'composer.steer': '运行中——将转向',
  'composer.queue': '运行中——将排队',
  'composer.sending': '发送中…',
  'action.cancel': '停止',
  'action.older': '加载更早消息',
  'action.older.loading': '加载中…',
  'queue.count': '排队 {count} 条',
  'node.tool': '工具 {name}',
  'node.error': '回合出错',
  'node.unknown': '{kind}',
  'empty.body': '附着既有会话、新建会话，或从当前对话 fork——主对话区不受影响。',
}

export type SideChatTranslator = (key: SideChatKey, params?: Readonly<Record<string, string | number>>) => string

export function interpolate(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (
    name in params ? String(params[name]) : match
  ))
}

/** 无 locale 服务时的回退翻译器。 */
export function fallbackSideChatTranslator(): SideChatTranslator {
  return (key, params) => interpolate(sideChatEn[key], params)
}
