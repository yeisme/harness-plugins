#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { installModuleProbe } from './plugin-browser-smoke.mjs'

const root = new URL('../', import.meta.url).pathname
const run = `independent-panes-host-${new Date().toISOString().replace(/[:.]/g, '-')}`
const directory = new URL(`../temp/integration-test-runs/${run}/`, import.meta.url)
await mkdir(new URL('artifacts/', directory), { recursive: true })
const checks = [], browserErrors = [], ownerReads = []
let child, browser, page, stage = 'launch', failure, output = ''
try {
  child = spawn(process.execPath, ['scripts/dsh-workbench.mjs', '--isolated', '--no-open', '--host', '127.0.0.1', '--port', '40879'], { cwd: root, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('startup_timeout')), 180000)
    const read = chunk => {
      output = (output + chunk.toString()).slice(-32000)
      const match = output.match(/http:\/\/127\.0\.0\.1:40879\/\?token=[A-Za-z0-9_-]+/u)
      if (match) { clearTimeout(timeout); resolve(match[0]) }
    }
    child.stdout.on('data', read); child.stderr.on('data', read)
    child.once('error', () => { clearTimeout(timeout); reject(new Error('startup_error')) })
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('startup_exit')) })
  })
  stage = 'browser-workspace'
  browser = await chromium.launch()
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(20000)
  page.on('response', async response => {
    if (!new URL(response.url()).pathname.startsWith('/api/creatorStudio/')) return
    const body = await response.json().catch(() => null)
    const result = body?.result ?? body
    const value = result?.value ?? result
    ownerReads.push({ method: new URL(response.url()).pathname.split('/').at(-1), http: response.status(), code: result?.error?.code, reason: value?.reasonCode, context: !!value?.context, owners: value?.owners?.map(owner => ({ owner: owner.owner, status: owner.status, transport: owner.transport })) })
  })
  page.on('pageerror', error => browserErrors.push({ name: error.name, message: error.message.replace(/http\S+/gu, '[URL]').replace(/\/[^\s]+/gu, '[PATH]').slice(0, 300) }))
  await installModuleProbe(page)
  await page.goto(url)
  await page.locator('[data-unified-workspace]').waitFor()
  stage = 'select-workspace'
  const session = page.locator('[data-workspace-session-id]').first()
  await session.waitFor()
  await session.click()
  await page.locator('[data-workspace-tab^="conversation:"]').first().dblclick()
  await page.waitForTimeout(1000)
  const onboarding = page.getByRole('dialog', { name: /Add an API key to get started|添加一个 API Key 开始使用/u })
  if (await onboarding.isVisible()) await onboarding.getByRole('button', { name: /Configure later|稍后配置/u }).click()
  stage = 'open-domain-panes'
  for (const [search, owner] of [['Eikona', 'eikona'], ['Scaena', 'scaena']]) {
    stage = `open-${owner}-picker`
    await page.getByRole('button', { name: /^(Add pane|添加面板)$/u }).first().click()
    const dialog = page.getByRole('dialog', { name: /^(Add pane|添加面板)$/u })
    stage = `search-${owner}`
    await dialog.getByRole('textbox').fill(search)
    stage = `choose-${owner}`
    await dialog.getByRole('button', { name: new RegExp(search) }).first().click()
    stage = `render-${owner}`
    await page.locator(`[data-domain-studio=${owner}]`).waitFor()
    await page.locator('[data-workspace-tab][aria-selected=true]').last().dblclick()
    checks.push(`${owner} opens through the real ModuleLoader`)
  }
  stage = 'split-domain-panes'
  const tab = page.locator('[data-workspace-tab]').filter({ hasText: 'Eikona' }).first()
  const target = await page.locator('[data-workspace-group]').first().boundingBox()
  const source = await tab.boundingBox()
  assert(source && target)
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 24 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.locator('[data-domain-studio=eikona]:visible').waitFor()
  await page.locator('[data-domain-studio=scaena]:visible').waitFor()
  assert.equal(await page.locator('[data-domain-studio] [data-lifecycle]').count(), 0)
  assert.equal(await page.getByText('gateway/service-unavailable', { exact: true }).count(), 0)
  checks.push('drag creates visible independent panes without full-domain navigation')
  stage = 'refresh-restoration'
  await page.reload()
  await page.locator('[data-domain-studio=eikona]:visible').waitFor()
  await page.locator('[data-domain-studio=scaena]:visible').waitFor()
  stage = 'gateway-owner-projection'
  for (const owner of ['eikona', 'scaena']) {
    const response = page.waitForResponse(async response => {
      if (!new URL(response.url()).pathname.endsWith('/creatorStudio/snapshotOwner')) return false
      const body = await response.json().catch(() => null), result = body?.result ?? body, value = result?.value ?? result
      return value?.context && value.owners?.[0]?.owner === owner && value.owners[0]?.transport === 'local'
    })
    await page.locator(`[data-domain-studio=${owner}]`).getByRole('button', { name: /^(Refresh|刷新)$/u }).first().click()
    await response
  }
  checks.push('both domain RPCs have local context and mounted owner projections; offline CLI remains explicit')
  const modules = await page.evaluate(() => window.__toolsModuleProbe?.() ?? [])
  assert(modules.some(id => id.includes('creator-studio')))
  checks.push('both pane kinds restore after refresh')
  if (await onboarding.isVisible()) await onboarding.getByRole('button', { name: /Configure later|稍后配置/u }).click()
  for (const owner of ['eikona', 'scaena']) await page.locator(`[data-domain-studio=${owner}]`).screenshot({ path: new URL(`artifacts/${owner}.png`, directory).pathname })
} catch (error) {
  failure = `Failed at ${stage}: ${error?.name ?? 'Error'}`
  if (page) await page.screenshot({ path: new URL('artifacts/failure.png', directory).pathname, mask: [page.locator('[data-workspace-pane]'), page.locator('[data-workspace-session-id]')] }).catch(() => {})
  if (page) {
    const geometry = await page.locator('[data-workspace-tab], [data-workspace-group], [data-domain-studio]').evaluateAll(nodes => nodes.map(node => ({ tag: node.tagName, domain: node.getAttribute('data-domain-studio'), group: node.hasAttribute('data-workspace-group'), tab: node.getAttribute('data-workspace-tab')?.split(':')[0], rect: node.getBoundingClientRect().toJSON(), visible: getComputedStyle(node).display !== 'none' }))).catch(() => [])
    await writeFile(new URL('artifacts/geometry.json', directory), JSON.stringify({ geometry, browserErrors, dialogs: await page.getByRole('dialog').evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label'), labelledBy: node.getAttribute('aria-labelledby') }))).catch(() => []), bodyTags: await page.locator('body > *').evaluateAll(nodes => nodes.map(node => ({tag: node.tagName, id: node.id}))).catch(() => []) }))
  }
} finally {
  await browser?.close()
  if (child && child.exitCode === null) {
    try { if (process.platform === 'win32') child.kill('SIGTERM'); else process.kill(-child.pid, 'SIGTERM') } catch {}
  }
  const status = failure ? 'failed' : 'passed'
  const startup = output.split('\n').filter(line => /error|failed|cannot|ENOENT/iu.test(line)).map(line => line.replace(/http\S+/gu, '[URL]').replace(/(token|password|secret|authorization)[=:]\S+/giu, '$1=[REDACTED]').replace(/\/[^\s"')]+/gu, '[PATH]')).slice(-8)
  await Promise.all([
    writeFile(new URL('summary.json', directory), JSON.stringify({ status, checks, ownerReads, failure, scope: 'formal ModuleLoader, pane open/drag/restore; no provider operations', redacted: true })),
    writeFile(new URL('command.txt', directory), 'node scripts/run-independent-panes-host.mjs\n'),
    writeFile(new URL('stdout.log', directory), checks.join('\n')),
    writeFile(new URL('stderr.log', directory), [failure ?? '', ...startup].join('\n')),
    writeFile(new URL('env.json', directory), JSON.stringify({ node: process.version, isolatedProfile: true, providerCalls: 0, redacted: true })),
  ])
  console.log(JSON.stringify({ status, checks, failure, evidence: `temp/integration-test-runs/${run}` }))
  process.exitCode = failure ? 1 : 0
}
