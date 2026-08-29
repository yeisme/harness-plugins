// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  collectWorkspaceApplyRisks,
  createWorkspaceApplyRollback,
  diffLiveWorkspaceAndDraft,
  inspectWorkspaceApplyUx,
  restoreWorkspaceFromRollback,
  saveWorkspaceDraftWithUx,
  submitWorkspaceApply,
  workspaceApplyAutoRetries,
  withKeepInPlaceDraft,
  WORKSPACE_APPLY_KEEP_IN_PLACE,
} from '../src/workspace-apply-ux.js'
import {
  applyDesignerWorkspace,
  createDesignerSession,
  inspectDesignerApplyUx,
  rollbackDesignerWorkspace,
  saveDesignerWorkspace,
  setDesignerMotion,
  setDesignerRailOrder,
  setDesignerScope,
} from '../src/workspace-designer.js'
import { WorkspaceDesignerInteraction } from '../src/workspace-designer-ui.js'
import { createPaneWorkspaceDraft } from '../src/workspace-draft.js'
import { createPaneWorkspacePresetService, type PaneWorkspaceSettingsOwnerV1 } from '../src/workspace-preset.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { createPaneWorkspace, reducePaneWorkspace } from '../src/workspace.js'

afterEach(cleanup)

function openProtected(state = createPaneWorkspace()) {
  const deny = reducePaneWorkspace(state, {
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
      metadata: { lifecycle: 'running' },
    },
  }).state
  return reducePaneWorkspace(deny, {
    type: 'open_view',
    request: {
      kind: 'file.preview',
      resourceKey: 'file:dirty',
      role: 'content',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: false,
      preview: false,
      dirty: true,
      title: 'Dirty File',
      metadata: { lifecycle: 'approval_required' },
    },
  }).state
}

function createApplyRegistry(): PaneViewRegistry {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: {
      kind: 'dsh.explorer',
      label: 'Explorer',
      componentKey: 'dsh-explorer',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
    },
    component: () => createElement('div', { 'data-live-view': 'dsh.explorer' }),
    showInPicker: true,
  })
  return registry
}

function Harness() {
  const [workspace, setWorkspace] = useState(() => createPaneWorkspace())
  const [session, setSession] = useState(() => createDesignerSession(workspace))
  const [registry] = useState(createApplyRegistry)
  return createElement(WorkspaceDesignerInteraction, {
    session,
    workspace,
    registry,
    onChange: setSession,
    onWorkspaceChange: setWorkspace,
  })
}

