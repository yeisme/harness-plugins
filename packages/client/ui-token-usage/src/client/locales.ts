/**
 * Token usage panel locale tables (zh/en).
 *
 * @module @yeisme/dsh-client-ui-token-usage/client/locales
 */

export type TokenUsageKey =
  | 'panel.title'
  | 'panel.subtitle'
  | 'panel.legacyTag'
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
  | 'balance.idle'
  | 'usage.error.retry'
  | 'empty.usage'
  | 'empty.sessions'
  | 'truncated'
  | 'generatedAt'
  | 'entry.open'
  | 'entry.disabledReason'
  | 'overlay.close'
  | 'insights.title'
  | 'insights.scope.session'
  | 'insights.scope.run'
  | 'insights.scope.range'
  | 'insights.scope.apply'
  | 'insights.scope.runRef'
  | 'insights.scope.from'
  | 'insights.scope.to'
  | 'insights.refresh'
  | 'insights.refreshing'
  | 'insights.manualRefresh'
  | 'insights.freshness.stale'
  | 'insights.freshness.unknown'
  | 'insights.coverage.complete'
  | 'insights.coverage.partial'
  | 'insights.coverage.unknown'
  | 'insights.section.overview'
  | 'insights.section.composition'
  | 'insights.section.models'
  | 'insights.section.providers'
  | 'insights.section.context'
  | 'insights.section.requests'
  | 'insights.section.account'
  | 'insights.metric.requests'
  | 'insights.metric.total'
  | 'insights.metric.output'
  | 'insights.metric.cacheRead'
  | 'insights.metric.wallClock'
  | 'insights.metric.sumDuration'
  | 'insights.bucket.uncachedInput'
  | 'insights.bucket.output'
  | 'insights.bucket.cacheRead'
  | 'insights.bucket.cacheWrite'
  | 'insights.context.used'
  | 'insights.context.limit'
  | 'insights.context.remaining'
  | 'insights.breakdownTruncated'
  | 'insights.empty.confirmed'
  | 'insights.loadMore'
  | 'insights.loadingMore'
  | 'insights.staleCursor'
  | 'insights.rereadFirstPage'
  | 'insights.trajectory.locate'
  | 'insights.trajectory.unavailable'
  | 'insights.request.status.completed'
  | 'insights.request.status.cancelled'
  | 'insights.request.status.failed'
  | 'insights.request.status.unknown'
  | 'insights.account.costs'
  | 'insights.pane.noSession'
  | 'insights.target.switch'
  | 'insights.target.directory.title'
  | 'insights.target.directory.unavailable'
  | 'insights.target.directory.loading'
  | 'insights.target.directory.error'
  | 'insights.target.directory.empty'
  | 'insights.target.directory.use'
  | 'insights.target.directory.bound'
  | 'insights.target.directory.running'
  | 'insights.target.directory.prev'
  | 'insights.target.directory.next'
  | 'insights.target.directory.pageOf'
  | 'insights.target.directory.refresh'

export const NS = 'dsh-client-ui-token-usage' as const

export const en: Readonly<Record<TokenUsageKey, string>> = {
  'panel.title': 'Tokens',
  'panel.subtitle': 'Usage since process start',
  'panel.legacyTag': 'Legacy process-observed statistics',
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
  'balance.idle': 'Balance has not been queried yet.',
  'usage.error.retry': 'Retry',
  'empty.usage': 'Usage is unavailable in this version.',
  'empty.sessions': 'No sessions have reported usage yet.',
  'truncated': 'Showing the 20 most recent sessions.',
  'generatedAt': 'Updated',
  'entry.open': 'Tokens',
  'entry.disabledReason': 'Token usage host is unavailable',
  'overlay.close': 'Close',
  'insights.title': 'Session statistics',
  'insights.scope.session': 'Whole session',
  'insights.scope.run': 'Run',
  'insights.scope.range': 'Range',
  'insights.scope.apply': 'Apply',
  'insights.scope.runRef': 'Run ref',
  'insights.scope.from': 'From (ISO)',
  'insights.scope.to': 'To (ISO)',
  'insights.refresh': 'Refresh',
  'insights.refreshing': 'Refreshing…',
  'insights.manualRefresh': 'This host has no live subscription; refresh manually.',
  'insights.freshness.stale': 'stale',
  'insights.freshness.unknown': 'unknown freshness',
  'insights.coverage.complete': 'complete coverage',
  'insights.coverage.partial': 'partial coverage',
  'insights.coverage.unknown': 'coverage unknown',
  'insights.section.overview': 'Overview',
  'insights.section.composition': 'Usage composition',
  'insights.section.models': 'By model',
  'insights.section.providers': 'By provider',
  'insights.section.context': 'Context',
  'insights.section.requests': 'Requests',
  'insights.section.account': 'Account',
  'insights.metric.requests': 'Requests',
  'insights.metric.total': 'Total tokens',
  'insights.metric.output': 'Output',
  'insights.metric.cacheRead': 'Cache read',
  'insights.metric.wallClock': 'Wall clock',
  'insights.metric.sumDuration': 'Sum of request durations',
  'insights.bucket.uncachedInput': 'Uncached input',
  'insights.bucket.output': 'Output',
  'insights.bucket.cacheRead': 'Cache read',
  'insights.bucket.cacheWrite': 'Cache write',
  'insights.context.used': 'Used',
  'insights.context.limit': 'Limit',
  'insights.context.remaining': 'Remaining',
  'insights.breakdownTruncated': 'Showing the first 50 rows; verified totals still cover everything.',
  'insights.empty.confirmed': 'Confirmed: no requests in this scope.',
  'insights.loadMore': 'Load more',
  'insights.loadingMore': 'Loading…',
  'insights.staleCursor': 'The page cursor went stale; reload the first page.',
  'insights.rereadFirstPage': 'Reload first page',
  'insights.trajectory.locate': 'Locate in trajectory',
  'insights.trajectory.unavailable': 'The trajectory locator seam is not available yet; the statistics view stays put.',
  'insights.request.status.completed': 'completed',
  'insights.request.status.cancelled': 'cancelled',
  'insights.request.status.failed': 'failed',
  'insights.request.status.unknown': 'unknown',
  'insights.account.costs': 'Cost basis',
  'insights.pane.noSession': 'No session is bound to this view; open it via /status tokens or the session catalog.',
  'insights.target.switch': 'Switch statistics target',
  'insights.target.directory.title': 'Session directory',
  'insights.target.directory.unavailable': 'The official session directory seam is unavailable; the target stays pinned to the bound session.',
  'insights.target.directory.loading': 'Loading sessions…',
  'insights.target.directory.error': 'The session directory failed to load.',
  'insights.target.directory.empty': 'No accessible sessions.',
  'insights.target.directory.use': 'Show statistics',
  'insights.target.directory.bound': 'current target',
  'insights.target.directory.running': 'running',
  'insights.target.directory.prev': 'Previous page',
  'insights.target.directory.next': 'Next page',
  'insights.target.directory.pageOf': 'Page',
  'insights.target.directory.refresh': 'Reload directory',
}

