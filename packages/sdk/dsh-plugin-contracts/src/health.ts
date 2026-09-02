import type { DshPluginContributionHealthV1, DshPluginContributionStatusV1 } from './surface.js'

export interface DshPluginHealthInputV1 {
  readonly contribution_id: string
  readonly critical: boolean
  readonly health: DshPluginContributionHealthV1
}

export interface DshPluginProfileHealthV1 {
  readonly status: DshPluginContributionStatusV1
  readonly code: 'profile.ready' | 'profile.degraded' | 'profile.failed'
  readonly critical_failures: readonly string[]
  readonly optional_failures: readonly string[]
}

export type DshPluginHealthRecoveryV1 = 'probe_refresh' | 'reconcile_required' | 'none'

/**
 * 每个 contribution 独立计入健康度；optional failure 只能降级，不能击沉 base。
 */
export function aggregateDshPluginProfileHealthV1(inputs: readonly DshPluginHealthInputV1[]): DshPluginProfileHealthV1 {
  const criticalFailures = inputs
    .filter(input => input.critical && input.health.status !== 'available')
    .map(input => input.contribution_id)
  const optionalFailures = inputs
    .filter(input => !input.critical && input.health.status !== 'available')
    .map(input => input.contribution_id)

  if (criticalFailures.some(id => inputs.find(input => input.contribution_id === id)?.health.status === 'disabled')) {
    return { status: 'disabled', code: 'profile.failed', critical_failures: criticalFailures, optional_failures: optionalFailures }
  }
  if (criticalFailures.length > 0 || optionalFailures.length > 0) {
    return { status: 'degraded', code: 'profile.degraded', critical_failures: criticalFailures, optional_failures: optionalFailures }
  }
  return { status: 'available', code: 'profile.ready', critical_failures: [], optional_failures: [] }
}

/** 不确定 mutation 只能 reconcile，禁止把 Retry 解释为再次提交。 */
export function dshPluginHealthRecoveryV1(input: { readonly action_outcome?: 'known' | 'unknown'; readonly retryable_probe?: boolean }): DshPluginHealthRecoveryV1 {
  if (input.action_outcome === 'unknown') return 'reconcile_required'
  if (input.retryable_probe === true) return 'probe_refresh'
  return 'none'
}
