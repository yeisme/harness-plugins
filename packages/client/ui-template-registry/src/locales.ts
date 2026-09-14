/**
 * zh/en/pseudo locale maps for the template-registry panes (task 3.1/3.2).
 * pseudo wraps the English value so layout overflow is testable; no inline
 * English fallback is left in the Chinese face.
 *
 * @module @yeisme/dsh-client-ui-template-registry/locales
 */

import type { TemplateRegistryLocale } from './seam.js'

export interface TemplateRegistryMessages {
  readonly catalogTitle: string
  readonly compileTitle: string
  // catalog pane
  readonly searchLabel: string
  readonly tagFilterLabel: string
  readonly capabilityFilterLabel: string
  readonly allTags: string
  readonly allCapabilities: string
  readonly navFacets: string
  readonly resultsHeading: string
  readonly noMatch: string
  readonly clearFilters: string
  readonly loadingCatalog: string
  readonly registryOffline: string
  readonly registryOfflineHelp: string
  readonly retryProbe: string
  readonly refresh: string
  readonly degradedCatalog: string
  readonly degradedCatalogHelp: string
  readonly registryError: string
  readonly contractMismatch: string
  readonly detailHeading: string
  readonly selectTemplate: string
  readonly detailLoading: string
  readonly detailUnavailable: string
  readonly detailDegraded: string
  readonly maturity: string
  readonly rights: string
  readonly rightsPreview: string
  readonly rightsExport: string
  readonly allowed: string
  readonly denied: string
  readonly license: string
  readonly contractDigest: string
  readonly digest: string
  readonly ref: string
  readonly version: string
  readonly openCompile: string
  readonly previewButton: string
  readonly previewDeniedReason: Record<string, string>
  readonly usage: string
  // compile pane
  readonly compileEmpty: string
  readonly compileEmptyHelp: string
  readonly openCatalog: string
  readonly goalLabel: string
  readonly goalHelp: string
  readonly contractFormHeading: string
  readonly fieldRequired: string
  readonly fieldOptional: string
  readonly startSession: string
  readonly submitFields: string
  readonly missingFieldsHeading: string
  readonly confirmGateHeading: string
  readonly confirmGateHelp: string
  readonly confirmDecisionRef: string
  readonly confirmButton: string
  readonly confirmedBadge: string
  readonly compileButton: string
  readonly compileBusy: string
  readonly compiling: string
  readonly resultCardHeading: string
  readonly providerCallsBadge: string
  readonly exportHeading: string
  readonly exportNameLabel: string
  readonly exportButton: string
  readonly exportBusy: string
  readonly exportedReceipt: string
  readonly exportedAt: string
  readonly outputRef: string
  readonly staleDigest: string
  readonly staleDigestHelp: string
  readonly rePin: string
  readonly sessionStatus: string
  readonly sessionRevision: string
  readonly actionBlocked: string
  readonly resetSession: string
  readonly checkFreshness: string
  readonly busyGeneric: string
}

