import { describe, expect, it } from 'vitest'
import {
  aggregateDshPluginProfileHealthV1,
  comparePersonalCodingContractSemanticsV1,
  createPersonalCodingContractFixtureV1,
  dshPluginHealthRecoveryV1,
  type DshPluginContributionHealthV1,
} from '../src/index.js'

const healthy: DshPluginContributionHealthV1 = {
  status: 'available',
  stage: 'ready',
  code: 'ready',
  reason: 'Ready.',
  fix: 'No action required.',
  last_checked: '2026-09-02T00:00:00.000Z',
}

describe('personal coding contract parity', () => {
  it('keeps semantic parity while allowing Web presentation to remain retained-next', () => {
    const web = createPersonalCodingContractFixtureV1({ ordo_run_launch_available: false, web_views_available: false })
    const tui = createPersonalCodingContractFixtureV1({ ordo_run_launch_available: false, web_views_available: true })
    expect(comparePersonalCodingContractSemanticsV1(web, tui)).toEqual([])
    expect(web.views.every(view => view.presentation === 'retained-next')).toBe(true)
  })

  it('reports the exact id and semantic field when an adapter drifts', () => {
    const left = createPersonalCodingContractFixtureV1({ ordo_run_launch_available: true })
    const right = createPersonalCodingContractFixtureV1({ ordo_run_launch_available: true })
    const changed = { ...right, actions: right.actions.map(action => ({ ...action, owner: 'client' })) }
    expect(comparePersonalCodingContractSemanticsV1(left, changed)).toEqual([{ section: 'actions', id: 'candidate.apply', field: 'owner' }])
  })

  it('uses one stable unavailable reason when Ordo launch is absent', () => {
    const fixture = createPersonalCodingContractFixtureV1({ ordo_run_launch_available: false })
    expect(fixture.commands.find(command => command.id === 'ordo.run.launch')).toMatchObject({
      available: false,
      disabled_reason_code: 'ordo.run_launch.unavailable',
    })
  })
})

describe('contribution health isolation', () => {
  it('fails the profile only for disabled critical contributions', () => {
    const result = aggregateDshPluginProfileHealthV1([
      { contribution_id: 'commands', critical: true, health: healthy },
      { contribution_id: 'files', critical: true, health: { ...healthy, status: 'disabled', code: 'files.missing' } },
      { contribution_id: 'mermaid', critical: false, health: { ...healthy, status: 'disabled', code: 'mermaid.missing' } },
    ])
    expect(result).toEqual({ status: 'disabled', code: 'profile.failed', critical_failures: ['files'], optional_failures: ['mermaid'] })
  })

  it('keeps optional and fallback failures degraded without reporting full failure', () => {
    const result = aggregateDshPluginProfileHealthV1([
      { contribution_id: 'commands', critical: true, health: healthy },
      { contribution_id: 'terminal-native', critical: false, health: { ...healthy, status: 'degraded', code: 'terminal.fallback' } },
    ])
    expect(result).toMatchObject({ status: 'degraded', code: 'profile.degraded', critical_failures: [], optional_failures: ['terminal-native'] })
  })

  it('never retries an action whose outcome is unknown', () => {
    expect(dshPluginHealthRecoveryV1({ action_outcome: 'unknown', retryable_probe: true })).toBe('reconcile_required')
    expect(dshPluginHealthRecoveryV1({ action_outcome: 'known', retryable_probe: true })).toBe('probe_refresh')
  })
})
