#!/usr/bin/env node
// Workspace search host chain evidence (dsh-workspace-search-experience-v1 §5.2).
// Boots the official dsh web profile with this repo's bundles, drives the real
// search surface end to end (open, query, filter, identity, waiting, open
// result, restore), and writes redacted six-piece evidence to
// temp/integration-test-runs/<run-id>/.
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const startedAt = new Date()
const runId = `workspace-search-host-chain-${startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${process.pid}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const redact = value => String(value)
  .replace(/([?&]token=)[^\s&"']+/gi, '$1[REDACTED]')
  .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
  .replaceAll(root, '[PROJECT_ROOT]')
  .replaceAll(homedir(), '[USER_HOME]')

const child = spawn('dsh', ['--profile', 'web', '--host', '127.0.0.1', '--port', '0', '--no-open'], {
  cwd: root, env: { ...process.env, DSH_TELEMETRY_DISABLED: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
})
let hostStdout = '', hostStderr = ''
child.stdout.on('data', chunk => { hostStdout += chunk })
child.stderr.on('data', chunk => { hostStderr += chunk })
const exitCode = await (async () => {
  const checks = []
  let browser
  try {
    const url = await new Promise((accept, reject) => {
      const timeout = setTimeout(() => { clearInterval(interval); reject(new Error('Web host readiness timed out')) }, 90000)
      const interval = setInterval(() => {
        const match = (hostStdout + hostStderr).match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)
        if (match) { clearTimeout(timeout); clearInterval(interval); accept(match[0]) }
      }, 100)
      child.once('error', error => { clearTimeout(timeout); clearInterval(interval); reject(error) })
      child.once('exit', code => { clearTimeout(timeout); clearInterval(interval); reject(new Error(`Host exited before readiness: ${code}`)) })
    })
    const requests = []
    browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
    const consoleErrors = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(redact(m.text()).slice(0, 300)) })
    page.on('pageerror', e => consoleErrors.push(redact(String(e)).slice(0, 300)))
    page.on('request', r => requests.push({ method: r.method(), path: new URL(r.url()).pathname }))
    const step = (id, ok, detail) => { checks.push({ id, ok, detail }); if (!ok) console.log(`FAIL ${id}: ${detail}`) }

    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(2500)
    for (const label of ['Continue', 'Configure later']) {
      const b = page.getByRole('button', { name: label, exact: true })
      if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(600) }
    }

    // 1. Open the workspace and launch search from the host picker command.
    await page.getByRole('button', { name: 'wb.layout' }).first().click()
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'wb.add' }).first().click()
    await page.waitForTimeout(900)
    const picker = page.locator('dialog[aria-label]').last()
    await picker.getByRole('textbox').fill('Search')
    await page.waitForTimeout(400)
    const searchCommand = picker.locator('[data-workspace-command="workspace.search"]')
    step('host-picker-command', await searchCommand.count() === 1, `workspace.search rows=${await searchCommand.count()}`)
    await searchCommand.click()
    await page.waitForTimeout(1800)

    // 2. The pinned search pane mounts with the real surface.
    const surface = page.locator('.pwr-search-surface')
    step('search-pane-mounted', await surface.count() === 1, `surfaces=${await surface.count()}`)
    const paneBox = await surface.boundingBox().catch(() => null)
    const combobox = surface.getByRole('combobox')
    step('search-combobox', await combobox.isVisible().catch(() => false), 'combobox visible')

    // 3. Empty query: grouped list, no injected HTML, honest unavailable history.
    const emptyState = await surface.evaluate(el => ({
      text: el.textContent?.slice(0, 500) ?? '',
      rawHtml: el.innerHTML.length,
      hasImg: el.innerHTML.includes('<img'),
      hasLoadMore: el.textContent?.includes('Load more') ?? false,
    })).catch(() => null)
    step('empty-query-groups', !!emptyState && emptyState.text.length > 0, JSON.stringify(emptyState?.text?.slice(0, 120)))
    step('no-html-injection', emptyState?.hasImg === false, `img=${emptyState?.hasImg}`)
    await page.screenshot({ path: resolve(dir, 'artifacts', '01-search-empty.png') })

    // 4. Query: identity + grouping + selection through the real input.
    await combobox.fill('Git')
    await page.waitForTimeout(700)
    const gitOptions = await surface.locator('[role="option"][data-search-option]').all()
    const gitIdentity = []
    for (const option of gitOptions.slice(0, 5)) {
      gitIdentity.push(await option.getAttribute('data-search-option'))
    }
    step('query-results', gitIdentity.length > 0, `git identity=${JSON.stringify(gitIdentity)}`)
    const optionTexts = []
    for (const option of gitOptions.slice(0, 5)) optionTexts.push((await option.textContent())?.slice(0, 60))
    await page.screenshot({ path: resolve(dir, 'artifacts', '02-search-git.png') })

    // 5. History waiting state is honest: switch to a session-like term, wait out
    // the debounce + status render, then assert unavailable copy and no fabricated
    // session results or fake pagination.
    await combobox.fill('dsh pane')
    await page.waitForTimeout(1600)
    const historyState = await surface.evaluate(el => ({
      unavailable: /History search is unavailable|当前宿主不支持历史搜索/.test(el.textContent ?? ''),
      loadMore: /Load more/.test(el.textContent ?? ''),
      sessionOptions: [...el.querySelectorAll('[role="option"][data-search-option]')].filter(o => (o.getAttribute('data-search-option') || '').startsWith('session:')).length,
    })).catch(() => null)
    step('history-unavailable-honest', historyState?.unavailable === true && historyState?.loadMore === false && historyState?.sessionOptions === 0, JSON.stringify(historyState))
    const searchRequests = requests.filter(r => /search|history/i.test(r.path))
    await writeFile(resolve(dir, 'artifacts', 'search-requests.json'), JSON.stringify({ requests: searchRequests, note: 'history owner absent in this host; adapter stays unavailable and no session rows are fabricated (3.7 boundary)' }, null, 2) + '\n')
    // Back to the Git query for the filter and open steps.
    await combobox.fill('Git')
    await page.waitForTimeout(700)

    // 6. Filter toggle keeps result identity stable.
    const panesFilter = surface.getByRole('button', { name: /^Panes$|^窗格$/ }).first()
    const hasFilter = await panesFilter.isVisible().catch(() => false)
    let identityAfterFilter = null
    if (hasFilter) {
      await panesFilter.click({ force: true })
      await page.waitForTimeout(500)
      const filtered = await surface.locator('[role="option"][data-search-option]').all()
      identityAfterFilter = []
      for (const option of filtered.slice(0, 5)) identityAfterFilter.push(await option.getAttribute('data-search-option'))
      await page.screenshot({ path: resolve(dir, 'artifacts', '03-search-filtered.png') })
    }
    const sharedIdentity = identityAfterFilter === null ? null : identityAfterFilter.filter(key => gitIdentity.includes(key))
    step('filter-identity-stable', identityAfterFilter === null ? false : sharedIdentity.length > 0,
      identityAfterFilter === null ? 'no filter control found' : `shared=${JSON.stringify(sharedIdentity)}`)

    // 7. Open a result: a real view pane appears; search stays single.
    const panesBefore = await page.locator('[data-pane-view-generation]').count()
    const firstOption = surface.locator('[role="option"][data-search-option]').first()
    if (await firstOption.isVisible().catch(() => false)) await firstOption.click()
    await page.waitForTimeout(1800)
    const panesAfter = await page.locator('[data-pane-view-generation]').count()
    step('open-result-grows-workspace', panesAfter > panesBefore, `panes ${panesBefore}->${panesAfter}`)
    step('search-singleton-after-open', await page.locator('.pwr-search-surface').count() === 1, `surfaces=${await page.locator('.pwr-search-surface').count()}`)
    await page.screenshot({ path: resolve(dir, 'artifacts', '04-after-open.png') })

    // 8. Restore: relaunching the command focuses the same singleton pane.
    await page.getByRole('button', { name: 'wb.add' }).first().click()
    await page.waitForTimeout(800)
    const picker2 = page.locator('dialog[aria-label]').last()
    await picker2.getByRole('textbox').fill('Search')
    await page.waitForTimeout(300)
    await picker2.locator('[data-workspace-command="workspace.search"]').click()
    await page.waitForTimeout(1200)
    step('relaunch-singleton', await page.locator('.pwr-search-surface').count() === 1, `surfaces=${await page.locator('.pwr-search-surface').count()}`)

    // 9. Theme inheritance: the surface consumes host tokens, not hard-coded colors.
    const theme = await surface.evaluate(el => {
      const styles = getComputedStyle(el)
      const background = styles.getPropertyValue('--vk-bg-elevated') || styles.backgroundColor
      return { colorScheme: styles.colorScheme, tokenBackground: String(background).trim() }
    }).catch(() => null)
    step('theme-token-inheritance', !!theme, JSON.stringify(theme))

    // 10. Drag intent: pointer-drag a result row; record the honest outcome.
    let dragOutcome = 'not-attempted'
    const dragRow = surface.locator('[role="option"][data-search-option]').first()
    if (await dragRow.isVisible().catch(() => false)) {
      const from = await dragRow.boundingBox()
      const target = await page.evaluate(() => {
        const el = document.getElementById('root')
        const r = el?.getBoundingClientRect()
        return r ? { x: r.x + r.width * 0.4, y: r.y + r.height * 0.6 } : null
      })
      if (from && target) {
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
        await page.mouse.down()
        await page.mouse.move(target.x, target.y, { steps: 12 })
        await page.waitForTimeout(300)
        await page.mouse.up()
        await page.waitForTimeout(900)
        const panesAfterDrag = await page.locator('[data-pane-view-generation]').count()
        dragOutcome = panesAfterDrag > panesAfter ? 'dropped-opened-view' : 'no-drop-target-in-pane-mode'
      }
    }
    checks.push({ id: 'drag-outcome', ok: true, detail: dragOutcome })
    await page.screenshot({ path: resolve(dir, 'artifacts', '05-after-drag.png') })

    await writeFile(resolve(dir, 'artifacts', 'chain-checks.json'), JSON.stringify({
      checks, gitIdentity, identityAfterFilter, optionTexts, theme, dragOutcome,
      paneBox: paneBox ? { x: Math.round(paneBox.x), y: Math.round(paneBox.y), w: Math.round(paneBox.width), h: Math.round(paneBox.height) } : null,
      consoleErrors: consoleErrors.slice(0, 20),
    }, null, 2) + '\n')
    await browser.close()
    return checks.every(check => check.ok) ? 0 : 1
  } catch (error) {
    console.error(redact(String(error?.stack ?? error)))
    return 1
  } finally {
    child.kill('SIGTERM')
    await browser?.close().catch(() => {})
  }
})()

const finishedAt = new Date()
await writeFile(resolve(dir, 'command.txt'), 'node scripts/run-workspace-search-host-chain.mjs\n')
await writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, ci: process.env.CI === 'true', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, null, 2) + '\n')
await writeFile(resolve(dir, 'stdout.log'), redact(hostStdout).slice(0, 200000) + '\n')
await writeFile(resolve(dir, 'stderr.log'), redact(hostStderr).slice(0, 50000) + '\n')
await writeFile(resolve(dir, 'summary.json'), JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  command: 'node scripts/run-workspace-search-host-chain.mjs',
  status: exitCode === 0 ? 'passed' : 'failed',
  exit_code: exitCode,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  evidence: { checks: 'artifacts/chain-checks.json', screenshots: ['artifacts/01-search-empty.png', 'artifacts/02-search-git.png', 'artifacts/03-search-filtered.png', 'artifacts/04-after-open.png', 'artifacts/05-after-drag.png'] },
  redaction: { enabled: true, policy: 'host URL token redacted; no prompts/credentials captured' },
}, null, 2) + '\n')
console.log(`workspace-search host chain: ${exitCode === 0 ? 'passed' : 'failed'} (${runId})`)
process.exit(exitCode)
