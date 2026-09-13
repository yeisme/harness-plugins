// @vitest-environment jsdom
/**
 * Scene3D embed — pane render chain (fixture tier).
 *
 * Covers the probe-first Inspector 3D section (hidden until a shot is
 * selected, disabled with reason when the scene3dDirector seam is missing),
 * the docked viewport region lifecycle in the shell, and the jsdom scene-tree
 * fallback interactions (equal selection contract with the WebGL viewport,
 * 3D → canvas picks without ping-pong).
 *
 * Controller-logic coverage (binding lookup, echo fence, lifecycle, probe)
 * lives in `pipeline-scene3d.spec.tsx`.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor, within } from '@testing-library/react'
import type { Scene3DDirectorRemote } from '@yeisme/dsh-client-ui-3d-director'
import {
  createPipelineFixtureOwner,
  createPipelineFixtureScene3DRemote,
  PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT,
  PIPELINE_FIXTURE_SCENE_3D_DOCUMENT_ID,
  PIPELINE_FIXTURE_SHOT_REF,
} from '../src/client/pipeline/fixture-owner.js'
import {
  clickObjectRow,
  installScene3DJSDOMEnvironment,
  ownerWithoutScene3DRemote,
  renderPipelineWorkbench,
} from './helpers/scene3d.js'

installScene3DJSDOMEnvironment()

describe('scene3d pane render chain — Inspector entry + docked viewport region', () => {
  it('surfaces the 3D section on shot selection and docks the viewport region with the bound object highlighted', async () => {
    const { container } = await renderPipelineWorkbench()
    expect(container.querySelector('[data-pipeline-scene3d-section]')).toBeNull()

    // Select the shot node through the compact object list: jsdom cannot
    // evaluate React Flow's visibility culling, and the object list routes
    // through the same controller.selectObject canvas selection source.
    clickObjectRow(container, 'Shot 04')
    const section = await waitFor(() => {
      const node = container.querySelector('[data-pipeline-scene3d-section]')
      expect(node).toBeTruthy()
      return node!
    })
    expect(section.textContent).toContain(PIPELINE_FIXTURE_SHOT_REF)
    // Queries stay scoped to the rendered container: the shell also portals an
    // Inspector copy onto document.body, which would duplicate global matches.
    const inSection = within(section as HTMLElement)
    expect(inSection.getByText(PIPELINE_FIXTURE_SCENE_3D_DOCUMENT_ID)).toBeTruthy()

    const toggle = await inSection.findByRole('button', { name: 'Open 3D viewport' })
    expect((toggle as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(toggle)

    // jsdom has no WebGL: the equal-selection scene-tree fallback renders.
    const region = await waitFor(() => {
      const node = container.querySelector('[data-pipeline-scene3d-region]')
      expect(node).toBeTruthy()
      return node!
    })
    expect(within(region).getByText(`3D viewport · ${PIPELINE_FIXTURE_SCENE_3D_DOCUMENT_ID}`)).toBeTruthy()
    const tree = await within(region).findByRole('tree', { name: 'Scene nodes' })
    expect(tree.querySelector(`[data-node-id="${PIPELINE_FIXTURE_SCENE_3D_BOUND_OBJECT}"]`)?.getAttribute('aria-selected')).toBe('true')

    // Region head close (the Inspector section carries a second Close button).
    fireEvent.click(container.querySelector<HTMLButtonElement>('.plw-scene3d-close')!)
    await waitFor(() => expect(container.querySelector('[data-pipeline-scene3d-region]')).toBeNull())
  })

  it('routes fallback-tree picks back to the canvas selection without ping-pong', async () => {
    const { container } = await renderPipelineWorkbench()
    clickObjectRow(container, 'Shot 04')
    fireEvent.click(await within(container).findByRole('button', { name: 'Open 3D viewport' }))
    const region = await waitFor(() => {
      const node = container.querySelector('[data-pipeline-scene3d-region]')
      expect(node).toBeTruthy()
      return node!
    })
    await waitFor(() => expect(region.querySelector('[role="tree"]')).toBeTruthy())

    // 3D → canvas through the fallback tree: picking Lin selects the character node.
    fireEvent.click(within(region).getByRole('treeitem', { name: /Lin \(lead\)/ }))
    await waitFor(() => {
      const row = container.querySelector('.plw-object-row[data-selected="true"]')
      expect(row?.textContent).toContain('Lin (lead)')
    })

    // Picking the rooftop selects the scene node on the canvas, and the pick
    // highlights the picked object in the viewport (no ping-pong rewrite).
    fireEvent.click(region.querySelector('[data-node-id="scene3d:rooftop"]')!)
    await waitFor(() => {
      const row = [...container.querySelectorAll('.plw-object-row')].find(item => item.textContent?.includes('Rooftop night rain'))
      expect(row?.getAttribute('data-selected')).toBe('true')
    })
    expect(region.querySelector('[data-node-id="scene3d:rooftop"]')?.getAttribute('aria-selected')).toBe('true')
  })

  it('renders the entry disabled with the probe reason and no working action when the scene3dDirector seam is absent', async () => {
    const { container } = await renderPipelineWorkbench(ownerWithoutScene3DRemote())
    clickObjectRow(container, 'Shot 04')

    const section = await waitFor(() => {
      const node = container.querySelector('[data-pipeline-scene3d-section]')
      expect(node).toBeTruthy()
      return node!
    })
    expect(section.textContent).toContain('scene3dDirector remote seam is not mounted')

    const open = await within(section as HTMLElement).findByRole('button', { name: /^Open 3D viewport: / })
    expect(open.getAttribute('aria-disabled')).toBe('true')
    expect(open.getAttribute('aria-label')).toContain('scene3dDirector remote seam is not mounted')
    // Disabled entry is not a dead button: clicking opens nothing.
    fireEvent.click(open)
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(container.querySelector('[data-pipeline-scene3d-region]')).toBeNull()
  })

  it('starts a local New scene draft when the owner has not committed a scene, without any owner write', async () => {
    const baseRemote = createPipelineFixtureScene3DRemote()
    const saveScene = vi.fn(baseRemote.saveScene)
    const remote: Scene3DDirectorRemote = { ...baseRemote, sceneRead: async () => ({ status: 'missing' }), saveScene }
    const { container } = await renderPipelineWorkbench(createPipelineFixtureOwner(), { scene3dRemote: remote })
    clickObjectRow(container, 'Shot 04')
    fireEvent.click(await within(container).findByRole('button', { name: 'Open 3D viewport' }))
    const region = await waitFor(() => {
      const node = container.querySelector('[data-pipeline-scene3d-region]')
      expect(node).toBeTruthy()
      return node!
    })

    // Missing read → honest empty state with a real next step, never a blank region.
    await within(region).findByText('No scene yet')
    fireEvent.click(within(region).getByRole('button', { name: 'New scene draft' }))

    // The draft is local-only: the region leaves the empty state behind the
    // unsaved-draft label, and nothing was written to the owner.
    await waitFor(() => expect(region.querySelector('[data-phase="empty"]')).toBeNull())
    expect(region.textContent).toContain('Unsaved draft')
    expect(saveScene).not.toHaveBeenCalled()
  })
})

describe('scene3d pane render chain — embedded editing affordances and draft save', () => {
  /** Fixture remote whose saveScene actually commits (version+1), so the Save path is exercised end to end. */
  function savingScene3DRemote() {
    const base = createPipelineFixtureScene3DRemote()
    const saveScene = vi.fn(async (request: unknown) => {
      const save = request as { requestId: string; document: { version: number } }
      return { status: 'saved', requestId: save.requestId, version: save.document.version + 1 }
    })
    const remote: Scene3DDirectorRemote = { ...base, saveScene }
    return { remote, saveScene }
  }

  it('renders the node editor for the picked scene node and routes draft edits to the unsaved state', async () => {
    const { remote, saveScene } = savingScene3DRemote()
    const { container } = await renderPipelineWorkbench(createPipelineFixtureOwner(), { scene3dRemote: remote })
    clickObjectRow(container, 'Shot 04')
    fireEvent.click(await within(container).findByRole('button', { name: 'Open 3D viewport' }))
    const region = await waitFor(() => {
      const node = container.querySelector('[data-pipeline-scene3d-region]')
      expect(node).toBeTruthy()
      return node!
    })
    await waitFor(() => expect(region.querySelector('[role="tree"]')).toBeTruthy())

    // The shot anchor selects its bound camera node: the editor shows up with the camera note.
    const editor = await waitFor(() => {
      const node = region.querySelector('.d3d-node-editor')
      expect(node).toBeTruthy()
      return node!
    })
    expect(editor.textContent).toContain('camera-specific parameters')

    // Picking another scene node re-targets the editor.
    fireEvent.click(within(region).getByRole('treeitem', { name: /Lin \(lead\)/ }))
    await waitFor(() => expect(region.querySelector('.d3d-node-editor')?.textContent).toContain('Lin (lead)'))

    // A finite translate edit lands in the local draft only — nothing is saved yet.
    const translateX = within(region).getByRole('spinbutton', { name: 'Translate X' })
    fireEvent.change(translateX, { target: { value: '2' } })
    await waitFor(() => expect(region.textContent).toContain('Unsaved draft'))
    expect(saveScene).not.toHaveBeenCalled()

    // Non-finite input is rejected with a reason and never reaches the draft.
    fireEvent.change(translateX, { target: { value: '' } })
    await waitFor(() => expect(region.querySelector('.d3d-rejection')?.textContent).toContain('finite'))
  })

  it('saves the embedded draft through the region head Save control (disabled with reason until dirty)', async () => {
    const { remote, saveScene } = savingScene3DRemote()
    const { container } = await renderPipelineWorkbench(createPipelineFixtureOwner(), { scene3dRemote: remote })
    clickObjectRow(container, 'Shot 04')
    fireEvent.click(await within(container).findByRole('button', { name: 'Open 3D viewport' }))
    const region = await waitFor(() => {
      const node = container.querySelector('[data-pipeline-scene3d-region]')
      expect(node).toBeTruthy()
      return node!
    })
    await waitFor(() => expect(region.querySelector('[role="tree"]')).toBeTruthy())

    // Clean draft: Save stays disabled with the reason, never a dead button.
    const save = container.querySelector<HTMLButtonElement>('.plw-scene3d-save')!
    expect(save.disabled).toBe(true)
    expect(save.title).toContain('No unsaved draft changes')

    // Edit → Save commits against the base revision and returns to Saved.
    fireEvent.click(within(region).getByRole('treeitem', { name: /Lin \(lead\)/ }))
    const visibility = await within(region).findByRole('checkbox', { name: /visible/i })
    fireEvent.click(visibility)
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)
    await waitFor(() => expect(region.textContent).toContain('Saved'))
    expect(saveScene).toHaveBeenCalledTimes(1)
  })
})
