import { describe, expect, it } from 'vitest'
import {
  FILE_TREE_PROJECTION_CAPABILITY,
  GIT_BRANCH_ACTIONS_CAPABILITY,
  GIT_DIFF_WINDOW_CAPABILITY,
  GIT_REMOTE_ACTIONS_CAPABILITY,
  GIT_STATUS_PROJECTION_CAPABILITY_V2,
  GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
  PANE_FILE_GIT_V2_CAPABILITIES,
  PANE_WORKSPACE_CLOSE_VIEW_INTENT,
  PANE_WORKSPACE_DRAFT_INTENT,
  PANE_WORKSPACE_INTERACTION_V4_LEDGER,
  PANE_WORKSPACE_INTERACTION_V4_OWNER_FIT,
  PANE_WORKSPACE_OPEN_VIEW_INTENT,
  PANE_WORKSPACE_REDUCER_OWNER,
  PaneViewRegistrationError,
  parsePaneViewRegistration,
} from '../src/index.js'
import { pluginDefinition } from './fixtures.js'

const emptyEnvironment = { capabilities: new Set<string>() }

function localRegistration(extra: Record<string, unknown> = {}) {
  return {
    descriptor: pluginDefinition('pinax.notes-preview').views[0],
    component: () => null,
    ...extra,
  }
}

describe('V4 required capability ledger', () => {
  it('keeps the six user requirements required under a single split-owner reducer', () => {
    const ledger = PANE_WORKSPACE_INTERACTION_V4_LEDGER
    expect(ledger.admission).toBe('split-owner')
    expect(ledger.ownerFit).toBe(PANE_WORKSPACE_INTERACTION_V4_OWNER_FIT)
    expect(ledger.reducerOwner).toBe(PANE_WORKSPACE_REDUCER_OWNER)
    expect(ledger.reducerOwnerCount).toBe(1)
    expect(ledger.capabilities.map(capability => capability.id)).toEqual([
      'explorer-tree-interaction',
      'git-interaction',
      'pane-management-i18n',
      'drag-motion',
      'tab-system',
      'workspace-designer',
    ])
    expect(new Set(ledger.capabilities.map(capability => capability.status))).toEqual(new Set(['required']))
    expect(ledger.capabilities).toHaveLength(6)
  })
})

describe('V4 additive public surfaces', () => {
  it('registers an old view without i18n and keeps descriptor.label fallback', () => {
    const registration = parsePaneViewRegistration(localRegistration(), emptyEnvironment)
    expect(registration.descriptor.label).toBe('pinax.notes-preview')
    expect(registration).not.toHaveProperty('i18n')
    expect(registration.i18n).toBeUndefined()
  })

  it('retains a valid local-only i18n block', () => {
    const registration = parsePaneViewRegistration(localRegistration({
      i18n: {
        namespace: 'paneWorkbench',
        labelKey: 'views.notes.label',
        descriptionKey: 'views.notes.description',
        keywordsKey: 'views.notes.keywords',
      },
    }), emptyEnvironment)
    expect(registration.i18n).toEqual({
      namespace: 'paneWorkbench',
      labelKey: 'views.notes.label',
      descriptionKey: 'views.notes.description',
      keywordsKey: 'views.notes.keywords',
    })
    expect(registration.descriptor.label).toBe('pinax.notes-preview')
  })

  it('fails closed on remote or untrusted i18n injection', () => {
    const forbidden = [
      { namespace: 'https://cdn.example/i18n', labelKey: 'views.notes.label' },
      { namespace: 'http://untrusted.example/dict', labelKey: 'views.notes.label' },
      { namespace: 'javascript:alert(1)', labelKey: 'views.notes.label' },
      { namespace: '/etc/locale/pane', labelKey: 'views.notes.label' },
      { namespace: 'C:\\locale\\pane', labelKey: 'views.notes.label' },
      { namespace: 'paneWorkbench', labelKey: 'https://evil.example/label' },
      { namespace: 'paneWorkbench', labelKey: () => 'remote' },
      { namespace: 'paneWorkbench', labelKey: 'views.notes.label', formatter: () => 'x' },
    ]
    for (const i18n of forbidden) {
      expect(() => parsePaneViewRegistration(localRegistration({ i18n }), emptyEnvironment)).toThrow(PaneViewRegistrationError)
    }
  })

  it('exports V1 intent names plus additive draft and File/Git V2 capability names', () => {
    expect(PANE_WORKSPACE_OPEN_VIEW_INTENT).toBe('open_view')
    expect(PANE_WORKSPACE_CLOSE_VIEW_INTENT).toBe('close_view')
    expect(PANE_WORKSPACE_DRAFT_INTENT).toBe('apply_workspace_draft')
    expect(FILE_TREE_PROJECTION_CAPABILITY).toBe('FileTreeProjectionCapabilityV1')
    expect(GIT_STATUS_PROJECTION_CAPABILITY_V2).toBe('GitStatusProjectionCapabilityV2')
    expect(GIT_DIFF_WINDOW_CAPABILITY).toBe('GitDiffWindowCapabilityV1')
    expect(GIT_BRANCH_ACTIONS_CAPABILITY).toBe('GitBranchActionsCapabilityV1')
    expect(GIT_REMOTE_ACTIONS_CAPABILITY).toBe('GitRemoteActionsCapabilityV1')
    expect(GIT_WORKTREE_ACTIONS_CAPABILITY_V2).toBe('GitWorktreeActionsCapabilityV2')
    expect(PANE_FILE_GIT_V2_CAPABILITIES).toEqual([
      FILE_TREE_PROJECTION_CAPABILITY,
      GIT_STATUS_PROJECTION_CAPABILITY_V2,
      GIT_DIFF_WINDOW_CAPABILITY,
      GIT_BRANCH_ACTIONS_CAPABILITY,
      GIT_REMOTE_ACTIONS_CAPABILITY,
      GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
    ])
  })
})
