import { describe, expect, it } from 'vitest'
import { createPaneWorkspaceDraft, serializePaneWorkspaceDraft, validatePaneWorkspaceDraft } from '../src/workspace-draft.js'
import { createBuiltinPaneWorkspacePresets, createPaneWorkspacePresetService } from '../src/workspace-preset.js'
import { createPaneWorkspace } from '../src/workspace.js'
import { PaneDragCoordinator } from '../src/drag-coordinator.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { probeWorkspaceSettingsPageAdapter } from '../src/settings-page-adapter.js'

const FORBIDDEN = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|token|secret|password|api[_-]?key|-----BEGIN/i

describe('V4 7.3 security/privacy scan', () => {
  it('rejects drafts that carry secrets, tokens, or absolute paths', () => {
    const workspace = createPaneWorkspace()
    const draft = createPaneWorkspaceDraft(workspace)
    const leaked = validatePaneWorkspaceDraft({
      ...draft,
      railOrder: ['/etc/passwd', 'authorization: Bearer secret-token-value'],
    })
    expect(leaked.ok).toBe(false)
    expect(leaked.errors.some((issue) => issue.code === 'unsafe_payload' || issue.code === 'rail')).toBe(true)

    const safe = serializePaneWorkspaceDraft(draft)
    expect(FORBIDDEN.test(JSON.stringify(safe))).toBe(false)
  })

  it('keeps presets and drag payloads free of view bodies and secrets', () => {
    const presets = createBuiltinPaneWorkspacePresets()
    for (const draft of Object.values(presets)) {
      expect(FORBIDDEN.test(JSON.stringify(draft))).toBe(false)
      expect(draft.validation.ok).toBe(true)
    }

    const workspace = createPaneWorkspace()
    const coordinator = new PaneDragCoordinator(
      () => workspace,
      () => ({ accepted: true, workspace, effects: [], reason: undefined }),
    )
    coordinator.begin('view:missing', 10, 10)
    const snapshot = coordinator.getSnapshot()
    expect(JSON.stringify(snapshot)).not.toMatch(/innerHTML|view body|file:\/\//i)
    coordinator.dispose()
  })
})

describe('V4 7.4 compatibility matrix', () => {
  it('keeps old registrations working without locale, designer, or V2 capabilities', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registry.registerView({
      descriptor: {
        kind: 'legacy.notes',
        label: 'Notes',
        componentKey: 'notes',
        role: 'content',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: false,
      },
      component: () => 'legacy',
    })
    expect(registry.get('legacy.notes')?.descriptor.label).toBe('Notes')
    expect(probeWorkspaceSettingsPageAdapter(undefined).available).toBe(false)

    const service = createPaneWorkspacePresetService()
    expect(service.list().every((preset) => preset.readonly)).toBe(true)
  })
})
