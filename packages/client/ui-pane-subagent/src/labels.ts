export const subagentZh = {
  title: '子 Agent', scope: '当前会话', tree: '执行树', search: '搜索子 Agent', filter: '状态筛选', all: '全部', active: '运行中', attention: '需关注',
  refresh: '刷新', noSession: '未选择会话', noSessionHint: '选择一个主会话后，这里会显示它实际启动的子 Agent。',
  empty: '当前会话还没有子 Agent', emptyHint: '通过 DSH 的 subagent 工具启动后，这里会显示真实运行状态、耗时和 token。',
  noMatch: '没有匹配的子 Agent', selectHint: '选择子 Agent 查看详情', detailHint: '查看父子关系、用量与最近记录，或并排跟进。',
  continuable: '可继续', once: '单次', open: '打开', main: '在主会话打开', alongside: '并排打开', alongsideHint: '并排查看，不切换主会话', alongsideMissing: '当前宿主未提供并排会话能力',
  expand: '展开', collapse: '折叠', back: '返回列表', parent: '父会话', duration: '已报告耗时', usage: '已报告用量', input: '输入', output: '输出', cache: '缓存读／写',
  recent: '查看最近记录', stop: '停止', followup: '后续消息', send: '发送', sent: '已发送', stopRequested: '已请求停止', read: '最近记录已读取', failedAction: '操作失败，请核对会话', unknownAction: '操作结果未知，请核对会话',
  apiMissing: '当前宿主未提供子会话管理接口', stale: '目录尚未确认，刷新后再操作', loading: '正在读取子会话目录', count: '个子 Agent', inactiveCount: '非活动',
  running: '运行中', idle: '空闲', ready: '就绪', inactive: '未活动', unknown: '未知', completed: '已完成', failed: '失败', cancelled: '已取消', interrupted: '已中断',
} as const
export const subagentEn: Record<keyof typeof subagentZh, string> = {
  title: 'Subagents', scope: 'This session', tree: 'Execution tree', search: 'Search subagents', filter: 'Filter status', all: 'All', active: 'Running', attention: 'Needs attention',
  refresh: 'Refresh', noSession: 'No session selected', noSessionHint: 'Select a session to inspect its actual child agents.', empty: 'This session has no child agents', emptyHint: 'Agents started with the DSH subagent tool appear here with reported state, duration and usage.',
  noMatch: 'No matching subagents', selectHint: 'Select a subagent', detailHint: 'Inspect relationships, usage and recent records, or open the conversation alongside.', continuable: 'Continuable', once: 'One-shot', open: 'Open', main: 'Open in main conversation', alongside: 'Open alongside', alongsideHint: 'Open alongside without changing the main conversation', alongsideMissing: 'Side conversation capability is unavailable',
  expand: 'Expand', collapse: 'Collapse', back: 'Back to list', parent: 'Parent session', duration: 'Reported duration', usage: 'Reported usage', input: 'Input', output: 'Output', cache: 'Cache read / write', recent: 'Recent records', stop: 'Stop', followup: 'Follow-up message', send: 'Send', sent: 'Sent', stopRequested: 'Stop requested', read: 'Recent records loaded', failedAction: 'Action failed. Check the conversation.', unknownAction: 'Outcome unknown. Check the conversation.', apiMissing: 'Subagent management API is unavailable', stale: 'Catalog is unconfirmed. Refresh before acting.', loading: 'Loading subagent catalog', count: 'subagents', inactiveCount: 'inactive',
  running: 'Running', idle: 'Idle', ready: 'Ready', inactive: 'Inactive', unknown: 'Unknown', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted',
}
export type SubagentTranslate = (key: keyof typeof subagentZh) => string
export const defaultSubagentText: SubagentTranslate = key => subagentZh[key]
