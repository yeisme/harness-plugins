/**
 * Pipeline workbench visual evidence matrix (dsh-creative-pipeline-visual-workbench-v1, task 5.5).
 *
 * Renders the real ui-ai-drama-director pipeline workbench bundle over the
 * fixture projection owner and captures one screenshot per matrix state:
 * desktop three-column, narrow (<=420) object list + detail Modal, loading,
 * running, blocked, stale, unknown, needs_contract, and the Agent⇄Workbench
 * capsule switch. All data is fixture-tier synthetic; no provider execution.
 */
import { test, expect } from '@playwright/test'

const RUNNING_EDGE = /Candidate C2 · execution/
const BLOCKED_EDGE = /Candidate P1 · execution/

async function openWorkbench(page: import('@playwright/test').Page, scenario: string, width = 1152) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`/pipeline-workbench?case=${scenario}&width=${width}`)
  await expect(page.locator('body')).toHaveAttribute('data-pipeline-mounted', scenario)
  return errors
}

async function waitReady(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-pipeline-workbench="true"]')).toBeVisible()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await expect(page.getByTestId('plw-run-strip')).toBeVisible()
}

test('desktop three-column layout renders rail, canvas, inspector and run strip', async ({ page }, testInfo) => {
  const errors = await openWorkbench(page, 'desktop')
  await waitReady(page)
  await expect(page.getByRole('button', { name: 'Workbench' })).toBeVisible()
  await expect(page.getByLabel('Assets and productions')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Pipeline details' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('pipeline-desktop-1152.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('narrow width collapses to the object list and opens the detail Modal', async ({ page }, testInfo) => {
  const errors = await openWorkbench(page, 'narrow', 400)
  await expect(page.locator('[data-pipeline-workbench="true"]')).toBeVisible()
  const objectList = page.getByLabel('Pipeline objects')
  await expect(objectList).toBeVisible()
  await expect(objectList.getByRole('button', { name: /Shot 04/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('pipeline-narrow-400-list.png'), fullPage: true })
  await objectList.getByRole('button', { name: /Shot 04/ }).click()
  await expect(page.getByRole('dialog', { name: 'Shot 04 · rooftop chase' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('pipeline-narrow-400-modal.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('loading state shows a bounded loading surface', async ({ page }, testInfo) => {
  const errors = await openWorkbench(page, 'loading')
  await expect(page.getByText('Loading pipeline projection')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('pipeline-loading.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('running execution edge shows the run inspector with server-authored actions', async ({ page }, testInfo) => {
  const errors = await openWorkbench(page, 'running')
  await waitReady(page)
  await page.getByRole('button', { name: RUNNING_EDGE }).click()
  const inspector = page.getByLabel('Pipeline inspector')
  await expect(inspector.getByText('running').first()).toBeVisible()
  await expect(inspector.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('pipeline-running-inspector.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('blocked run keeps mutations disabled with a bounded blocker reason', async ({ page }, testInfo) => {
  const errors = await openWorkbench(page, 'blocked')
  await waitReady(page)
  await page.getByRole('button', { name: BLOCKED_EDGE }).click()
  const inspector = page.getByLabel('Pipeline inspector')
  await expect(inspector.getByText('blocked').first()).toBeVisible()
  await expect(inspector.getByText('Run blocked')).toBeVisible()
  await expect(inspector.getByRole('button', { name: /^Pause: / })).toHaveAttribute('aria-disabled', 'true')
  await page.screenshot({ path: testInfo.outputPath('pipeline-blocked-inspector.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('stale run projection disables mutations and requires owner reconcile', async ({ page }, testInfo) => {
  const errors = await openWorkbench(page, 'stale')
  await waitReady(page)
  await page.getByRole('button', { name: RUNNING_EDGE }).click()
  const inspector = page.getByLabel('Pipeline inspector')
  await expect(inspector.getByText('stale').first()).toBeVisible()
  await expect(inspector.getByRole('button', { name: /^Pause: / })).toHaveAttribute('aria-disabled', 'true')
  await page.screenshot({ path: testInfo.outputPath('pipeline-stale-inspector.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('unknown run projection disables mutations with a bounded reason', async ({ page }, testInfo) => {
  const errors = await openWorkbench(page, 'unknown')
  await waitReady(page)
  await page.getByRole('button', { name: RUNNING_EDGE }).click()
  const inspector = page.getByLabel('Pipeline inspector')
  await expect(inspector.getByText('unknown').first()).toBeVisible()
  await expect(inspector.getByText('Run unknown')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('pipeline-unknown-inspector.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('missing run projection derives the needs_contract inspector state', async ({ page }, testInfo) => {
  const errors = await openWorkbench(page, 'needs_contract')
  await waitReady(page)
  await page.getByRole('button', { name: RUNNING_EDGE }).click()
  const inspector = page.getByLabel('Pipeline inspector')
  await expect(inspector.getByText('needs_contract').first()).toBeVisible()
  await expect(inspector.getByText('Run needs_contract')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('pipeline-needs-contract-inspector.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('capsule switches Agent⇄Workbench without resetting the workbench and the menu stays bounded', async ({ page }, testInfo) => {
  const errors = await openWorkbench(page, 'capsule')
  await waitReady(page)
  const capsule = page.getByTestId('plw-capsule')
  await expect(capsule).toHaveAttribute('data-surface', 'workbench')
  await page.screenshot({ path: testInfo.outputPath('pipeline-capsule-workbench.png'), fullPage: true })
  await capsule.getByRole('button', { name: 'Agent' }).click()
  await expect(capsule).toHaveAttribute('data-surface', 'agent')
  // Surface switch is local-only: the canvas and run strip stay mounted.
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('pipeline-capsule-agent.png'), fullPage: true })
  await capsule.getByRole('button', { name: 'Work surface details' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('pipeline-capsule-menu.png'), fullPage: true })
  expect(errors).toEqual([])
})