describe('V4 Task 6.6 Apply UX', () => {
  it('diffs live workspace against the current draft from the designer start state', () => {
    const live = createPaneWorkspace()
    const start = createDesignerSession(live)
    expect(diffLiveWorkspaceAndDraft(live, start.draft).dirty).toBe(false)

    const edited = setDesignerScope(
      setDesignerMotion(setDesignerRailOrder(start, ['source-control', 'explorer', 'customize']), 'reduced'),
      'session',
    )
    const diff = diffLiveWorkspaceAndDraft(live, edited.draft)
    expect(diff.dirty).toBe(true)
    expect(diff.changes.map(change => change.kind).sort()).toEqual(['motion', 'rail', 'scope'])
    expect(diff.changes.every(change => change.before !== change.after)).toBe(true)
    expect(inspectDesignerApplyUx(live, edited).diff).toEqual(diff)
  })

  it('surfaces dirty/deny/capability/scope risks and keeps running or approval views in place', () => {
    const live = openProtected()
    const start = createDesignerSession(live)
    const stripped = createPaneWorkspaceDraft(live)
    const withoutBottom = {
      ...stripped,
      groups: Object.fromEntries(Object.entries(stripped.groups).filter(([id]) => id !== 'group:bottom:utility')),
      regions: {
        ...stripped.regions,
        bottom: { ...stripped.regions.bottom, root: { type: 'group' as const, groupId: 'group:bottom:missing' } },
      },
      providerPlacements: [{ kind: 'dsh.missing-provider', region: 'right' as const, role: 'navigator' as const }],
      scope: 'profile' as const,
    }
    const risks = collectWorkspaceApplyRisks(live, withoutBottom, {
      capabilities: new Set(['dsh.explorer']),
      allowedScopes: ['session', 'workspace'],
      viewLifecycle: Object.fromEntries(Object.values(live.views).map(view => [
        view.id,
        view.metadata?.lifecycle === 'approval_required' ? 'approval_required' : 'running',
      ])),
    })
    expect(risks.canApply).toBe(false)
    expect(risks.blockers.some(item => item.kind === 'scope')).toBe(true)
    expect(risks.warnings.some(item => item.kind === 'capability' && item.message.includes('dsh.missing-provider'))).toBe(true)
    expect(risks.keepInPlace.some(item => item.code === 'deny' && item.keepInPlace)).toBe(true)
    expect(risks.keepInPlace.some(item => item.code === 'dirty' && item.keepInPlace)).toBe(true)
    expect(risks.keepInPlace.some(item => item.code === 'running' && item.keepInPlace)).toBe(true)
    expect(risks.keepInPlace.some(item => item.code === 'approval_required' && item.keepInPlace)).toBe(true)
    expect(withKeepInPlaceDraft(start.draft).providerPlacements.some(item => item.kind === WORKSPACE_APPLY_KEEP_IN_PLACE)).toBe(true)
    expect(Object.values(live.views).some(view => view.resourceKey === 'terminal:keep')).toBe(true)
  })

  it('returns apply and save receipts and restores the pre-apply workspace without auto-retry', async () => {
    const live = createPaneWorkspace()
    const start = createDesignerSession(live)
    const edited = setDesignerRailOrder(start, ['source-control', 'explorer', 'customize'])
    const applied = submitWorkspaceApply(live, edited.draft)
    expect(applied.receipt.status).toBe('accepted')
    expect(applied.receipt.action).toBe('apply')
    expect(applied.rollback.autoRetry).toBe(false)
    expect(workspaceApplyAutoRetries()).toBe(false)
    expect(applied.workspace.regions.right.root).toEqual(edited.draft.regions.right.root)
    const restored = restoreWorkspaceFromRollback(applied.rollback)
    expect(restored.regions).toEqual(live.regions)
    expect(restored.generation).toBe(live.generation)

    const blocked = submitWorkspaceApply(live, edited.draft, { allowedScopes: ['session'] })
    expect(blocked.receipt.status).toBe('blocked')
    expect(blocked.workspace).toBe(live)

    const owner: PaneWorkspaceSettingsOwnerV1 = {
      allowedScopes: ['workspace'],
      async create() { return { status: 'ok', action: 'create', id: 'preset:1' } },
      async update() { return { status: 'ok', action: 'update' } },
      async delete() { return { status: 'ok', action: 'delete' } },
      async reset() { return { status: 'ok', action: 'reset' } },
    }
    await expect(saveWorkspaceDraftWithUx(edited.draft, {
      presetService: createPaneWorkspacePresetService(owner),
    })).resolves.toMatchObject({ action: 'save', status: 'accepted' })
    await expect(saveWorkspaceDraftWithUx(setDesignerScope(edited, 'profile').draft, {
      allowedScopes: ['workspace'],
    })).resolves.toMatchObject({ action: 'save', status: 'blocked', reason: 'scope' })
    await expect(saveWorkspaceDraftWithUx(edited.draft)).resolves.toMatchObject({ action: 'save', status: 'blocked' })

    const designerApplied = applyDesignerWorkspace(live, edited)
    expect(designerApplied.session.lastReceipt?.status).toBe('accepted')
    const rolled = rollbackDesignerWorkspace(designerApplied.session)
    expect(rolled.workspace?.regions).toEqual(createWorkspaceApplyRollback(live).workspace.regions)
    const saved = await saveDesignerWorkspace(edited)
    expect(saved.lastReceipt?.action).toBe('save')
    expect(inspectWorkspaceApplyUx(live, edited.draft, {}, {
      lastReceipt: designerApplied.session.lastReceipt,
      rollback: designerApplied.session.rollback,
    }).lastReceipt?.status).toBe('accepted')
  })

  it('keeps running, approval_required, dirty, and deny views when submit applies a dropping draft', () => {
    const live = openProtected()
    const start = createDesignerSession(live)
    const dropping = {
      ...start.draft,
      regions: {
        ...start.draft.regions,
        right: { ...start.draft.regions.right, root: { type: 'group' as const, groupId: 'group:right:navigator' } },
        bottom: { ...start.draft.regions.bottom, root: { type: 'group' as const, groupId: 'group:bottom:missing' } },
      },
      groups: Object.fromEntries(
        Object.entries(start.draft.groups).filter(([id]) => id !== 'group:right:content' && id !== 'group:bottom:utility'),
      ),
      providerPlacements: [{ kind: 'dsh.explorer', region: 'right' as const, role: 'navigator' as const }],
    }
    expect(dropping.regions.right.root).toEqual({ type: 'group', groupId: 'group:right:navigator' })
    expect(dropping.groups['group:right:content']).toBeUndefined()
    expect(dropping.groups['group:bottom:utility']).toBeUndefined()

    const submitted = submitWorkspaceApply(live, dropping, {
      viewLifecycle: Object.fromEntries(Object.values(live.views).map(view => [
        view.id,
        view.metadata?.lifecycle === 'approval_required' ? 'approval_required' : 'running',
      ])),
    })
    expect(submitted.receipt.status).toBe('accepted')
    const submittedKeys = Object.values(submitted.workspace.views).map(view => view.resourceKey)
    expect(submittedKeys).toEqual(expect.arrayContaining(['terminal:keep', 'file:dirty']))
    expect(Object.values(submitted.workspace.views).find(view => view.resourceKey === 'terminal:keep')?.closePolicy).toBe('deny')
    expect(Object.values(submitted.workspace.views).find(view => view.resourceKey === 'file:dirty')?.dirty).toBe(true)

    const designed = applyDesignerWorkspace(live, { ...start, draft: dropping })
    expect(designed.session.lastReceipt?.status).toBe('accepted')
    const designedKeys = Object.values(designed.workspace.views).map(view => view.resourceKey)
    expect(designedKeys).toEqual(expect.arrayContaining(['terminal:keep', 'file:dirty']))
  })

  it('wires Apply, Save, and Rollback controls through WorkspaceDesignerInteraction', async () => {
    render(createElement(Harness))
    fireEvent.click(screen.getByRole('option', { name: 'dsh.explorer' }))
    expect(document.querySelector('[data-designer-change="placement"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(document.querySelector('[data-designer-receipt="accepted"]')?.textContent).toBe('accepted')
    const rollback = screen.getByRole('button', { name: 'Rollback' })
    expect(rollback).toHaveProperty('disabled', false)
    fireEvent.click(rollback)
    expect(document.querySelector('[data-designer-receipt="accepted"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save As Preset' }))
    await screen.findByText('blocked')
    expect(document.querySelector('[data-designer-receipt="blocked"]')?.textContent).toBe('blocked')
  })
})
