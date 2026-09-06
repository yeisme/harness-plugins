// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaneCommandRegistry } from '../src/composition.js'
import { PaneWorkbenchController } from '../src/controller.js'
import { setActiveLocale } from '../src/i18n/locale.js'
import { WorkspaceSearchOverlay } from '../src/search-overlay.js'
import { PaneViewRegistry } from '../src/view-registry.js'

afterEach(() => {
  cleanup()
  setActiveLocale('en')
})

function fixture() {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: { kind: 'git.status', label: 'Git', componentKey: 'git', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { owner: 'git', keywords: ['source control'] } },
    component: () => createElement('p', null, 'Git body'),
  })
  registry.registerView({
    descriptor: { kind: 'legacy.compat', label: 'Legacy Compat', componentKey: 'legacy', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: true },
    component: () => null,
    showInPicker: false,
  })
  const commands = new PaneCommandRegistry()
  commands.register({
    descriptor: { id: 'git.open', label: 'Open Git', presentation: { owner: 'git', task: 'open-only', icon: 'git.status' } },
    execute: () => {},
  })
  commands.register({
    descriptor: { id: 'git.commit', label: 'Commit', permission: 'git.write', presentation: { owner: 'git', task: 'side-effect' } },
    execute: () => {},
  })
  const controller = new PaneWorkbenchController({ registry })
  controller.openView({ kind: 'git.status', resourceKey: 'view:git.status', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, title: 'Git' })
  return { registry, commands, controller }
}

describe('WorkspaceSearchOverlay', () => {
  it('groups empty-query results and opens the selected pane with Enter', async () => {
    const { registry, commands, controller } = fixture()
    const onClose = vi.fn()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose }))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    expect(within(dialog).getByRole('button', { name: 'Pin search as a pane' })).toBeTruthy()
    expect(within(dialog).getByText('Open')).toBeTruthy()
    expect(within(dialog).queryByRole('option', { name: /Legacy Compat/ })).toBeNull()
    const search = within(dialog).getByRole('combobox')
    fireEvent.keyDown(search, { key: 'Enter' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    fireEvent.change(search, { target: { value: 'Commit' } })
    expect(within(dialog).getByRole('option', { name: /Commit/ })).toBeTruthy()
    fireEvent.change(search, { target: { value: 'legacy.compat' } })
    expect(within(dialog).getByRole('option', { name: /Legacy Compat/ })).toBeTruthy()
  })

  it('keeps search context when a side-effect command is only selected', () => {
    const { registry, commands, controller } = fixture()
    const execute = vi.spyOn(commands, 'execute')
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Commit' } })
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('pins into a search pane without executing a result', () => {
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }))
    fireEvent.click(screen.getByRole('button', { name: 'Pin search as a pane' }))
    expect(Object.values(controller.getSnapshot().views).some(view => view.kind === 'dsh.workspace-search')).toBe(true)
  })
})