const zh: TemplateRegistryMessages = {
  catalogTitle: '模板目录',
  compileTitle: '引导编译',
  searchLabel: '搜索模板',
  tagFilterLabel: '按标签过滤',
  capabilityFilterLabel: '按能力过滤',
  allTags: '全部标签',
  allCapabilities: '全部能力',
  navFacets: '类别与能力',
  resultsHeading: '搜索结果',
  noMatch: '无匹配模板',
  clearFilters: '清除过滤',
  loadingCatalog: '正在读取模板目录',
  registryOffline: '模板仓库暂不可用',
  registryOfflineHelp: 'MCP 未连接且目录降级不可读。可重试连接；重试前不会伪造任何内容。',
  retryProbe: '重试连接',
  refresh: '刷新',
  degradedCatalog: '目录降级快照',
  degradedCatalogHelp: 'MCP 未连接，正在展示只读目录快照；编译、导出与会话动作已禁用。',
  registryError: '目录读取失败',
  contractMismatch: '模板仓库数据协议不兼容',
  detailHeading: '模板详情',
  selectTemplate: '选择一个模板查看详情',
  detailLoading: '正在读取模板详情',
  detailUnavailable: '模板详情不可用',
  detailDegraded: '降级状态下不提供模板详情',
  maturity: '成熟度',
  rights: '权限',
  rightsPreview: '预览',
  rightsExport: '导出',
  allowed: '允许',
  denied: '受限',
  license: '许可',
  contractDigest: '合同摘要',
  digest: '摘要',
  ref: '引用',
  version: '版本',
  openCompile: '开始编译',
  previewButton: '预览',
  previewDeniedReason: {
    not_found: '模板不存在或已下线',
    permission_denied: '该模板合同未授予预览权限',
    rights_denied: '该模板的版权层级禁止预览',
    degraded: 'MCP 未连接时不提供预览',
    contract_unavailable: '模板合同不可用，无法预览',
  },
  usage: '用法',
  compileEmpty: '尚未选择模板',
  compileEmptyHelp: '从模板目录选择一个模板后，在此按合同表单引导编译。本面板不产生模型调用。',
  openCatalog: '打开模板目录',
  goalLabel: '编译目标',
  goalHelp: '描述这次编译要达成什么；由模板仓库记录。',
  contractFormHeading: '合同表单',
  fieldRequired: '必填',
  fieldOptional: '选填',
  startSession: '创建编译会话',
  submitFields: '提交字段',
  missingFieldsHeading: '待补字段',
  confirmGateHeading: '确认门',
  confirmGateHelp: '编译前必须显式确认本次选择。确认动作会携带下述决策引用，绝不自动确认。',
  confirmDecisionRef: '决策引用',
  confirmButton: '确认本次编译选择',
  confirmedBadge: '已确认',
  compileButton: '编译（零模型调用）',
  compileBusy: '正在编译',
  compiling: '正在编译提示包',
  resultCardHeading: '编译结果',
  providerCallsBadge: 'provider_calls = 0（本面板不产生模型调用）',
  exportHeading: '导出',
  exportNameLabel: '导出名称',
  exportButton: '导出提示包',
  exportBusy: '正在导出',
  exportedReceipt: '导出完成',
  exportedAt: '导出时间',
  outputRef: '输出引用',
  staleDigest: '模板摘要已变化',
  staleDigestHelp: '会话固定的模板摘要与当前不一致；导出已禁用，请重新固定模板后再导出。',
  rePin: '重新固定模板',
  sessionStatus: '会话状态',
  sessionRevision: '会话版本',
  actionBlocked: '操作被拒绝',
  resetSession: '重置会话',
  checkFreshness: '校验新鲜度',
  busyGeneric: '正在处理',
}

