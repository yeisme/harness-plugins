// Real Host + real Tools bundle; synthetic sessions, local advertised tools, zero execution.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { launchWebScaffold, seedSession, type WebScaffold } from './scaffold.ts'
import { newEnglishPage } from './support.ts'

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url))
const A = 'tools-discovery-alpha', B = 'tools-discovery-beta'
function seed(title: string): string {
  return [
    { type: 'session', version: 0, id: '{{session:1}}', createdAt: 1788739200000, cwd: '{{cwd}}' },
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'user/message', data: { role: 'user', content: [{ type: 'text', text: `${title} fixture` }], source: { kind: 'user' }, id: '{{message:1}}' }, surfaceOp: 'append' },
    { type: 'session/title', data: { title, messageSeqs: [], source: { kind: 'user' } } },
    { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n'
}

describe('Tools discovery and bound draft real Host', () => {
  let scaffold: WebScaffold, browser: Browser, page: Page, scratch: string
  let calls = 0, stop: (() => void) | undefined
  const conversation = (id: string) => page.locator(`[data-workspace-pane="conversation:${id}"]`)
  const tab = (id: string) => page.locator(`[data-workspace-tab="conversation:${id}"]`)
  const open = async (id: string) => {
    await page.locator(`[data-workspace-session-id="${id}"]`).click()
    await tab(id).dblclick()
    const chat = conversation(id).getByRole('tab', { name: /^(Chat|Conversation|对话|聊天)$/ })
    if (await chat.count()) await chat.click()
    const input = conversation(id).locator('[data-composer-input][contenteditable="true"]')
    await input.waitFor()
    return input
  }
  beforeAll(async () => {
    scratch = await mkdtemp(join(tmpdir(), 'dsh-tools-discovery-e2e-'))
    const overlay = join(scratch, 'overlay.yml')
    const base = await readFile(join(ROOT, 'upstream-prs/composer-multi-reference-v1/plugin-overlay.yml'), 'utf8')
    await writeFile(overlay, `${base}\n- insert:\n    - id: tools-discovery\n      name: '@yeisme/dsh-mcp-inspector'\n`)
    scaffold = await launchWebScaffold({ compareReplaySession: false, extraOverlayPath: overlay, extraInstallAnchors: [
      'pane-workbench', 'dsh-desktop-workbench', 'dsh-selection-annotation', 'dsh-mcp-inspector',
    ].map(name => join(ROOT, 'packages/bundle', name, 'package.json')) })
    stop = scaffold.ctx.on('llm/stream', (_options, next) => { calls++; return next() })
    const a = await seedSession(scaffold, seed('Tools Alpha'), A)
    const b = await seedSession(scaffold, seed('Tools Beta'), B)
    const workspace = await scaffold.ctx.workspaceRegistry.create(scaffold.workspaceCwd)
    await workspace.attachSession(a); await workspace.attachSession(b)
    browser = await chromium.launch(process.env.DSH_TEST_CHROME_EXECUTABLE ? { executablePath: process.env.DSH_TEST_CHROME_EXECUTABLE } : {})
    page = await newEnglishPage(browser)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.locator('[data-unified-workspace]').waitFor({ timeout: 30_000 })
  }, 120_000)
  afterAll(async () => { stop?.(); await browser?.close(); await scaffold?.close(); if (scratch) await rm(scratch, { recursive: true, force: true }) })

  it('fills Tools slot, adds references to A without navigation, preserves B, and restores transcript width', async () => {
    onTestFailed(async () => {
      if (page && process.env.DSH_TOOLS_EVIDENCE_DIR) await page.screenshot({ path: join(process.env.DSH_TOOLS_EVIDENCE_DIR, 'failure.png') }).catch(() => {})
    })
    const b = await open(B)
    await b.fill('B_DRAFT_KEEP')
    const a = await open(A)
    await a.fill('A_DRAFT_KEEP')
    const widthBefore = await conversation(A).locator('[data-width-handle]').count()
    expect(widthBefore).toBe(2)
    await conversation(A).getByRole('tab', { name: /^(Tools|工具)$/ }).click()
    const tools = conversation(A).locator('[data-mcp-inspector]')
    await tools.waitFor()
    await expect.poll(() => tools.getAttribute('data-catalog-state'), { timeout: 20_000 }).toBe('ready')
    expect(await conversation(A).locator('[data-width-handle]').evaluateAll(rows => rows.every(el => getComputedStyle(el).display === 'none'))).toBe(true)
    const settleGeometry = () => page.evaluate(() => new Promise<void>(accept => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => accept())))))
    await settleGeometry()
    const chromeWidth = 1680 - await tools.evaluate(el => el.clientWidth)
    for (const width of [360, 560, 960]) {
      let viewportWidth = Math.ceil(width + chromeWidth)
      // Host sidebar concession is asynchronous and changes its own width.
      // Allocate the requested Pane width after that settles, not a stale viewport delta.
      for (let attempt = 0; attempt < 4; attempt++) {
        await page.setViewportSize({ width: viewportWidth, height: 800 })
        await settleGeometry()
        const actual = await tools.evaluate(el => el.clientWidth)
        if (Math.abs(actual - width) <= 2) break
        viewportWidth = Math.ceil(viewportWidth + width - actual)
      }
      await settleGeometry()
      const geometry = await tools.evaluate(el => ({ width: el.clientWidth, overflow: el.scrollWidth > el.clientWidth + 1 }))
      if (process.env.DSH_TOOLS_EVIDENCE_DIR) {
        await page.screenshot({ path: join(process.env.DSH_TOOLS_EVIDENCE_DIR, `tools-real-${width}.png`) })
        const overflow = await tools.evaluate(el => {
          const box = el.getBoundingClientRect()
          return [...el.querySelectorAll('*')].filter(node => node.getBoundingClientRect().right > box.right + 1).map(node => ({ tag: node.tagName, className: node.className, width: node.getBoundingClientRect().width, right: node.getBoundingClientRect().right, paneRight: box.right })).slice(0, 25)
        })
        await writeFile(join(process.env.DSH_TOOLS_EVIDENCE_DIR, `geometry-${width}.json`), JSON.stringify({ geometry, overflow }, null, 2))
      }
      expect(geometry.width).toBeGreaterThanOrEqual(width - 2)
      expect(geometry.overflow).toBe(false)
    }
    await page.setViewportSize({ width: 1680, height: 1000 })
    await tools.locator('.tools-row-main').first().click()
    const firstId = await tools.locator('[data-tools-add-draft]').getAttribute('data-tools-add-draft')
    const add = tools.locator('[data-tools-add-draft]').first()
    await expect.poll(() => add.isEnabled(), { timeout: 20_000 }).toBe(true)
    await add.click()
    await expect.poll(() => tools.locator('[data-tools-draft-status]').textContent(), { timeout: 20_000 }).toMatch(/added|already|已加入/i)
    await add.click()
    await expect.poll(() => tools.locator('[data-tools-draft-status]').textContent(), { timeout: 20_000 }).toMatch(/already|已存在|已在/i)
    expect(await conversation(A).getByRole('tab', { name: /^(Tools|工具)$/ }).getAttribute('aria-selected')).toBe('true')
    const more = tools.getByRole('button', { name: /^(More|更多)$/ })
    if (await more.count()) await more.click()
    const pin = page.getByRole('menuitem', { name: /Pin to side pane|固定到旁栏/ })
    if (await pin.count()) await pin.click()
    else await tools.getByRole('button', { name: /Pin to side pane|固定到旁栏/ }).click()
    const companion = page.locator(`[data-workspace-pane*="mcp-inspector"][data-session-ref="${A}"]`)
    await companion.waitFor()
    const splitter = page.locator('[data-workspace-split]').first()
    const ratioBefore = await splitter.getAttribute('aria-valuenow')
    const box = await splitter.boundingBox()
    if (!box) throw new Error('Expected the real Workbench split boundary')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect.poll(() => splitter.getAttribute('aria-valuenow')).not.toBe(ratioBefore)
    const aInput = await open(A)
    expect(await aInput.textContent()).toContain('A_DRAFT_KEEP')
    expect(await aInput.locator('[data-composer-chip]').count()).toBe(1)
    const bInput = await open(B)
    expect(await bInput.textContent()).toContain('B_DRAFT_KEEP')
    expect(await bInput.locator('[data-composer-chip]').count()).toBe(0)
    const companionTools = companion.locator('[data-mcp-inspector]')
    const back = companionTools.getByRole('button', { name: /Back to catalog|返回目录/ })
    if (await back.count()) await back.click()
    await companionTools.locator('.tools-row-main').nth(1).click()
    const next = companionTools.locator('[data-tools-add-draft]:not(:disabled)').first()
    await expect.poll(() => next.count(), { timeout: 20_000 }).toBeGreaterThan(0)
    expect(await next.getAttribute('data-tools-add-draft')).not.toBe(firstId)
    await next.click()
    await expect.poll(() => companionTools.locator('[data-tools-draft-status]').textContent(), { timeout: 20_000 }).toMatch(/added|already|已加入/i)
    expect(await bInput.textContent()).toContain('B_DRAFT_KEEP')
    expect(await bInput.locator('[data-composer-chip]').count()).toBe(0)
    expect(await conversation(B).isVisible()).toBe(true)
    const after = await open(A)
    expect(await after.textContent()).toContain('A_DRAFT_KEEP')
    expect(await after.locator('[data-composer-chip]').count()).toBe(2)
    expect(await conversation(A).locator('[data-width-handle]').first().evaluate(el => getComputedStyle(el).display !== 'none')).toBe(true)
    expect(calls).toBe(0)
    const evidence = process.env.DSH_TOOLS_EVIDENCE_DIR
    if (evidence) {
      await mkdir(evidence, { recursive: true })
      await page.screenshot({ path: join(evidence, 'tools-real-host.png') })
      await writeFile(join(evidence, 'host-checks.json'), JSON.stringify({ model_requests: calls, bound_target: 'synthetic-A', preserved_other_draft: true, acknowledged_references: 2, tools_handles_hidden: true, transcript_handles_restored: true }))
    }
  })
})
