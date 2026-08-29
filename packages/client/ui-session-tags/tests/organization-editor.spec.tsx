// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  OrganizationEditorController,
  OrganizationEditorOverlay,
  createSessionOrganizationController,
} from '../src/client/index.ts'
import type { SessionOrganizationRemoteFace, SessionOrganizationSnapshotV1 } from '../src/client/organization-wire.ts'

afterEach(cleanup)

function harness() {
  let snapshot: SessionOrganizationSnapshotV1 = {
    ok: true, specVersion: '1.0',
    functionTypes: [
      { id: 'planning', name: '规划', color: 'info', scope: { kind: 'global' }, order: 0, active: true, version: 'b1', updatedAt: 0 },
      { id: 'research', name: '调研', color: 'chart-1', scope: { kind: 'global' }, order: 1, active: true, version: 'b2', updatedAt: 0 },
    ],
    assignments: [{ sessionId: 's1', workspaceRef: 'w1', functionTypeId: 'planning', functionSource: 'automatic', functionLocked: false, tagsLocked: false, classificationStatus: 'classified', confidence: 0.9, version: 'a1', updatedAt: 1 }],
    tagCatalog: [], rules: [], recentBatches: [],
  }
  const remote: SessionOrganizationRemoteFace = {
    async snapshot() { return snapshot },
    setAssignment: vi.fn(async input => {
      const assignment = { ...snapshot.assignments[0]!, functionTypeId: input.functionTypeId, functionSource: 'manual' as const, functionLocked: input.functionLocked, version: 'a2', updatedAt: 2 }
      snapshot = { ...snapshot, assignments: [assignment] }
      return { ok: true as const, assignment }
    }),
    async putFunctionType() { throw new Error('unused') }, async putTagCatalog() { throw new Error('unused') }, async putRule() { throw new Error('unused') }, async classify() { throw new Error('unused') }, async planBatch() { throw new Error('unused') }, async executeBatch() { throw new Error('unused') }, async undoBatch() { throw new Error('unused') }, async unlockAdmin() { throw new Error('unused') },
  }
  const organization = createSessionOrganizationController(remote)
  const editor = new OrganizationEditorController(remote, organization)
  return { remote, organization, editor }
}

describe('organization quick editor', () => {
  it('saves one function assignment with a manual lock and restores the overlay state', async () => {
    const { remote, organization, editor } = harness()
    await organization.refresh()
    editor.open('s1')
    render(<OrganizationEditorOverlay controller={editor} />)
    expect(screen.getByRole('dialog', { name: '设置功能类型' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('功能类型'), { target: { value: 'research' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(remote.setAssignment).toHaveBeenCalledWith({
      sessionId: 's1', workspaceRef: 'w1', functionTypeId: 'research', functionLocked: true, tagsLocked: false, ifVersion: 'a1',
    }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes with Escape without writing', async () => {
    const { remote, organization, editor } = harness()
    await organization.refresh()
    editor.open('s1')
    render(<OrganizationEditorOverlay controller={editor} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(remote.setAssignment).not.toHaveBeenCalled()
  })
})
