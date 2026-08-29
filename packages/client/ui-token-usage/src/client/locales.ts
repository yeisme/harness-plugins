/**
 * Token usage panel locale tables (zh/en).
 *
 * @module @yeisme/dsh-client-ui-token-usage/client/locales
 */

export type TokenUsageKey =
  | 'panel.title'
  | 'panel.subtitle'
  | 'window.session'
  | 'window.today'
  | 'window.week'
  | 'window.process'
  | 'section.sessions'
  | 'section.providers'
  | 'balance.title'
  | 'balance.refresh'
  | 'balance.refreshing'
  | 'balance.stale'
  | 'balance.unavailable'
  | 'empty.usage'
  | 'empty.sessions'
  | 'truncated'
  | 'generatedAt'
  | 'entry.open'
  | 'entry.disabledReason'
  | 'overlay.close'

export const NS = 'dsh-client-ui-token-usage' as const

export const en: Readonly<Record<TokenUsageKey, string>> = {
  'panel.title': 'Tokens',
  'panel.subtitle': 'Usage since process start',
  'window.session': 'Session',
  'window.today': 'Today',
  'window.week': 'Week',
  'window.process': 'Process',
  'section.sessions': 'By session',
  'section.providers': 'By provider',
  'balance.title': 'DeepSeek balance',
  'balance.refresh': 'Refresh',
  'balance.refreshing': 'Refreshing…',
  'balance.stale': 'stale',
  'balance.unavailable': 'Balance unavailable',
  'empty.usage': 'Usage is unavailable in this version.',
  'empty.sessions': 'No sessions have reported usage yet.',
  'truncated': 'Showing the 20 most recent sessions.',
  'generatedAt': 'Updated',
  'entry.open': 'Tokens',
  'entry.disabledReason': 'Token usage host is unavailable',
  'overlay.close': 'Close',
}

export const zh: Readonly<Record<TokenUsageKey, string>> = {
  'panel.title': 'Tokens',
  'panel.subtitle': '自进程启动以来的用量',
  'window.session': '当前会话',
  'window.today': '今日',
  'window.week': '本周',
  'window.process': '进程',
  'section.sessions': '按会话',
  'section.providers': '按提供方',
  'balance.title': 'DeepSeek 余额',
  'balance.refresh': '刷新',
  'balance.refreshing': '刷新中…',
  'balance.stale': '已过期',
  'balance.unavailable': '余额不可用',
  'empty.usage': '此版本未提供用量数据。',
  'empty.sessions': '尚无会话上报用量。',
  'truncated': '仅显示最近 20 个会话。',
  'generatedAt': '更新于',
  'entry.open': 'Tokens',
  'entry.disabledReason': 'Token 用量 Host 不可用',
  'overlay.close': '关闭',
}

export type TokenUsageTranslator = (key: TokenUsageKey) => string