const en: TemplateRegistryMessages = {
  catalogTitle: 'Template catalog',
  compileTitle: 'Guided compile',
  searchLabel: 'Search templates',
  tagFilterLabel: 'Filter by tag',
  capabilityFilterLabel: 'Filter by capability',
  allTags: 'All tags',
  allCapabilities: 'All capabilities',
  navFacets: 'Categories and capabilities',
  resultsHeading: 'Search results',
  noMatch: 'No matching templates',
  clearFilters: 'Clear filters',
  loadingCatalog: 'Reading the template catalog',
  registryOffline: 'Template registry unavailable',
  registryOfflineHelp: 'The MCP seam is not connected and no degraded catalog is readable. Retry the connection; nothing is fabricated before that.',
  retryProbe: 'Retry connection',
  refresh: 'Refresh',
  degradedCatalog: 'Degraded catalog snapshot',
  degradedCatalogHelp: 'The MCP seam is not connected; a read-only catalog snapshot is shown. Compile, export, and session actions are disabled.',
  registryError: 'Catalog read failed',
  contractMismatch: 'The registry data contract is incompatible',
  detailHeading: 'Template details',
  selectTemplate: 'Select a template to see details',
  detailLoading: 'Reading template details',
  detailUnavailable: 'Template details unavailable',
  detailDegraded: 'Details are unavailable while degraded',
  maturity: 'Maturity',
  rights: 'Rights',
  rightsPreview: 'Preview',
  rightsExport: 'Export',
  allowed: 'allowed',
  denied: 'restricted',
  license: 'License',
  contractDigest: 'Contract digest',
  digest: 'Digest',
  ref: 'Ref',
  version: 'Version',
  openCompile: 'Start compile',
  previewButton: 'Preview',
  previewDeniedReason: {
    not_found: 'the template does not exist or was removed',
    permission_denied: 'the template contract does not grant preview',
    rights_denied: 'the template rights level blocks preview',
    degraded: 'preview is unavailable while the MCP seam is down',
    contract_unavailable: 'the template contract is unavailable for preview',
  },
  usage: 'Usage',
  compileEmpty: 'No template selected',
  compileEmptyHelp: 'Pick a template in the catalog, then compile it through the guided contract form here. This pane makes zero model calls.',
  openCatalog: 'Open the template catalog',
  goalLabel: 'Compile goal',
  goalHelp: 'Describe what this compile should achieve; the registry records it.',
  contractFormHeading: 'Contract form',
  fieldRequired: 'required',
  fieldOptional: 'optional',
  startSession: 'Create compile session',
  submitFields: 'Submit fields',
  missingFieldsHeading: 'Missing fields',
  confirmGateHeading: 'Confirmation gate',
  confirmGateHelp: 'Compile requires an explicit confirmation of this selection. The confirm action carries the decision ref below; it is never automatic.',
  confirmDecisionRef: 'Decision ref',
  confirmButton: 'Confirm this compile selection',
  confirmedBadge: 'Confirmed',
  compileButton: 'Compile (zero model calls)',
  compileBusy: 'Compiling',
  compiling: 'Compiling the prompt package',
  resultCardHeading: 'Compile result',
  providerCallsBadge: 'provider_calls = 0 (this pane makes no model calls)',
  exportHeading: 'Export',
  exportNameLabel: 'Export name',
  exportButton: 'Export prompt package',
  exportBusy: 'Exporting',
  exportedReceipt: 'Export finished',
  exportedAt: 'Exported at',
  outputRef: 'Output ref',
  staleDigest: 'Template digest changed',
  staleDigestHelp: 'The digest pinned by the session no longer matches the template; export is disabled until you re-pin the template.',
  rePin: 'Re-pin template',
  sessionStatus: 'Session status',
  sessionRevision: 'Session revision',
  actionBlocked: 'Action refused',
  resetSession: 'Reset session',
  checkFreshness: 'Check freshness',
  busyGeneric: 'Working',
}

const messages: Record<'zh' | 'en', TemplateRegistryMessages> = { zh, en }

/** String-valued message keys (the preview reason map is fetched by reason, not by key). */
export type TemplateRegistryMessageKey = {
  [K in keyof TemplateRegistryMessages]: TemplateRegistryMessages[K] extends Record<string, string> ? never : K
}[keyof TemplateRegistryMessages]

export type TemplateRegistryTranslator = (key: TemplateRegistryMessageKey) => string

export function templateRegistryTranslator(locale: TemplateRegistryLocale = 'zh'): TemplateRegistryTranslator {
  return key => {
    const value = messages[locale === 'pseudo' ? 'en' : locale][key]
    return locale === 'pseudo' ? `[!! ${value} ${value} !!]` : value
  }
}

/** Stable preview deny reason -> localized sentence (unknown codes fall back honestly). */
export function templatePreviewReasonText(locale: TemplateRegistryLocale, reason: string): string {
  const map = messages[locale === 'pseudo' ? 'en' : locale].previewDeniedReason
  const text = map[reason]
  if (text !== undefined) return locale === 'pseudo' ? `[!! ${text} ${text} !!]` : text
  return locale === 'zh' ? '预览不可用' : locale === 'pseudo' ? '[!! Preview unavailable Preview unavailable !!]' : 'preview unavailable'
}
