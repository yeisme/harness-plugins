import { describe, expect, it, vi } from 'vitest'
import { PaneCommandRegistry } from '../src/composition.js'
import { PaneWorkbenchController } from '../src/controller.js'
import { collectWorkspaceSearchCandidates } from '../src/search-identity.js'
import { activateWorkspaceSearchCandidate } from '../src/search-open.js'
import { PaneViewRegistry } from '../src/view-registry.js'

function fixture() {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  for (const kind of ['anchor', 'target']) registry.registerView({
    descriptor: { kind, label: kind, componentKey: kind, role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true }, component: () => null,
  })
  const controller = new PaneWorkbenchController({ registry })
  controller.openView({ kind: 'anchor', resourceKey: 'view:anchor', title: 'anchor', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, pinned: true })
  const candidate = collectWorkspaceSearchCandidates({ registrations: registry.snapshot(), state: controller.getSnapshot(), profile: controller.getManagementSnapshot().profile }).find(item => item.openTarget.viewKind === 'target')!
  return { registry, controller, candidate }
}

describe('search owner-confirmed opening', () => {
  it('does not replace unsupported floating with maximization or open a target first', async () => {
    const input = fixture()
    const before = input.controller.getSnapshot()
    expect(await activateWorkspaceSearchCandidate({ ...input, placement: 'float' })).toMatchObject({ ok: false, reason: 'float_placement_unsupported' })
    expect(input.controller.getSnapshot()).toBe(before)
  })

  it.each(['right', 'bottom'] as const)('places a new result %s of the original anchor and preserves dirty content', async placement => {
    const input = fixture()
    const anchor = Object.values(input.controller.getSnapshot().views)[0]!
    input.controller.dispatch({ type: 'set_view_dirty', viewId: anchor.id, dirty: true })
    expect(await activateWorkspaceSearchCandidate({ ...input, placement })).toMatchObject({ ok: true, placed: placement })
    const after = input.controller.getSnapshot()
    const target = Object.values(after.views).find(view => view.kind === 'target')!
    expect(target.groupId).not.toBe(anchor.groupId)
    expect(after.views[anchor.id]!.dirty).toBe(true)
    expect(after.groups[anchor.groupId]).toBeDefined()
  })

  it('does not report success when a host ignores activation or splitting', async () => {
    const input = fixture()
    input.controller.openView({ kind: 'target', resourceKey: 'view:target', title: 'target', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true })
    const anchor = Object.values(input.controller.getSnapshot().views).find(view => view.kind === 'anchor')!
    input.controller.dispatch({ type: 'activate_view', viewId: anchor.id })
    vi.spyOn(input.controller, 'dispatch').mockImplementation(() => ({ state: input.controller.getSnapshot(), accepted: true, effects: [] }))
    expect(await activateWorkspaceSearchCandidate(input)).toMatchObject({ ok: false, reason: 'activation_unconfirmed' })
    expect(await activateWorkspaceSearchCandidate({ ...input, placement: 'right' })).toMatchObject({ ok: false, reason: 'placement_unconfirmed' })
  })

  it('rejects a stale view identity instead of opening a different resource', async () => {
    const input = fixture()
    const anchor = Object.values(input.controller.getSnapshot().views)[0]!
    const candidate = { ...input.candidate, openTarget: { ...input.candidate.openTarget, viewId: anchor.id } }
    expect(await activateWorkspaceSearchCandidate({ ...input, candidate })).toMatchObject({ ok: false, reason: 'target_changed' })
  })

  it.each(['pending', 'accepted', 'failed', 'approval_required', 'unknown', 'completed'] as const)('honors a canonical command receipt with status %s', async status => {
    const input = fixture()
    const commands = new PaneCommandRegistry()
    const execute = vi.fn(() => ({ status, receiptRef: 'receipt:command:one' }))
    commands.register({ descriptor: { id: 'command.one', label: 'Run one' }, execute })
    const candidate = collectWorkspaceSearchCandidates({ registrations: [], commands: commands.snapshot(), state: input.controller.getSnapshot(), profile: input.controller.getManagementSnapshot().profile }).find(item => item.kind === 'command')!
    expect(await activateWorkspaceSearchCandidate({ ...input, commands, candidate })).toMatchObject({ ok: status === 'completed' })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(await activateWorkspaceSearchCandidate({ ...input, commands, candidate, placement: 'right' })).toMatchObject({ ok: false, reason: 'command_placement_unsupported' })
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
