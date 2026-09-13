/**
 * 3D Director visual evidence matrix (dsh-3d-director-gltf-workbench-v1, task 4.3).
 *
 * Renders the real built `@yeisme/dsh-client-ui-3d-director` ESM bundle over a
 * fixture `scene3dDirector` remote (synthetic SceneDocumentV1 + ShotV1 +
 * CanvasBindingV1; no host, no GLB bytes, no owner execution). The viewport is
 * pinned to the scene-tree fallback for deterministic headless evidence.
 * Matrix: desktop default (Shot navigation + degraded scene tree + timeline +
 * change sets), revision-conflict freeze bar, capability-blocked export gaps,
 * and the <=420 narrow container.
 */
import { test, expect } from '@playwright/test'

async function openDirector(page: import('@playwright/test').Page, scenario: string, width = 1152) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`/3d-director?case=${scenario}&width=${width}`)
  await expect(page.locator('body')).toHaveAttribute('data-director3d-mounted', scenario)
  return errors
}

async function waitReady(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-3d-director]')).toBeVisible()
  await expect(page.getByRole('listbox', { name: 'Shots' })).toBeVisible()
  await expect(page.getByRole('tree', { name: 'Scene nodes' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Keyframes' })).toBeVisible()
}

test('desktop default renders Shot navigation, degraded viewport tree, timeline and change sets', async ({ page }, testInfo) => {
  const errors = await openDirector(page, 'desktop')
  await waitReady(page)
  await expect(page.getByRole('button', { name: 'Export GLB' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  await expect(page.getByRole('option', { name: /shot:opening/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('1 recorded')).toBeVisible()
  await expect(page.getByText(/Previewing shot shot:opening at frame 0/)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('3d-director-desktop-1152.png'), fullPage: true })

  // Shot switch: selection convergence picks the camera node and resets the playhead.
  await page.getByRole('option', { name: /shot:rooftop/ }).click()
  await expect(page.getByRole('option', { name: /shot:rooftop/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(/Previewing shot shot:rooftop at frame 48/)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('3d-director-desktop-shot-switch.png'), fullPage: true })

  // Scrub the playhead: step-sampled preview stays display-only.
  await page.getByRole('slider', { name: 'Scrub playhead' }).fill('72')
  await expect(page.getByText(/Previewing shot shot:rooftop at frame 72/)).toBeVisible()

  // Picking a node in the tree marks the bound Shot row without switching shots.
  await page.getByRole('treeitem', { name: /Hero/ }).click()
  await expect(page.getByRole('option', { name: /shot:opening/ })).toHaveAttribute('data-bound', 'true')
  await expect(page.getByRole('treeitem', { name: /Hero/ })).toHaveAttribute('aria-selected', 'true')
  await page.screenshot({ path: testInfo.outputPath('3d-director-desktop-node-pick.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('revision conflict freezes writes with a bounded summary and owner reconcile entries', async ({ page }, testInfo) => {
  const errors = await openDirector(page, 'conflict')
  await waitReady(page)
  const freezeBar = page.locator('[data-conflict-frozen]')
  await expect(freezeBar).toBeVisible()
  await expect(freezeBar.getByText(/Local draft is based on revision 3 with 1 unconfirmed edit/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Reapply my draft onto revision 4/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Discard my draft' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Export GLB' })).toBeDisabled()
  await expect(page.locator('.d3d-timeline')).toHaveAttribute('data-disabled', 'true')
  await expect(page.getByText('Revision conflict — frozen')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('3d-director-conflict-frozen.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('capability-blocked export shows the concrete gaps and keeps the control disabled', async ({ page }, testInfo) => {
  const errors = await openDirector(page, 'export-blocked')
  await waitReady(page)
  const exportButton = page.getByRole('button', { name: 'Export GLB' })
  await expect(exportButton).toBeDisabled()
  await expect(exportButton).toHaveAttribute('title', /blocked by capability gaps/)
  const blocked = page.locator('[data-export-blocked]')
  await expect(blocked).toBeVisible()
  await expect(blocked.getByText(/KHR_draco_mesh_compression: Draco-compressed meshes cannot be re-encoded/)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('3d-director-export-blocked.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('narrow width keeps Shot navigation, viewport tree and timeline readable without overflow', async ({ page }, testInfo) => {
  const errors = await openDirector(page, 'narrow', 400)
  await waitReady(page)
  const frame = page.locator('#fixture-frame')
  await expect(frame).toHaveAttribute('data-fixture-width', '400')
  const overflow = await frame.evaluate(element => element.scrollWidth - element.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page.getByRole('option', { name: /shot:opening/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('3d-director-narrow-400.png'), fullPage: true })
  expect(errors).toEqual([])
})
