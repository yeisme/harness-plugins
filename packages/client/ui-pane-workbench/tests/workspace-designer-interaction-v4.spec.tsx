// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createPaneWorkspace } from '../src/workspace.js'
import {
  createDesignerSession,
  placeDesignerProvider,
  redoDesigner,
  setDesignerRailOrder,
  undoDesigner,
} from '../src/workspace-designer.js'
import { WorkspaceDesignerInteraction } from '../src/workspace-designer-ui.js'

afterEach(cleanup)

function Harness({ compact = false }: { compact?: boolean }) {
  const [session, setSession] = useState(() => createDesignerSession(createPaneWorkspace()))
  return createElement(WorkspaceDesignerInteraction, { session, compact, onChange: setSession })
}

describe('V4 Task 6.4 Designer Interaction', () => {
  it('shares the same draft mutation for pointer and keyboard placement', () => {
    const workspace = createPaneWorkspace()
    const start = createDesignerSession(workspace)
    const pointer = placeDesignerProvider(start, { kind: 'dsh.explorer', region: 'right', role: 'navigator', singleton: true })
    const keyboard = placeDesignerProvider(start, { kind: 'dsh.explorer', region: 'right', role: 'navigator', singleton: true })
    expect(pointer.draft.providerPlacements).toEqual(keyboard.draft.providerPlacements)
    const undone = undoDesigner(pointer)
    expect(undone.draft.providerPlacements).toEqual(start.draft.providerPlacements)
    expect(redoDesigner(undone).draft.providerPlacements).toEqual(pointer.draft.providerPlacements)
    const railed = setDesignerRailOrder(start, ['source-control', 'explorer', 'customize'])
    expect(railed.draft.railOrder[0]).toBe('source-control')
  })

  it('lets palette click and keyboard confirm place a provider on desktop and 390px', () => {
    render(createElement(Harness))
    fireEvent.click(screen.getByRole('option', { name: 'dsh.explorer' }))
    expect(screen.getByRole('listitem')).toHaveProperty('textContent', 'dsh.explorer')
    cleanup()
    render(createElement(Harness, { compact: true }))
    const option = screen.getByRole('option', { name: 'terminal.session' })
    fireEvent.keyDown(option, { key: 'Enter' })
    expect(document.querySelector('[data-designer-compact="true"]')).toBeTruthy()
    expect(screen.getByRole('listitem').textContent).toBe('terminal.session')
    expect(screen.getByRole('slider', { name: 'Split ratio' })).toBeTruthy()
  })
})
