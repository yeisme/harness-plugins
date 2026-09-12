#!/usr/bin/env node
/** Real Chromium geometry of the canonical Host CSS; synthetic slot content, no user session. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { WORKBENCH_BASE } from './workbench-runtime.mjs'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const started = Date.now()
const runId = `tools-pane-layout-${new Date(started).toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const css = (await readFile(resolve(root, 'temp/dsh-unified-host-source/packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css'), 'utf8')).replace(/:global\(([^)]+)\)/g, '$1')
const baselineCss = execFileSync('git', ['show', `${WORKBENCH_BASE}:packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css`], { cwd: resolve(root, 'temp/dsh-unified-host-source'), encoding: 'utf8' }).replace(/:global\(([^)]+)\)/g, '$1')
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><html><head><style>${req.url === '/?baseline' ? baselineCss : css}
    *{box-sizing:border-box}body{margin:0;background:#171719;color:#ececf1;font:13px sans-serif}
    #workbench{display:flex;width:100vw;height:100vh}.root{flex:1;min-width:0}
    [data-slot="conversation.session"]{display:flex;flex:1;min-height:0}
    .slot{width:100%;height:100%;overflow:auto}#splitter{flex:none;width:6px;cursor:col-resize;background:#333}
    #other{width:60px;flex:none}button{height:30px}
    </style></head><body><main id="workbench"><div class="root" data-phase="active" style="--dsh-chat-user-width:680px;--dsh-conversation-column-width:1300px"><header class="header">Synthetic tools layout fixture</header><div class="body"><div class="scrollBody" data-conversation-scroll><div data-slot="conversation.session"><div class="viewArea"><div class="slot" id="content">Transcript fixture</div></div></div><div class="composerSeat">Composer fixture</div></div><div class="widthHandle" data-side="left"></div><div class="widthHandle" data-side="right"></div></div></div><div id="splitter"></div><div id="other">Pane B</div></main></body></html>`)
})
await new Promise(accept => server.listen(0, '127.0.0.1', accept))
let browser, failure
const checks = []
try {
  const executablePath = process.env.UI_VISUAL_CHROME_EXECUTABLE ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined)
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`http://127.0.0.1:${server.address().port}/?baseline`)
  await page.locator('#content').evaluate(el => el.setAttribute('data-conversation-readonly-view', 'true'))
  const baseline = await page.locator('.widthHandle').evaluateAll(elements => elements.map(el => ({ display: getComputedStyle(el).display, pointerEvents: getComputedStyle(el).pointerEvents, width: el.getBoundingClientRect().width })))
  assert(baseline.some(handle => handle.display !== 'none' && handle.width > 0), 'Negative control must expose the original Tools handle defect')
  await writeFile(resolve(dir, 'artifacts/baseline-handles.json'), JSON.stringify(baseline, null, 2))
  await page.screenshot({ path: resolve(dir, 'artifacts/baseline.png') })
  checks.push('negative_control_original_tools_handles_exposed')
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const handles = page.locator('.widthHandle')
  assert.equal(await handles.count(), 2)
  assert(await handles.first().isVisible(), 'Transcript keeps its width handles')
  const before = await page.locator('.root').evaluate(el => el.style.getPropertyValue('--dsh-chat-user-width'))
  await page.evaluate(() => {
    const content = document.getElementById('content')
    content.setAttribute('data-conversation-readonly-view', 'true')
    content.setAttribute('data-tools-session-tab', 'true')
    content.innerHTML = '<button id="tool-action">Tool action</button><p>Bound session A — synthetic content</p>'
  })
  const measured = await handles.evaluateAll(elements => elements.map(el => ({ display: getComputedStyle(el).display, pointerEvents: getComputedStyle(el).pointerEvents, width: el.getBoundingClientRect().width })))
  await writeFile(resolve(dir, 'artifacts/handles.json'), JSON.stringify(measured, null, 2))
  await page.screenshot({ path: resolve(dir, 'artifacts/wide.png') })
  assert(measured.every(handle => handle.display === 'none'), 'Tools must hide transcript width handles, including pointer hit areas')
  checks.push('tools_hide_transcript_handles')
  for (const width of [360, 560, 960]) {
    for (const height of [360, 800]) {
      await page.setViewportSize({ width: width + 66, height })
      const sizes = await page.evaluate(() => {
        const root = document.querySelector('.root'), content = document.querySelector('#content')
        return { root: root.clientWidth, content: content.clientWidth, overflow: content.scrollWidth > content.clientWidth, handles: [...document.querySelectorAll('.widthHandle')].some(el => getComputedStyle(el).display !== 'none'), splitter: getComputedStyle(document.querySelector('#splitter')).cursor }
      })
      assert.equal(sizes.content, sizes.root, 'Tools fill their Pane rather than the transcript preference')
      assert.equal(sizes.overflow, false)
      assert.equal(sizes.handles, false)
      assert.equal(sizes.splitter, 'col-resize', 'Workbench split boundary remains operable')
      await page.locator('#tool-action').click()
      await page.screenshot({ path: resolve(dir, `artifacts/tools-${width}-${height}.png`) })
      checks.push(`geometry_${width}_${height}`)
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => document.getElementById('content').removeAttribute('data-conversation-readonly-view'))
  assert(await handles.first().isVisible(), 'Returning to transcript restores handles')
  assert.equal(await page.locator('.root').evaluate(el => el.style.getPropertyValue('--dsh-chat-user-width')), before)
  checks.push('transcript_width_preference_preserved')
} catch (error) { failure = String(error.message).replaceAll(root, '[PROJECT_ROOT]').replaceAll(homedir(), '[USER_HOME]') }
finally { await browser?.close(); await new Promise(accept => server.close(accept)) }
const command = 'node scripts/test-tools-pane-layout.mjs'
await Promise.all([
  writeFile(resolve(dir, 'command.txt'), `${command}\n`),
  writeFile(resolve(dir, 'stdout.log'), checks.join('\n')),
  writeFile(resolve(dir, 'stderr.log'), failure ?? ''),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ node: process.version, engine: 'chromium', fixture: 'canonical Host CSS with synthetic slot DOM', provider_request: false })),
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ schema_version: 'yeisme.integration_test_evidence.v1', project: 'agent/harness-plugins', run_id: runId, layer: 'component', command, status: failure ? 'failed' : 'passed', exit_code: failure ? 1 : 0, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(), duration_ms: Date.now() - started, checks, failure, evidence: { command: 'command.txt', stdout: 'stdout.log', stderr: 'stderr.log', env: 'env.json', artifacts: 'artifacts/' }, redaction: { enabled: true, policy: 'synthetic fixture; no credentials or user data' } }, null, 2)),
])
console.log(`${failure ? 'FAIL' : 'PASS'} ${relative(root, dir)}${failure ? `: ${failure}` : ''}`)
process.exitCode = failure ? 1 : 0