export const zh: Readonly<Record<TokenUsageKey, string>> = {
  'panel.title': 'Tokens',
  'panel.subtitle': '自进程启动以来的用量',
  'panel.legacyTag': '旧版进程观察统计',
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
  'balance.idle': '尚未查询余额。',
  'usage.error.retry': '重试',
  'empty.usage': '此版本未提供用量数据。',
  'empty.sessions': '尚无会话上报用量。',
  'truncated': '仅显示最近 20 个会话。',
  'generatedAt': '更新于',
  'entry.open': 'Tokens',
  'entry.disabledReason': 'Token 用量 Host 不可用',
  'overlay.close': '关闭',
  'insights.title': '会话统计',
  'insights.scope.session': '整个会话',
  'insights.scope.run': '单次运行',
  'insights.scope.range': '时间范围',
  'insights.scope.apply': '应用',
  'insights.scope.runRef': 'Run 引用',
  'insights.scope.from': '起（ISO）',
  'insights.scope.to': '止（ISO）',
  'insights.refresh': '刷新',
  'insights.refreshing': '刷新中…',
  'insights.manualRefresh': '此 Host 不支持实时订阅，需要手动刷新。',
  'insights.freshness.stale': '已过期',
  'insights.freshness.unknown': '新鲜度未知',
  'insights.coverage.complete': '覆盖完整',
  'insights.coverage.partial': '覆盖不完整',
  'insights.coverage.unknown': '覆盖范围未知',
  'insights.section.overview': '概览',
  'insights.section.composition': '用量构成',
  'insights.section.models': '按模型',
  'insights.section.providers': '按提供方',
  'insights.section.context': '上下文',
  'insights.section.requests': '请求',
  'insights.section.account': '账户',
  'insights.metric.requests': '请求数',
  'insights.metric.total': '总 Token',
  'insights.metric.output': '输出',
  'insights.metric.cacheRead': '缓存读取',
  'insights.metric.wallClock': '墙钟时长',
  'insights.metric.sumDuration': '请求耗时合计',
  'insights.bucket.uncachedInput': '非缓存输入',
  'insights.bucket.output': '输出',
  'insights.bucket.cacheRead': '缓存读取',
  'insights.bucket.cacheWrite': '缓存写入',
  'insights.context.used': '已用',
  'insights.context.limit': '上限',
  'insights.context.remaining': '剩余',
  'insights.breakdownTruncated': '仅显示前 50 行；已验证总数仍覆盖全部。',
  'insights.empty.confirmed': '已确认该范围内没有请求。',
  'insights.loadMore': '加载更多',
  'insights.loadingMore': '加载中…',
  'insights.staleCursor': '分页游标已过期，请重新读取第一页。',
  'insights.rereadFirstPage': '重读第一页',
  'insights.trajectory.locate': '定位轨迹',
  'insights.trajectory.unavailable': '轨迹定位 seam 尚未可用；统计位置保持不变。',
  'insights.request.status.completed': '已完成',
  'insights.request.status.cancelled': '已取消',
  'insights.request.status.failed': '失败',
  'insights.request.status.unknown': '未知',
  'insights.account.costs': '费用依据',
  'insights.pane.noSession': '此视图未绑定会话；请通过 /status tokens 或会话目录打开。',
  'insights.target.switch': '切换统计对象',
  'insights.target.directory.title': '会话目录',
  'insights.target.directory.unavailable': '官方会话目录不可用；统计对象保持固定绑定在当前会话。',
  'insights.target.directory.loading': '正在加载会话…',
  'insights.target.directory.error': '会话目录加载失败。',
  'insights.target.directory.empty': '没有可访问的会话。',
  'insights.target.directory.use': '统计此会话',
  'insights.target.directory.bound': '当前对象',
  'insights.target.directory.running': '运行中',
  'insights.target.directory.prev': '上一页',
  'insights.target.directory.next': '下一页',
  'insights.target.directory.pageOf': '页码',
  'insights.target.directory.refresh': '重新加载目录',
}

export type TokenUsageTranslator = (key: TokenUsageKey) => string
