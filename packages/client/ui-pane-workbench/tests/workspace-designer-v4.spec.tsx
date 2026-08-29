// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import {
  DSH_WORKSPACE_DESIGNER_VIEW_KIND,
  openPaneWorkbenchCoreView,
  registerPaneWorkbenchCoreViews,
} from '../src/core-pane.js'
import { PaneRegionChrome } from '../src/region-chrome.js'
import {
  openWorkspaceDesignerDelivery,
  probeWorkspaceSettingsPageAdapter,
} from '../src/settings-page-adapter.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { createPaneWorkspace } from '../src/workspace.js'
import {
  createPaneWorkspaceDraft,
  parsePaneWorkspaceDraft,
  serializePaneWorkspaceDraft,
  validatePaneWorkspaceDraft,
} from '../src/workspace-draft.js'

afterEach(cleanup)

describe('V4 Task 6.1 Draft Model', () => {
  it('serializes a draft without live resources or secrets', () => {
    const draft = createPaneWorkspaceDraft(createPaneWorkspace(), {
      providerPlacements: [{ kind: 'file.explorer', region: 'right', role: 'navigator', singleton: true }],
    })
    expect(draft.schema).toBe('pane.workspace-draft.v1alpha1')
    expect(draft.baseGeneration).toBe(1)
    expect(draft.scope).toBe('workspace')
    expect(draft.tabPolicy.overflow).toBe('priority')
    expect(draft.motionPreference).toBe('system')
    const serialized = JSON.stringify(serializePaneWorkspaceDraft(draft))
    expect(serialized).not.toMatch(/file:\/\/|\/home\/|token|secret/i)
    expect(validatePaneWorkspaceDraft({
      ...draft,
      providerPlacements: [{ kind: '/etc/passwd', region: 'right', role: 'navigator' }],
    }).ok).toBe(false)
    expect(parsePaneWorkspaceDraft({ schema: 'other' })).toBeUndefined()
  })
})

describe('V4 Task 6.3 Designer Core View', () => {
  it('registers a hidden singleton designer and opens it maximized from rail or menu', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registerPaneWorkbenchCoreViews(registry)
    expect(registry.get(DSH_WORKSPACE_DESIGNER_VIEW_KIND)?.showInPicker).toBe(false)
    expect(registry.get(DSH_WORKSPACE_DESIGNER_VIEW_KIND)?.descriptor.singleton).toBe(true)
    const controller = new PaneWorkbenchController({ registry })
    openPaneWorkbenchCoreView(controller, DSH_WORKSPACE_DESIGNER_VIEW_KIND)
    const snapshot = controller.getSnapshot()
    const designer = Object.values(snapshot.views).find(view => view.kind === DSH_WORKSPACE_DESIGNER_VIEW_KIND)!
    expect(designer.singleton).toBe(true)
    expect(snapshot.maximizedGroupId).toBe(designer.groupId)
    render(createElement(PaneRegionChrome, {
      region: 'right',
      mode: 'dock',
      width: 480,
      height: 800,
      visible: true,
      maximized: true,
      registry,
      controller,
    }))
    expect(document.querySelector('.pwr-designer-header')?.textContent).toBe('Workspace Designer')
    expect(document.querySelector('[data-pane-designer-slot="palette"]')).toBeTruthy()
    expect(document.querySelector('[data-pane-designer-slot="canvas"]')).toBeTruthy()
    expect(document.querySelector('[data-pane-designer-slot="inspector"]')).toBeTruthy()
    const designerRoot = document.querySelector('[data-pane-designer-providers]')
    expect(designerRoot?.getAttribute('data-pane-designer-providers')).toBe('registry')
    expect(document.querySelector('[data-designer-palette-kind="dsh.explorer"]')).toBeTruthy()
    expect(document.querySelector('[data-designer-palette-kind="dsh.source-control"]')).toBeTruthy()
    expect(document.querySelector('[data-designer-palette-kind="dsh.workspace-designer"]')).toBeNull()
    expect(document.querySelector('[data-designer-palette-kind="dsh.tool-details"]')).toBeNull()
    expect(document.querySelector('[data-designer-palette-kind="file.preview"]')).toBeNull()
  })

  it('places a live extra registration from the chrome-mounted Designer without mounting that view', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registerPaneWorkbenchCoreViews(registry)
    registry.registerView({
      descriptor: {
        kind: 'notes.inbox',
        label: 'notes.inbox',
        componentKey: 'notes-inbox',
        role: 'content',
        preferredRegion: 'right',
        retention: 'recreate',
        singleton: false,
      },
      component: () => createElement('div', { 'data-live-view': 'notes.inbox' }, 'live:notes.inbox'),
      showInPicker: true,
    })
    registry.registerView({
      descriptor: {
        kind: 'hidden.inspector',
        label: 'hidden.inspector',
        componentKey: 'hidden-inspector',
        role: 'inspector',
        preferredRegion: 'right',
        retention: 'recreate',
        singleton: true,
      },
      component: () => createElement('div', { 'data-live-view': 'hidden.inspector' }, 'live:hidden'),
      showInPicker: false,
    })
    const controller = new PaneWorkbenchController({ registry })
    openPaneWorkbenchCoreView(controller, DSH_WORKSPACE_DESIGNER_VIEW_KIND)
    render(createElement(PaneRegionChrome, {
      region: 'right',
      mode: 'dock',
      width: 480,
      height: 800,
      visible: true,
      maximized: true,
      registry,
      controller,
    }))
    expect(screen.getByRole('option', { name: 'notes.inbox' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'hidden.inspector' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'dsh.workspace-designer' })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'notes.inbox' }))
    const placed = document.querySelector('[data-designer-placement="notes.inbox"]')
    expect(placed?.getAttribute('data-designer-placement-region')).toBe('right')
    expect(placed?.getAttribute('data-designer-placement-role')).toBe('content')
    expect(document.querySelector('[data-live-view="notes.inbox"]')).toBeNull()
    expect(document.body.textContent).not.toContain('live:notes.inbox')
  })
})

describe('V4 Task 6.7 Future Page Adapter', () => {
  it('keeps Designer on the Core View path when the official adapter is absent', () => {
    let opened = 0
    const probe = probeWorkspaceSettingsPageAdapter(undefined)
    expect(probe.available).toBe(false)
    const delivery = openWorkspaceDesignerDelivery(() => { opened += 1 }, undefined)
    expect(delivery.path).toBe('core-view')
    expect(opened).toBe(1)
    expect(openWorkspaceDesignerDelivery(() => { opened += 1 }, { version: 'private-router' }).path).toBe('core-view')
  })
})
