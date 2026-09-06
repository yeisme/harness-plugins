#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { homedir } from 'node:os'
import { chromium } from '@playwright/test'
import { discoverWorkspacePackages, workspaceBundles } from './dsh-dev.mjs'

const root = resolve(import.meta.dirname, '..')
const runId = `web-plugins-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const command = 'node scripts/run-web-plugin-acceptance.mjs'
const redact = value => String(value).replace(/([?&]token=)[^\s&"']+/gi, '$1[REDACTED]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]')
const profile = process.env.DSH_ACCEPTANCE_PROFILE ?? 'web'
const hmr = process.env.DSH_ACCEPTANCE_HMR === '1'
if (hmr && resolve(process.env.DSH_HOME ?? '') !== resolve(root, 'temp/dsh-acceptance-home')) throw new Error('HMR acceptance requires the isolated acceptance home')
const child = spawn('dsh', ['--profile', profile, ...(hmr ? ['--patch', resolve(root, 'temp/dsh-dev', profile, 'hmr.patch.yml')] : []), '--host', '127.0.0.1', '--port', '0', '--no-open'], {
  cwd: root, env: { ...process.env, DSH_TELEMETRY_DISABLED: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
})
let stdout = '', stderr = '', browser, exitCode = 0
const errors = [], responses = [], surfaces = []
// Optional capability probes (…/capabilities) may 404 on hosts without the
// owner route; plugins degrade honestly to unavailable. Record those apart
// from real browser errors instead of failing the boot gate.
const capabilityProbeResponses = []
const bundles = workspaceBundles(await discoverWorkspacePackages(root)).map(pkg => ({ name: pkg.name, status: 'not_verified' }))
child.stdout.on('data', chunk => { stdout += chunk })
child.stderr.on('data', chunk => { stderr += chunk })
const startedAt = new Date().toISOString()
try {
  const url = await new Promise((accept, reject) => {
    const timeout = setTimeout(() => { clearInterval(interval); reject(new Error('Web host readiness timed out')) }, 60000)
    const interval = setInterval(() => {
      const match = (stdout + stderr).match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)
      if (match) { clearTimeout(timeout); clearInterval(interval); accept(match[0]) }
    }, 100)
    child.once('error', error => { clearTimeout(timeout); clearInterval(interval); reject(error) })
    child.once('exit', code => { clearTimeout(timeout); clearInterval(interval); reject(new Error(`Host exited before readiness: ${code}`)) })
  })
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.on('pageerror', error => errors.push(redact(error.message)))
  page.on('response', response => {
    const path = new URL(response.url()).pathname
    if (response.status() < 400) return
    if (response.status() === 404 && /\/api\/.+\/capabilities$/.test(path)) capabilityProbeResponses.push({ path, status: response.status() })
    else responses.push({ path, status: response.status() })
  })
  await page.goto(url)
  const home = (process.env.DSH_HOME ?? resolve(homedir(), '.dsh')).replace(/^~(?=\/|$)/, homedir())
  const manifest = JSON.parse(await readFile(resolve(home, 'profiles', profile, 'package.json'), 'utf8'))
  const installed = new Set(manifest.dsh?.profile?.bundles ?? [])
  for (const bundle of bundles) {
    if (!installed.has(bundle.name)) throw new Error(`Bundle missing from profile: ${bundle.name}`)
  }
  const notice = page.getByRole('button', { name: 'Continue', exact: true })
  await notice.waitFor({ timeout: 15000 }).catch(() => {})
  if (await notice.isVisible()) await notice.click()
  await page.waitForTimeout(2000)
  const later = page.getByRole('button', { name: 'Configure later', exact: true })
  if (await later.isVisible()) await later.click()
  if (process.env.DSH_ACCEPTANCE_INSPECT_WORKSPACE === '1') {
    await page.getByRole('button', { name: 'Add workspace', exact: true }).click()
    await page.waitForTimeout(1000)
    await writeFile(resolve(dir, 'artifacts/workspace-dialog.txt'), redact(await page.locator('body').innerText()))
    await writeFile(resolve(dir, 'artifacts/workspace-inputs.json'), JSON.stringify(await page.locator('input').evaluateAll(es => es.map(e => ({ placeholder: e.placeholder, type: e.type, label: e.getAttribute('aria-label') }))), null, 2))
    await page.keyboard.press('Escape')
  }
  const body = await page.locator('body').innerText()
  if (/Failed to load plugins|missed the module table/.test(body)) throw new Error('Plugin boot failed')
  await page.screenshot({ path: resolve(dir, 'artifacts/web.png'), fullPage: true })
  const buttons = await page.locator('button').evaluateAll(elements => elements.map(e => ({ text: e.innerText, label: e.getAttribute('aria-label'), title: e.title })))
  await writeFile(resolve(dir, 'artifacts/controls.json'), JSON.stringify(buttons, null, 2))
  await writeFile(resolve(dir, 'artifacts/page.txt'), redact(body))
  for (const bundle of bundles) bundle.status = 'profile_boot_passed_function_not_verified'
  surfaces.push({ name: 'Web boot', status: 'passed' })
  for (const label of ['Agents', 'Create', '对话', '文件', 'Git']) {
    const entry = page.getByRole('button', { name: label === 'Agents' ? /^Agents(?: unavailable:.*)?$/ : label === 'Create' ? /^(?:Create|创作)$/ : label, exact: true }).first()
    if (!await entry.count()) { surfaces.push({ name: label, status: 'entry_absent' }); errors.push(`Required entry absent: ${label}`); continue }
    const reason = await entry.getAttribute('title')
    if (await entry.isDisabled()) { surfaces.push({ name: label, status: 'unavailable', reason }); continue }
    const before = await page.locator('body').innerText()
    await entry.click()
    await page.waitForTimeout(300)
    const after = await page.locator('body').innerText()
    surfaces.push({ name: label, status: before === after ? 'click_without_visible_change' : 'entry_opened', reason })
    if (before === after) errors.push(`Entry produced no visible change: ${label}`)
    await page.screenshot({ path: resolve(dir, `artifacts/surface-${surfaces.length}.png`), fullPage: true })
    await writeFile(resolve(dir, `artifacts/surface-${surfaces.length}.txt`), redact(await page.locator('body').innerText()))
    await page.keyboard.press('Escape')
  }
  if (process.env.DSH_ACCEPTANCE_DRAG_BASELINE === '1') {
    await page.getByRole('button', { name: 'Git', exact: true }).first().click()
    const tabs = page.locator('.pwo-host [role="tab"]')
    const tab = tabs.first()
    if (await tab.count()) {
      const origin = await tab.boundingBox()
      const readGeometry = () => page.locator('.pwo-host, [data-workspace-group]').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect()
        return { group: node.getAttribute('data-workspace-group'), x: r.x, y: r.y, width: r.width, height: r.height }
      }))
      const before = await readGeometry()
      await page.evaluate(() => {
        window.__paneDragEvidence = []
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) {
          window.addEventListener(type, event => window.__paneDragEvidence.push({ type, x: event.clientX, y: event.clientY, pointerId: event.pointerId }), true)
        }
      })
      await page.screenshot({ path: resolve(dir, 'artifacts/drag-before.png') })
      await page.mouse.move(origin.x + origin.width / 2, origin.y + origin.height / 2)
      await page.mouse.down()
      await page.mouse.move(480, 420, { steps: 18 })
      await page.mouse.up()
      await page.waitForTimeout(200)
      const after = await readGeometry()
      await page.screenshot({ path: resolve(dir, 'artifacts/drag-after.png') })
      await writeFile(resolve(dir, 'artifacts/drag-baseline.json'), JSON.stringify({ before, after,
        events: await page.evaluate(() => window.__paneDragEvidence),
        outcome: JSON.stringify(before) === JSON.stringify(after) ? 'drag_did_not_move_or_split_pane' : 'geometry_changed_requires_topology_verification',
      }, null, 2))
      surfaces.push({ name: 'Legacy pane drag baseline', status: 'recorded_not_acceptance' })
    }
  }
  if (process.env.DSH_ACCEPTANCE_SCAN_PANES === '1') {
    const open = page.locator('#pwo-open-view')
    await open.click()
    await page.locator('.pwr-management-filters > button').nth(1).click()
    const entries = new Map()
    for (let pass = 0; pass < 30; pass++) {
      const visible = await page.locator('[data-pane-management-source="pane"]').evaluateAll(rows => rows.map(row => ({ key: row.getAttribute('data-pane-management-entry'), title: row.querySelector('strong')?.textContent ?? '' })))
      for (const entry of visible) entries.set(entry.key, entry)
      const list = page.locator('.pwr-management-list-virtual')
      if (!await list.count()) break
      const end = await list.evaluate(element => { const end = element.scrollTop + element.clientHeight >= element.scrollHeight - 1; element.scrollTop += element.clientHeight; return end })
      if (end) break
      await page.waitForTimeout(100)
    }
    await writeFile(resolve(dir, 'artifacts/pane-catalog.json'), JSON.stringify([...entries.values()], null, 2))
    await page.keyboard.press('Escape')
    let index = 0
    for (const entry of entries.values()) {
      await open.click()
      await page.locator('.pwr-management-search input').fill(entry.title)
      const row = page.locator(`[data-pane-management-entry=${JSON.stringify(entry.key)}] .pwr-management-row-main`)
      await row.click({ timeout: 5000 })
      await page.waitForTimeout(250)
      const text = await page.locator('.pwo-host').innerText()
      const status = /unavailable|not available|needs_contract|waiting for|not connected|不可用|未连接|未配置|尚未|缺少/i.test(text) ? 'opened_with_unavailable_context' : 'opened_function_not_verified'
      surfaces.push({ name: entry.title, key: entry.key, status })
      await page.screenshot({ path: resolve(dir, `artifacts/pane-${index}.png`) })
      await writeFile(resolve(dir, `artifacts/pane-${index}.txt`), redact(text))
      index++
      if (index % 5 === 0) console.log(`Inspected ${index}/${entries.size} registered panes`)
    }
  }
  if (hmr) {
    const artifact = resolve(root, 'packages/example/dsh-plugin-example/lib/client.js')
    const original = await readFile(artifact)
    const marker = `dsh-acceptance-hmr-${process.pid}`
    let received = false
    const observe = async response => {
      if (!response.headers()['content-type']?.includes('javascript')) return
      try { if ((await response.text()).includes(marker)) received = true } catch { /* a superseded request may be cancelled */ }
    }
    page.on('response', observe)
    try {
      await writeFile(artifact, Buffer.concat([original, Buffer.from(`\n// ${marker}\n`)]))
      const deadline = Date.now() + 20000
      while (!received && Date.now() < deadline) await page.waitForTimeout(250)
      if (!received) throw new Error('HMR did not deliver the changed client artifact')
      surfaces.push({ name: 'HMR client artifact delivery', status: 'passed' })
    } finally {
      page.off('response', observe)
      await writeFile(artifact, original)
    }
    await page.waitForTimeout(1000)
    if (/Failed to load plugins|missed the module table/.test(await page.locator('body').innerText())) throw new Error('Plugin failed after HMR')
  }
  if (errors.length || responses.length) throw new Error('Browser reported errors; see evidence')
} catch (error) {
  exitCode = 1
  errors.push(redact(error.message))
} finally {
  await browser?.close()
  child.kill('SIGTERM')
  await new Promise(done => { const timer = setTimeout(() => { child.kill('SIGKILL'); done() }, 5000); child.once('exit', () => { clearTimeout(timer); done() }) })
  await Promise.all([
    writeFile(resolve(dir, 'command.txt'), command + '\n'),
    writeFile(resolve(dir, 'stdout.log'), redact(stdout)),
    writeFile(resolve(dir, 'stderr.log'), redact(stderr)),
    writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, profile, redacted: true }, null, 2)),
    writeFile(resolve(dir, 'artifacts/report.md'), [
      '# DSH 全插件实机验收',
      '',
      `Profile: ${profile}；启动及浏览器检查：${exitCode ? '失败，见 summary.json' : '通过'}。领域功能仍为部分覆盖。`,
      '',
      '| Bundle | 结果 |', '|---|---|',
      ...bundles.map(bundle => `| ${bundle.name} | ${bundle.status} |`),
      '', '| 入口 | 结果 | 原因 |', '|---|---|---|',
      ...surfaces.map(surface => `| ${surface.name} | ${surface.status} | ${(surface.reason ?? '').replaceAll('|', '/')} |`),
      '', '截图为当前无模型请求的本地状态；入口打开不代表外部 owner 的业务流程完成。', '',
    ].join('\n')),
    writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', run_id: runId, started_at: startedAt, status: exitCode ? 'failed' : 'partial', boot_status: surfaces.some(surface => surface.name === 'Web boot') ? 'passed' : 'failed', function_status: 'partial', exit_code: exitCode, layer: 'e2e', command, bundles, surfaces, errors, responses, unavailable_owner_services: capabilityProbeResponses, redacted: true }, null, 2)),
  ])
}
console.log(`Web plugin acceptance: ${exitCode ? 'FAIL' : 'BOOT PASS; FUNCTIONAL COVERAGE PARTIAL'}; evidence: ${relative(root, dir)}`)
process.exitCode = exitCode
