import { describe, expect, it } from 'vitest'
import {
  createApplyWorkspaceDraftIntent,
  createPaneWorkspace,
  createPaneWorkspaceDraft,
  PANE_WORKSPACE_DRAFT_INTENT,
  reducePaneWorkspace,
  validateApplyWorkspaceDraft,
} from '../src/index.js'

function openDeny(state = createPaneWorkspace()) {
  return reducePaneWorkspace(state, {
    type: 'open_view',
    request: {
      kind: 'terminal.session',
      resourceKey: 'terminal:keep',
      role: 'utility',
      preferredRegion: 'bottom',
      retention: 'keep-alive',
      singleton: false,
      preview: false,
      pinned: true,
      closePolicy: 'deny',
      title: 'Keep Terminal',
    },
  }).state
}

describe('V4 Task 6.2 Atomic Apply', () => {
  it('applies a valid draft in one batch and keeps generation aligned', () => {
    const state = createPaneWorkspace()
    const draft = createPaneWorkspaceDraft(state, {
      providerPlacements: [{ kind: 'dsh.explorer', region: 'right', role: 'navigator', singleton: true }],
    })
    const intent = createApplyWorkspaceDraftIntent(draft, state.generation)
    expect(intent.type).toBe(PANE_WORKSPACE_DRAFT_INTENT)
    const applied = reducePaneWorkspace(state, intent)
    expect(applied.accepted).toBe(true)
    expect(applied.state.regions.right.root).toEqual(draft.regions.right.root)
    expect(applied.state.views).toEqual(state.views)
  })

  it('rejects generation drift or deny/dirty blockers with zero partial modify', () => {
    const live = openDeny()
    const staleDraft = createPaneWorkspaceDraft(createPaneWorkspace(), {
      providerPlacements: [{ kind: 'dsh.explorer', region: 'right', role: 'navigator' }],
    })
    const drift = reducePaneWorkspace(live, createApplyWorkspaceDraftIntent(staleDraft, live.generation + 8))
    expect(drift.accepted).toBe(false)
    expect(drift.reason).toBe('generation_drift')
    expect(drift.state).toBe(live)
    expect(Object.values(drift.state.views).some(view => view.resourceKey === 'terminal:keep')).toBe(true)

    const stripped = createPaneWorkspaceDraft(live)
    const withoutGroup = {
      ...stripped,
      groups: Object.fromEntries(Object.entries(stripped.groups).filter(([id]) => id !== 'group:bottom:utility')),
      regions: {
        ...stripped.regions,
        bottom: { ...stripped.regions.bottom, root: { type: 'group' as const, groupId: 'group:bottom:missing' } },
      },
    }
    const blocked = validateApplyWorkspaceDraft(live, createApplyWorkspaceDraftIntent(withoutGroup, live.generation))
    expect(blocked.ok).toBe(false)
    expect(blocked.blockers.some(item => item.code === 'deny')).toBe(true)
    const applied = reducePaneWorkspace(live, createApplyWorkspaceDraftIntent(withoutGroup, live.generation))
    expect(applied.accepted).toBe(false)
    expect(applied.state.views).toEqual(live.views)
  })
})
