// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ChangeSetPanel } from '../src/ChangeSetPanel.tsx'
import { Scene3DController } from '../src/scene3d-controller.ts'
import type { Scene3DDirectorRemote } from '../src/remote.ts'
import { changeSetFixture, sceneDocumentFixture, scope } from './fixtures.ts'

let container: HTMLElement
let root: Root | undefined
let controllers: Scene3DController[]
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  controllers = []
})
afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.dispose()
  if (root !== undefined) await act(async () => root?.unmount())
  root = undefined
  container.remove()
})

function setupRemote(options: {
  changeSets?: unknown
  controls?: Partial<Pick<Scene3DDirectorRemote, 'previewChangeSet' | 'acceptChangeSet' | 'rejectChangeSet' | 'rollbackChangeSet'>>
  omitControls?: boolean
} = {}): Scene3DDirectorRemote {
  return {
    sceneRead: vi.fn(async () => ({ status: 'ready', document: sceneDocumentFixture() })),
    saveScene: vi.fn(async request => ({ status: 'saved', requestId: (request as { requestId: string }).requestId, version: (request as { document: { version: number } }).document.version + 1 })),
    reconcileScene: vi.fn(async () => ({ status: 'unknown' })),
    importGlb: vi.fn(async () => ({ status: 'unavailable' })),
    exportGlb: vi.fn(async () => ({ status: 'unavailable' })),
    listChangeSets: vi.fn(async () => options.changeSets ?? { status: 'ready', changeSets: [changeSetFixture()] }),
    ...(options.omitControls === true ? {} : {
      previewChangeSet: vi.fn(async () => ({ status: 'ready', changeSet: changeSetFixture(), currentVersion: 3, baseRevisionRetained: true })),
      acceptChangeSet: vi.fn(async () => ({ status: 'accepted', changeSet: changeSetFixture({ status: 'accepted', rollbackRef: 'scene-revision:main@3' }), version: 4 })),
      rejectChangeSet: vi.fn(async () => ({ status: 'updated', changeSet: changeSetFixture({ status: 'rejected' }) })),
      rollbackChangeSet: vi.fn(async () => ({ status: 'rolled_back', changeSet: changeSetFixture({ status: 'rolled_back', rollbackRef: 'scene-revision:main@4' }), version: 4 })),
      ...options.controls,
    }),
  }
}

async function mountPanel(remote: Scene3DDirectorRemote): Promise<Scene3DController> {
  const controller = new Scene3DController(remote, { scope: { ...scope }, documentId: 'main' }, { newId: () => 'cs-op-1' })
  controllers.push(controller)
  await controller.load()
  await controller.refreshChangeSets()
  const localRoot = createRoot(container)
  root = localRoot
  const renderPanel = (): void => {
    localRoot.render(createElement(ChangeSetPanel, { state: controller.getSnapshot(), controller }))
  }
  await act(async () => renderPanel())
  // Re-render on controller publishes; dispose (afterEach) silences late flights.
  controller.subscribe(() => renderPanel())
  return controller
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(entry => entry.textContent === label) as HTMLButtonElement | undefined
  expect(found, `button ${label}`).toBeDefined()
  return found!
}

