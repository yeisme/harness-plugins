const labels = {
  origin: { fixture: ['Test sample', '测试样本'], manual: ['Manually imported', '人工导入'], live: ['Collected observation', '实际采集'] },
  health: { fresh: ['Within freshness window', '在有效时间内'], stale: ['Out of date', '数据已过期'], partial: ['Partially available', '部分可用'],
    unavailable: ['Unavailable', '暂不可用'], freshness_unknown: ['Freshness unknown', '时效未知'] },
  lifecycle: { active: ['Active observation', '当前判断'], retracted: ['Retracted', '已撤回'], inconclusive: ['Insufficient evidence', '证据不足'], cooled: ['Cooling', '已降温'] },
  claim: { newly_observed: ['Newly observed in sample', '样本内首次观察'], metric_changed: ['Metric changed', '指标变化'],
    rank_changed: ['Rank changed', '名次变化'], placement_changed: ['Placement changed', '展示位置变化'], correction: ['Correction', '判断更正'] },
  reason: { identity_evidence_missing: ['Source identity needs verification', '来源身份待核验'], non_fixture_sample_missing: ['No verified real sample', '缺少可核验的真实样本'],
    seven_complete_live_days_missing: ['Seven complete observation days are missing', '尚未积累完整七天观测'],
    sampling_schedule_verification_required: ['Scheduled sample checks are incomplete', '计划采样检查尚不完整'],
    sampling_plan_not_preregistered: ['Sampling plan was not registered before this window', '本窗口开始前未登记采样计划'],
    sample_review_required: ['Sample review is pending', '样本审查待完成'], source_blocked: ['Source access is blocked', '来源访问受阻'],
    background_source_not_daily_trend: ['Background source; not a daily trend feed', '背景资料来源，不用于日更趋势'] },
} as const

export function marketLabel(kind: keyof typeof labels, value: string, locale: 'zh' | 'en' | 'pseudo'): string {
  const dictionary: Record<string, readonly [string, string]> = labels[kind]
  const pair = Object.hasOwn(dictionary, value) ? dictionary[value]! : ['Not yet verified', '尚待核验']
  return locale === 'zh' ? pair[1]! : locale === 'pseudo' ? `[!! ${pair[0]} ${pair[0]} !!]` : pair[0]!
}

export function marketTime(value: string, timezone: string, locale: 'zh' | 'en' | 'pseudo'): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('market_time_invalid')
  const formatted = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date)
  return locale === 'pseudo' ? `[${formatted}]` : formatted
}
