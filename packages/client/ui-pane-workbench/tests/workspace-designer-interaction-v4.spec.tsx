// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { registerPaneWorkbenchCoreViews } from '../src/core-pane.js'
import { PaneViewRegistrationError, PaneViewRegistry } from '../src/view-registry.js'
import { createPaneWorkspace } from '../src/workspace.js'
import {
  createDesignerSession,
  listDesignerPaletteEntries,
  placeDesignerProvider,
  placementFromDesignerPaletteEntry,
  redoDesigner,
  setDesignerRailOrder,
  undoDesigner,
} from '../src/workspace-designer.js'
import { WorkspaceDesignerInteraction } from '../src/workspace-designer-ui.js'

afterEach(cleanup)

function registerKind(
  registry: PaneViewRegistry,
  kind: string,
  options: {
    showInPicker?: boolean
    role?: 'navigator' | 'content' | 'utility' | 'inspector' | 'general'
    preferredRegion?: 'right' | 'bottom' | 'either'
    singleton?: boolean
    requiredCapabilities?: readonly string[]
  } = {},
): () => void {
  return registry.registerView({
    descriptor: {
      kind,
      label: kind,
      componentKey: kind.replaceAll('.', '-'),
      role: options.role ?? 'navigator',
      preferredRegion: options.preferredRegion ?? 'right',
      retention: 'recreate',
      singleton: options.singleton ?? false,
    },
    component: () => createElement('div', { 'data-live-view': kind }, `live:${kind}`),
    showInPicker: options.showInPicker,
    requiredCapabilities: options.requiredCapabilities,
  })
}

function createLiveDesignerRegistry(): PaneViewRegistry {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registerPaneWorkbenchCoreViews(registry)
  registerKind(registry, 'notes.inbox', { role: 'content', preferredRegion: 'right' })
  registerKind(registry, 'terminal.session', { role: 'utility', preferredRegion: 'bottom' })
  registerKind(registry, 'hidden.inspector', { showInPicker: false, role: 'inspector' })
  expect(() => registerKind(registry, 'secret.vault', {
    requiredCapabilities: ['pane.secrets.v1'],
    role: 'inspector',
  })).toThrow(PaneViewRegistrationError)
  return registry
}

function Harness({ compact = false, registry }: { compact?: boolean; registry?: PaneViewRegistry }) {
  const [session, setSession] = useState(() => createDesignerSession(createPaneWorkspace()))
  return createElement(WorkspaceDesignerInteraction, { session, compact, registry, onChange: setSession })
}

describe('V4 Task 6.4 Designer Interaction', () => {
  it('shares the same draft mutation for pointer and keyboard placement', () => {
    const registry = createLiveDesignerRegistry()
    const extra = listDesignerPaletteEntries(registry.snapshot()).find(entry => entry.kind === 'notes.inbox')
    expect(extra).toBeDefined()
    const placement = placementFromDesignerPaletteEntry(extra!)
    expect(placement).toEqual({ kind: 'notes.inbox', region: 'right', role: 'content' })
    const workspace = createPaneWorkspace()
    const start = createDesignerSession(workspace)
    const pointer = placeDesignerProvider(start, placement)
    const keyboard = placeDesignerProvider(start, placement)
    expect(pointer.draft.providerPlacements).toEqual(keyboard.draft.providerPlacements)
    expect(pointer.draft.providerPlacements).toEqual([placement])
    const undone = undoDesigner(pointer)
    expect(undone.draft.providerPlacements).toEqual(start.draft.providerPlacements)
    expect(redoDesigner(undone).draft.providerPlacements).toEqual(pointer.draft.providerPlacements)
    const railed = setDesignerRailOrder(start, ['source-control', 'explorer', 'customize'])
    expect(railed.draft.railOrder[0]).toBe('source-control')
  })

  it('derives palette entries from picker-visible registry registrations', () => {
    const registry = createLiveDesignerRegistry()
    const kinds = listDesignerPaletteEntries(registry.snapshot()).map(entry => entry.kind)
    expect(kinds).toEqual(['dsh.explorer', 'dsh.source-control', 'notes.inbox', 'terminal.session'])
    expect(kinds).not.toContain('dsh.workspace-designer')
    expect(kinds).not.toContain('dsh.tool-details')
    expect(kinds).not.toContain('file.preview')
    expect(kinds).not.toContain('hidden.inspector')
    expect(kinds).not.toContain('secret.vault')
    const extra = listDesignerPaletteEntries(registry.snapshot()).find(entry => entry.kind === 'notes.inbox')
    expect(extra).toMatchObject({ region: 'right', role: 'content' })
    expect(placementFromDesignerPaletteEntry(extra!)).toEqual({
      kind: 'notes.inbox',
      region: 'right',
      role: 'content',
    })
  })

  it('lets palette click and keyboard confirm place a registry-backed kind on desktop and 390px', () => {
    const registry = createLiveDesignerRegistry()
    render(createElement(Harness, { registry }))
    expect(screen.getByRole('option', { name: 'notes.inbox' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'dsh.workspace-designer' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'hidden.inspector' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'secret.vault' })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'notes.inbox' }))
    const clicked = document.querySelector('[data-designer-placement="notes.inbox"]')
    expect(clicked).toHaveProperty('textContent', 'notes.inbox')
    expect(clicked?.getAttribute('data-designer-placement-region')).toBe('right')
    expect(clicked?.getAttribute('data-designer-placement-role')).toBe('content')
    expect(document.querySelector('[data-live-view]')).toBeNull()
    expect(document.body.textContent).not.toContain('live:')
    cleanup()
    render(createElement(Harness, { compact: true, registry }))
    const option = screen.getByRole('option', { name: 'terminal.session' })
    fireEvent.keyDown(option, { key: 'Enter' })
    expect(document.querySelector('[data-designer-compact="true"]')).toBeTruthy()
    const keyed = document.querySelector('[data-designer-placement="terminal.session"]')
    expect(keyed?.textContent).toBe('terminal.session')
    expect(keyed?.getAttribute('data-designer-placement-region')).toBe('bottom')
    expect(keyed?.getAttribute('data-designer-placement-role')).toBe('utility')
    expect(document.querySelector('[data-designer-palette-region="bottom"]')?.getAttribute('data-designer-palette-kind')).toBe('terminal.session')
    expect(screen.getByRole('slider', { name: 'Split ratio' })).toBeTruthy()
    expect(document.querySelector('[data-live-view="terminal.session"]')).toBeNull()
    expect(document.body.textContent).not.toContain('live:terminal.session')
  })
})
