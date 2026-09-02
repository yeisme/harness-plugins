import { describe, expect, it } from 'vitest'

import { consumePersonalCodingWebSurfaceV1 } from '../src/personal-coding'

function fixture(surfaces: readonly ('web' | 'tui')[] = ['web', 'tui']) {
  return {
    contract_version: 'dsh.plugin.surface.v1', id: 'personal-coding', owner: 'harness-plugins', generation: 3, surfaces,
    commands: [{ id: 'ordo.run.launch', canonical_name: '/ordo run launch', aliases: [], owner: 'ordo', action_kind: 'ordo.run.launch', available: false, disabled_reason_code: 'ordo.run_launch.unavailable' }],
    views: [{ id: 'candidate.diff', owner: 'dsh-tui', kind: 'diff', title: 'Candidate Diff', projection: { revision: 'candidate-r1', freshness: 'fresh', summary: { text: '1 file', truncated: false } } }],
    actions: [{ id: 'candidate.apply', owner: 'dsh-tui', label: 'Apply', effect: 'mutation', risk: 'high', preview_policy: 'owner_preview_required', action_ref: 'action:candidate:r1', expected_revision: 'candidate-r1', available: true }],
    health: { status: 'degraded', stage: 'probe', code: 'ordo.optional', reason: 'Ordo is optional.', fix: 'Install Ordo to enable background handoff.', last_checked: '2026-09-02T00:00:00.000Z' },
    dispose_ref: 'dispose:personal-coding:3',
  }
}

describe('personal coding Web V1 contract consumer', () => {
  it('keeps semantic commands/views/actions while presenting the honest degraded state', () => {
    const state = consumePersonalCodingWebSurfaceV1(fixture())
    expect(state).toMatchObject({ status: 'degraded', contribution_id: 'personal-coding', generation: 3 })
    expect(state.commands[0]).toMatchObject({ id: 'ordo.run.launch', available: false, disabled_reason_code: 'ordo.run_launch.unavailable' })
    expect(state.views[0]?.kind).toBe('diff')
    expect(state.actions[0]).toMatchObject({ effect: 'mutation', preview_policy: 'owner_preview_required' })
  })

  it('fails closed for unknown versions and contributions that omit the Web target', () => {
    expect(consumePersonalCodingWebSurfaceV1({ ...fixture(), contract_version: 'dsh.plugin.surface.v2' })).toMatchObject({ status: 'disabled', reason: 'surface.unknown_version', commands: [] })
    expect(consumePersonalCodingWebSurfaceV1(fixture(['tui']))).toMatchObject({ status: 'disabled', reason: 'surface.web_not_declared', views: [] })
  })
})
