// @vitest-environment jsdom
import { createElement, useEffect } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaneWorkbenchChrome, PaneViewRegistry, createPaneWorkspace, reducePaneWorkspace } from '../src/index.js'
import { pluginDefinition } from './fixtures.js'

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function stateWithView() {
  return reducePaneWorkspace(createPaneWorkspace(), {
    type: 'open_view',
    request: {
      kind: 'pinax.notes-preview.view',
      resourceKey: 'artifact:notes:1',
      role: 'content',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: false,
      preview: false,
      pinned: true,
    },
  }).state
}

function registryFor(component: (props: { readonly retry: () => void }) => unknown) {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: {
      ...pluginDefinition('pinax.notes-preview').views[0],
      kind: 'pinax.notes-preview.view',
    },
    component,
  })
  return registry
}

describe('PaneWorkbenchChrome view boundary', () => {
  it('clears a captured error with Retry', () => {
    let shouldThrow = true
    const registry = registryFor(() => {
      if (shouldThrow) throw new Error('view crashed')
      return createElement('p', null, 'Recovered view')
    })
    render(createElement(PaneWorkbenchChrome, { initialState: stateWithView(), registry }))
    expect(screen.getByRole('alert')).toBeTruthy()
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('Recovered view')).toBeTruthy()
  })

  it('increments the observable generation and remounts on Reload View', () => {
    let shouldThrow = true
    let mounts = 0
    const registry = registryFor(() => {
      useEffect(() => { mounts += 1 }, [])
      if (shouldThrow) throw new Error('view crashed')
      return createElement('p', null, `Recovered view ${mounts}`)
    })
    render(createElement(PaneWorkbenchChrome, { initialState: stateWithView(), registry }))
    expect(screen.getByRole('alert').getAttribute('data-pane-view-generation')).toBe('0')
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Reload View' }))
    expect(screen.getByText('Recovered view 0')).toBeTruthy()
    expect(document.querySelector('[data-pane-view-generation]')?.getAttribute('data-pane-view-generation')).toBe('1')
    expect(mounts).toBe(1)
  })
})
