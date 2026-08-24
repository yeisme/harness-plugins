/** sidebar 值班摘要的本地化字符串。 */

export const NS = 'ordoAgentOps'

export const zh = {
  'panel.title': 'Agent Ops',
  'panel.trigger': 'Agent Ops',
  'panel.aria': 'Agent Ops 值班摘要',
  'panel.loading': '读取 Ordo 投影…',
  'panel.cold': '尚未读取',
  'panel.error': '读取失败：{code}',
  'panel.needsContract': '等待 Ordo owner read contract',
  'panel.needsContractDetail': '当前 DSH 只安装了安全适配层，Ordo owner projection 尚未挂载。',
  'panel.ready': '投影已就绪',
  'panel.stale': '投影已过期',
  'panel.offline': 'owner 不可达',
  'panel.permissionDenied': '无权读取',
  'panel.contractMismatch': '合同不匹配',
  'panel.refresh': '刷新投影',
  'panel.openStudio': '在 Workbench 打开',
  'panel.openStudioUnavailable': 'Workbench deep link 尚未接入',
  'panel.noRun': '当前没有安全 run 摘要',
  'panel.capacity': '容量：{observed}/{policy}',
  'panel.capacityUnreserved': '尚无持久 reservation',
  'panel.actionsTitle': '待处理动作',
  'panel.viewAllActions': '查看全部动作',
  'panel.actionReconcile': '协调',
  'panel.actionApprove': '批准',
  'panel.actionLaunch': '启动',
  'panel.actionUnknown': '未知动作',
  'panel.actionExpired': '已过期',
  'panel.actionTarget': '目标',
  'panel.actionExpires': '过期时间',
} satisfies Record<string, string>

export type OrdoAgentOpsKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    ordoAgentOps: OrdoAgentOpsKey
  }
}

export const en = {
  'panel.title': 'Agent Ops',
  'panel.trigger': 'Agent Ops',
  'panel.aria': 'Agent Ops duty summary',
  'panel.loading': 'Reading the Ordo projection…',
  'panel.cold': 'Not read yet',
  'panel.error': 'Read failed: {code}',
  'panel.needsContract': 'Waiting for the Ordo owner read contract',
  'panel.needsContractDetail': 'This DSH runtime has the safe adapter, but no Ordo owner projection is mounted.',
  'panel.ready': 'Projection ready',
  'panel.stale': 'Projection stale',
  'panel.offline': 'Owner unavailable',
  'panel.permissionDenied': 'Read permission denied',
  'panel.contractMismatch': 'Contract mismatch',
  'panel.refresh': 'Refresh projection',
  'panel.openStudio': 'Open in Workbench',
  'panel.openStudioUnavailable': 'Workbench deep link is not connected',
  'panel.noRun': 'No safe run summary is available',
  'panel.capacity': 'Capacity: {observed}/{policy}',
  'panel.capacityUnreserved': 'No durable reservation',
  'panel.actionsTitle': 'Pending actions',
  'panel.viewAllActions': 'View all actions',
  'panel.actionReconcile': 'Reconcile',
  'panel.actionApprove': 'Approve',
  'panel.actionLaunch': 'Launch',
  'panel.actionUnknown': 'Unknown action',
  'panel.actionExpired': 'expired',
  'panel.actionTarget': 'Target',
  'panel.actionExpires': 'expires',
} satisfies Record<OrdoAgentOpsKey, string>
