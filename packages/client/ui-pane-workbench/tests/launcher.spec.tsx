// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaneWorkbenchLauncher } from '../src/client.js'
import { PaneWorkbenchController } from '../src/controller.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { pluginDefinition } from './fixtures.js'

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function registryWithView() {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: {
      ...pluginDefinition('pinax.notes-preview').views[0],
      kind: 'pinax.notes-preview.view',
    },
    component: () => createElement('p', null, 'Ready view'),
  })
  return registry
}

describe('PaneWorkbenchLauncher', () => {
  it('stays dormant with only a Show button before activation', () => {
    const controller = new PaneWorkbenchController()
    render(createElement(PaneWorkbenchLauncher, { registry: registryWithView(), controller }))
    expect(screen.getByRole('button', { name: 'Show Pane Workbench' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Hide Pane Workbench' })).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('mounts the full workbench after the Show button is clicked', () => {
    const controller = new PaneWorkbenchController()
    render(createElement(PaneWorkbenchLauncher, { registry: registryWithView(), controller }))
    fireEvent.click(screen.getByRole('button', { name: 'Show Pane Workbench' }))
    expect(screen.getByRole('button', { name: 'Hide Pane Workbench' })).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'Pane Workbench' }).getAttribute('data-pane-workbench-visible')).toBe('true')
  })

  it('flushes a pending openView when activation mounts the chrome', () => {
    const controller = new PaneWorkbenchController()
    controller.openView({
      kind: 'pinax.notes-preview.view',
      resourceKey: 'artifact:notes:1',
      role: 'content',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: false,
      pinned: true,
    })
    render(createElement(PaneWorkbenchLauncher, { registry: registryWithView(), controller }))
    expect(screen.getByRole('button', { name: 'Hide Pane Workbench' })).toBeTruthy()
    expect(screen.getByRole('tab')).toBeTruthy()
  })

  it('keeps the chrome mounted but collapsed after hiding, preserving state', () => {
    const controller = new PaneWorkbenchController()
    render(createElement(PaneWorkbenchLauncher, { registry: registryWithView(), controller }))
    fireEvent.click(screen.getByRole('button', { name: 'Show Pane Workbench' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide Pane Workbench' }))
    expect(screen.getByRole('button', { name: 'Show Pane Workbench' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Hide Pane Workbench' })).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Pane Workbench' }).getAttribute('data-pane-workbench-visible')).toBe('false')
  })
})
