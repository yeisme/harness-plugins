import { describe, expect, it } from 'vitest'
import { createPaneWorkspace } from '../src/workspace.js'
import { createPaneWorkspaceDraft } from '../src/workspace-draft.js'
import {
  createPaneWorkspacePresetService,
  PANE_WORKSPACE_PRESET_SERVICE,
  presetScopePermission,
  type PaneWorkspaceSettingsOwnerV1,
} from '../src/workspace-preset.js'

describe('V4 Task 6.5 Preset Service', () => {
  it('exposes read-only Focus/Code/Review/Media builtins and refuses local JSON writes', async () => {
    const service = createPaneWorkspacePresetService()
    expect(service.version).toBe(PANE_WORKSPACE_PRESET_SERVICE)
    expect(service.list().map(item => item.id)).toEqual(['focus', 'code', 'review', 'media'])
    expect(service.list().every(item => item.readonly && item.builtin)).toBe(true)
    expect(service.get('code')?.railOrder).toContain('source-control')
    const draft = createPaneWorkspaceDraft(createPaneWorkspace())
    await expect(service.create('My Code', 'workspace', draft)).resolves.toMatchObject({
      status: 'rejected',
      reason: 'DSH settings/application service is unavailable',
    })
    await expect(service.update('focus', draft)).resolves.toMatchObject({ status: 'rejected' })
    await expect(service.delete('media')).resolves.toMatchObject({ status: 'rejected' })
  })

  it('routes create/update/delete/reset through the settings owner and reports honest scope permission', async () => {
    const calls: string[] = []
    const owner: PaneWorkspaceSettingsOwnerV1 = {
      allowedScopes: ['session', 'workspace'],
      async create(name, scope) {
        calls.push(`create:${name}:${scope}`)
        return { status: 'ok', action: 'create', id: 'user:1' }
      },
      async update(id) {
        calls.push(`update:${id}`)
        return { status: 'ok', action: 'update', id }
      },
      async delete(id) {
        calls.push(`delete:${id}`)
        return { status: 'ok', action: 'delete', id }
      },
      async reset(scope) {
        calls.push(`reset:${scope}`)
        return { status: 'ok', action: 'reset' }
      },
    }
    const service = createPaneWorkspacePresetService(owner)
    const draft = createPaneWorkspaceDraft(createPaneWorkspace())
    expect(presetScopePermission(owner, 'profile')).toEqual({
      allowed: false,
      reason: 'profile scope is not permitted',
    })
    await expect(service.create('Mine', 'profile', draft)).resolves.toMatchObject({ status: 'permission_denied' })
    await expect(service.create('Mine', 'workspace', draft)).resolves.toMatchObject({ status: 'ok', id: 'user:1' })
    await expect(service.update('user:1', draft)).resolves.toMatchObject({ status: 'ok' })
    await expect(service.delete('user:1')).resolves.toMatchObject({ status: 'ok' })
    await expect(service.reset('workspace')).resolves.toMatchObject({ status: 'ok' })
    expect(calls).toEqual(['create:Mine:workspace', 'update:user:1', 'delete:user:1', 'reset:workspace'])
  })
})