describe('ChangeSetPanel states', () => {
  it('degrades to an explanatory empty state when the listing is unavailable or empty', async () => {
    const first = await mountPanel(setupRemote({ changeSets: { status: 'unavailable' } }))
    expect(container.textContent).toContain('Change sets unavailable')
    first.dispose()
    await act(async () => root?.unmount())
    root = undefined
    await mountPanel(setupRemote({ changeSets: { status: 'ready', changeSets: [] } }))
    expect(container.textContent).toContain('No generation change sets')
  })

  it('renders each change set with a text status, summary and base revision', async () => {
    await mountPanel(setupRemote())
    expect(container.textContent).toContain('preview')
    expect(container.textContent).toContain('Regenerate hero transform')
    expect(container.textContent).toContain('base rev 3')
  })

  it('disables every action with the seam reason when the host predates change-set controls', async () => {
    await mountPanel(setupRemote({ omitControls: true }))
    for (const label of ['Preview', 'Accept', 'Reject', 'Rollback']) {
      expect(button(label).disabled).toBe(true)
      expect(button(label).title).toContain('does not expose change-set controls')
    }
  })

  it('gates actions by audited status: preview accepts/rejects, rollback stays disabled with its reason', async () => {
    await mountPanel(setupRemote())
    expect(button('Accept').disabled).toBe(false)
    expect(button('Reject').disabled).toBe(false)
    expect(button('Rollback').disabled).toBe(true)
    expect(button('Rollback').title).toContain('Only accepted change sets')
  })

  it('enables only rollback for an accepted change set with a rollback pointer', async () => {
    const accepted = changeSetFixture({ status: 'accepted', artifactRef: changeSetFixture().artifactRef, rollbackRef: 'scene-revision:main@3' })
    await mountPanel(setupRemote({ changeSets: { status: 'ready', changeSets: [accepted] } }))
    expect(button('Rollback').disabled).toBe(false)
    expect(button('Accept').disabled).toBe(true)
    expect(button('Accept').title).toContain('accepted')
    expect(button('Reject').disabled).toBe(true)
  })

  it('disables accept and rollback with the frozen reason while conflict-frozen', async () => {
    const remote = setupRemote({ controls: { acceptChangeSet: vi.fn(async () => ({ status: 'conflict', version: 7 })) } })
    const controller = await mountPanel(remote)
    await act(async () => { controller.editNodeTransform('hero', { translate: [5, 0, 0] }) })
    await act(async () => { await controller.acceptChangeSet('changeset:one') })
    expect(controller.getSnapshot().frozen).toBe(true)
    expect(button('Accept').disabled).toBe(true)
    expect(button('Accept').title).toContain('frozen')
    expect(button('Rollback').disabled).toBe(true)
    // Reject stays available while frozen: it never writes the scene.
    expect(button('Reject').disabled).toBe(false)
  })

  it('disables rollback with the draft reason while local edits are unsaved', async () => {
    const accepted = changeSetFixture({ status: 'accepted', rollbackRef: 'scene-revision:main@3' })
    const remote = setupRemote({ changeSets: { status: 'ready', changeSets: [accepted] } })
    const controller = await mountPanel(remote)
    await act(async () => { controller.setNodeVisibility('hero', false) })
    expect(controller.getSnapshot().dirty).toBe(true)
    expect(button('Rollback').disabled).toBe(true)
    expect(button('Rollback').title).toContain('Save or discard')
  })
})

describe('ChangeSetPanel action routing', () => {
  it('routes Accept through the controller and shows the committed revision notice', async () => {
    const remote = setupRemote()
    const controller = await mountPanel(remote)
    await act(async () => { controller.editNodeTransform('hero', { translate: [2, 0, 0] }) })
    await act(async () => button('Accept').click())
    expect(remote.acceptChangeSet).toHaveBeenCalledWith(expect.objectContaining({ changeSetRef: 'changeset:one', requestId: 'cs-op-1' }))
    expect(container.textContent).toContain('Accepted — committed as revision 4.')
  })

  it('routes Reject with the audited record staying listed', async () => {
    const remote = setupRemote()
    await mountPanel(remote)
    await act(async () => button('Reject').click())
    expect(remote.rejectChangeSet).toHaveBeenCalledWith(expect.objectContaining({ changeSetRef: 'changeset:one' }))
    expect(container.textContent).toContain('Rejected — the audited record stays.')
  })

  it('routes Rollback for an accepted change set and reports the restored revision', async () => {
    const accepted = changeSetFixture({ status: 'accepted', rollbackRef: 'scene-revision:main@3' })
    const remote = setupRemote({ changeSets: { status: 'ready', changeSets: [accepted] } })
    await mountPanel(remote)
    await act(async () => button('Rollback').click())
    expect(remote.rollbackChangeSet).toHaveBeenCalledWith(expect.objectContaining({ changeSetRef: 'changeset:one', requestId: 'cs-op-1' }))
    expect(container.textContent).toContain('Rolled back — the prior revision was restored as revision 4.')
  })

  it('toggles the read-only preview comparison (summary, inputs, digest, base revision)', async () => {
    const remote = setupRemote()
    await mountPanel(remote)
    await act(async () => button('Preview').click())
    expect(remote.previewChangeSet).toHaveBeenCalledWith(expect.objectContaining({ changeSetRef: 'changeset:one' }))
    const preview = container.querySelector('[data-changeset-preview]')
    expect(preview).not.toBeNull()
    expect(preview?.textContent).toContain('sha256:')
    expect(preview?.textContent).toContain('base retained')
    await act(async () => button('Preview').click())
    expect(container.querySelector('[data-changeset-preview]')).toBeNull()
  })

  it('shows a bounded failure notice when the host refuses an action', async () => {
    const remote = setupRemote({ controls: { acceptChangeSet: vi.fn(async () => ({ status: 'invalid_transition', from: 'rejected', to: 'accepted' })) } })
    const controller = await mountPanel(remote)
    await act(async () => { controller.editNodeTransform('hero', { translate: [2, 0, 0] }) })
    await act(async () => button('Accept').click())
    const notices = Array.from(container.querySelectorAll('[role="status"]')).map(entry => entry.textContent ?? '')
    expect(notices.some(text => text.includes('rejected'))).toBe(true)
  })
})
