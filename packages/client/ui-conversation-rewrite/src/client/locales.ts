/** Conversation rewrite 插件的本地化字符串。 */

export const NS = 'conversationRewrite'

export const zh = {
  'retry.trigger': '重试',
  'retry.loading': '重试中…',
  'retry.error': '重试失败',
  'retry.disabled.notFound': '无法定位该回答对应的用户消息',
  'retry.disabled.notText': '仅支持文本内容重试',
  'retry.disabled.running': '该轮次仍在运行，暂不可重试',
  'retry.disabled.firstRound': '首轮消息重试尚未启用',
  'retry.disabled.removed': '会话已关闭，无法重试',
  'edit.trigger': '编辑',
  'edit.save': '保存',
  'edit.cancel': '取消',
  'edit.saving': '保存中…',
  'edit.error': '保存失败',
  'edit.empty': '消息内容不能为空',
  'edit.placeholder': '编辑消息…',
  'edit.hint': '保存后将创建新分支，原对话保留。',
  'edit.disabled.notFound': '无法定位该用户消息',
  'edit.disabled.notText': '仅支持纯文本消息编辑',
  'edit.disabled.running': '该轮次仍在运行，暂不可编辑',
  'edit.disabled.firstRound': '首轮消息编辑尚未启用',
  'edit.disabled.removed': '会话已关闭，无法编辑',
} satisfies Record<string, string>

export type ConversationRewriteKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    conversationRewrite: ConversationRewriteKey
  }
}

export const en = {
  'retry.trigger': 'Retry',
  'retry.loading': 'Retrying…',
  'retry.error': 'Retry failed',
  'retry.disabled.notFound': 'Cannot locate the user message for this answer',
  'retry.disabled.notText': 'Only text prompts can be retried',
  'retry.disabled.running': 'This turn is still running',
  'retry.disabled.firstRound': 'First-message retry is not enabled yet',
  'retry.disabled.removed': 'Session is closed',
  'edit.trigger': 'Edit',
  'edit.save': 'Save',
  'edit.cancel': 'Cancel',
  'edit.saving': 'Saving…',
  'edit.error': 'Save failed',
  'edit.empty': 'Message cannot be empty',
  'edit.placeholder': 'Edit message…',
  'edit.hint': 'Saving creates a new branch; the original conversation is kept.',
  'edit.disabled.notFound': 'Cannot locate this user message',
  'edit.disabled.notText': 'Only plain-text messages can be edited',
  'edit.disabled.running': 'This turn is still running',
  'edit.disabled.firstRound': 'First-message editing is not enabled yet',
  'edit.disabled.removed': 'Session is closed',
} satisfies Record<ConversationRewriteKey, string>
