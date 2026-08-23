#!/usr/bin/env node
// Task 5.2 integration runner: disposable DSH web profile flow for the
// @yeisme/dsh-session-tags bundle (openspec/changes/dsh-session-tags-grouping-v1).
//
// Two phases, both against a real browser via agent-browser, both with an
// ephemeral DSH_HOME that is removed afterwards:
//
//   A. official-runtime (installed `dsh`, no sessionGroupings seam yet):
//      install -> dump-config composition -> boot -> onboarding -> sessions ->
//      honest probe degradation ("By tags"/"Manage tags" absent, native
//      workspace/flat intact) -> uninstall -> reinstall composition restore.
//
//   B. seam-runtime (disposable /tmp/deepseek-harness checkout at
//      dsh-v0.1.0-rc.8 + upstream-prs/session-grouping-provider patch):
//      full flow — install -> boot -> sessions -> set tags via the editor
//      overlay -> page refresh persistence -> group by tags -> tag search ->
//      open sessions from two groups -> uninstall (data retained) ->
//      reinstall (groups restored).
//
// Evidence: temp/integration-test-runs/<run-id>/{summary.json,command.txt,
// stdout.log,stderr.log,env.json,artifacts/} (redacted; original exit codes
// preserved in summary gates and as the process exit code).
import { execFileSync, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { copyFile as fsCopy, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const seamCheckout = process.env.DSH_SESSION_TAGS_SEAM_CHECKOUT ?? '/tmp/deepseek-harness'
const seamBaseTag = 'dsh-v0.1.0-rc.8'
const startedAt = new Date()
const runId = `${startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${process.pid}-session-tags-web-profile`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const publicCommand = 'pnpm --filter @yeisme/dsh-session-tags run test:integration'
const workspaceDir = join(homedir(), `dsh-tags-ws-${process.pid}`)

const checks = []
const failures = []
const stdoutLines = []
const stderrLines = []
let redactions = []

function log(line) {
  stdoutLines.push(line)
  process.stdout.write(`${line}\n`)
}
function warn(line) {
  stderrLines.push(line)
  process.stderr.write(`${line}\n`)
}
function fail(stage, error) {
  failures.push(stage)
  warn(`${stage}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
}
function record(stage, passed, observed) {
  checks.push({ stage, passed, observed })
  log(`[${passed ? 'PASS' : 'FAIL'}] ${stage}: ${JSON.stringify(observed)}`)
}
function gate(command, exitCode, detail) {
  log(`[gate ${exitCode === 0 ? 'ok' : 'fail'}] ${command} -> ${detail}`)
  return { command, exitCode, detail }
}
function sh(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', cwd: options.cwd ?? projectRoot, env: options.env })
}
function ab(args, sessionName) {
  return execFileSync('agent-browser', args, {
    encoding: 'utf8',
    env: { ...process.env, AGENT_BROWSER_SESSION_NAME: sessionName },
  })
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
function decodeEvalOutput(value) {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed) } catch { return trimmed }
  }
  return trimmed
}
async function evalPage(expression, sessionName, attempts = 20, delayMs = 250) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return decodeEvalOutput(ab(['eval', expression], sessionName))
    } catch (error) {
      lastError = error
      await sleep(delayMs)
    }
  }
  throw lastError ?? new Error(`agent-browser eval failed: ${expression.slice(0, 80)}`)
}
async function clickButtonByText(text, sessionName) {
  return evalPage(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(text)}); if (!b) return 'not-found'; b.click(); return 'clicked' })()`, sessionName)
}
async function menuOptions(sessionName) {
  const raw = await evalPage(`(() => { const lb = document.querySelector('[role=listbox],[role=menu]'); if (!lb) return null; return [...lb.querySelectorAll('[role=option],[role=menuitem]')].map(o => o.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean).join(' ;; ') })()`, sessionName)
  return raw === null || raw === 'null' ? null : raw.split(' ;; ').filter(Boolean)
}
function redact(value) {
  let out = String(value)
  for (const [needle, token] of redactions) out = out.replaceAll(needle, token)
  return out
}

async function buildOwnedPackages() {
  const gates = []
  for (const pkg of ['@yeisme/dsh-session-tags-host', '@yeisme/dsh-client-ui-session-tags', '@yeisme/dsh-session-tags']) {
    try {
      execFileSync('pnpm', ['--filter', pkg, 'run', 'build'], { encoding: 'utf8', cwd: projectRoot, stdio: 'pipe' })
      gates.push(gate(`pnpm --filter ${pkg} run build`, 0, 'clean build'))
    } catch (error) {
      gates.push(gate(`pnpm --filter ${pkg} run build`, error.status ?? 1, String(error.stderr ?? error.message).slice(0, 300)))
    }
  }
  return gates
}

async function packOwnedPackages(packRoot) {
  const sourceRoot = join(packRoot, 'source')
  const runtimeRoot = join(packRoot, 'runtime')
  const stagingRoot = join(packRoot, 'bundle-staging')
  await mkdir(sourceRoot, { recursive: true })
  await mkdir(runtimeRoot, { recursive: true })
  await mkdir(stagingRoot, { recursive: true })
  const packageDirs = [
    resolve(projectRoot, 'packages/host/dsh-session-tags'),
    resolve(projectRoot, 'packages/client/ui-session-tags'),
    resolve(projectRoot, 'packages/bundle/dsh-session-tags'),
  ]
  for (const cwd of packageDirs) {
    execFileSync('pnpm', ['pack', '--pack-destination', sourceRoot], {
      encoding: 'utf8', cwd, stdio: 'pipe',
    })
  }
  const tarballs = (await readdir(sourceRoot)).filter(name => name.endsWith('.tgz'))
  const pick = marker => {
    const name = tarballs.find(candidate => candidate.includes(marker))
    if (name === undefined) throw new Error(`packed artifact missing: ${marker}`)
    return join(sourceRoot, name)
  }
  const hostTarball = pick('dsh-session-tags-host-')
  const clientTarball = pick('dsh-client-ui-session-tags-')
  const bundleTarball = pick('yeisme-dsh-session-tags-0.1.0-rc.1')

  // pnpm 解析一个未发布 bundle 的精确 registry dependencies 时不会用同一
  // add 命令里的 sibling tarball，仍会访问 npm。构造一次性 local-registry
  // 形态：保留原始三份 pack 作为合同来源，仅把运行时 bundle manifest 的
  // 两个依赖 spec 改为对应 file: tarball，再重新 pack。该临时 manifest 由
  // runner 应用服务生成，产品 package.json 与发布依赖声明保持不变。
  execFileSync('tar', ['-xzf', bundleTarball, '-C', stagingRoot], { encoding: 'utf8', stdio: 'pipe' })
  const manifestPath = join(stagingRoot, 'package', 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.dependencies = {
    ...manifest.dependencies,
    '@yeisme/dsh-client-ui-session-tags': `file:${clientTarball}`,
    '@yeisme/dsh-session-tags-host': `file:${hostTarball}`,
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  execFileSync('pnpm', ['pack', '--pack-destination', runtimeRoot], {
    encoding: 'utf8', cwd: join(stagingRoot, 'package'), stdio: 'pipe',
  })
  const runtimeTarballs = (await readdir(runtimeRoot)).filter(name => name.endsWith('.tgz'))
  if (runtimeTarballs.length !== 1 || runtimeTarballs[0] === undefined) {
    throw new Error(`expected one runtime bundle tarball, found ${runtimeTarballs.length}`)
  }
  return join(runtimeRoot, runtimeTarballs[0])
}

function pluginAdd(bin, dshHome, packageSpec) {
  // 真实 registry 语义：先 pack，再把三个 tarball 同批安装进 profile。
  // 不能 link 工作区目录——Typert Remote 的装饰器标记在模块私有 WeakMap；
  // link 会让插件解析到仓库 rc.6、宿主解析到 seam rc.8，形成两份协议实例，
  // Host Gateway 因而看不到 marker 并对 /api/sessionTags/list 返回 404。
  // runtime bundle 的 file: 依赖会把三个 tarball 一起物化到目标 profile，
  // peer 因而统一解析到目标 DSH 的协议实例。
  return execFileSync(bin[0], [...bin.slice(1), 'plugin', '--profile', 'web', 'add',
    packageSpec], {
    encoding: 'utf8',
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome },
  })
}
function pluginRemove(bin, dshHome) {
  return execFileSync(bin[0], [...bin.slice(1), 'plugin', '--profile', 'web', 'remove', '@yeisme/dsh-session-tags'], {
    encoding: 'utf8',
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome },
  })
}
function dumpConfig(bin, dshHome) {
  return execFileSync(bin[0], [...bin.slice(1), '--profile', 'web', '--dump-config'], {
    encoding: 'utf8',
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome },
  })
}
async function bootWeb(bin, dshHome, logFile, extraEnv = {}) {
  const webProcess = spawn(bin[0], [...bin.slice(1), '--profile', 'web', '--port', '0'], {
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome, NO_COLOR: '1', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let bootBuffer = ''
  webProcess.stdout.on('data', chunk => { bootBuffer += String(chunk) })
  webProcess.stderr.on('data', chunk => { bootBuffer += String(chunk) })
  let webPort = 0
  for (let attempt = 0; attempt < 90 && webPort === 0; attempt += 1) {
    await sleep(500)
    const match = /127\.0\.0\.1:(\d+)/.exec(bootBuffer)
    if (match !== null) webPort = Number(match[1])
  }
  await writeFile(logFile, redact(bootBuffer), 'utf8')
  return { webProcess, webPort, bootBuffer }
}

/**
 * 本地 OpenAI 兼容 echo provider：让 composer 消息真正完成 agent turn 并
 * 持久化 session（无第三方凭据；SS 与 JSON 双形态；不含任何真实密钥）。
 */
function startEchoProvider() {
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      if (req.method === 'GET' && req.url === '/models') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'deepseek-echo' }] }))
        return
      }
      let stream = false
      let lastUserText = ''
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        stream = body.stream === true
        const users = Array.isArray(body.messages) ? body.messages.filter(m => m?.role === 'user') : []
        const last = users.at(-1)?.content
        if (typeof last === 'string') lastUserText = last
        else if (Array.isArray(last)) lastUserText = last.filter(p => p?.type === 'text').map(p => p.text).join(' ')
      } catch { stream = false }
      // 回显用户消息片段：session 标题由回复文本生成，可被流程断言稳定命中。
      // 标题生成请求内嵌对话 JSON——真正 JSON.parse 后取第一条用户消息作标题，
      // 避免所有会话标题撞车（键序不定，正则不可靠）。
      let echoSource = lastUserText
      const isTitleRequest = /Generate the session title/i.test(lastUserText)
      if (isTitleRequest) {
        const start = lastUserText.indexOf('[')
        const end = lastUserText.lastIndexOf(']')
        if (start >= 0 && end > start) {
          try {
            const arr = JSON.parse(lastUserText.slice(start, end + 1))
            const firstHuman = Array.isArray(arr) ? arr.find(m => typeof m?.text === 'string') : undefined
            const text = firstHuman?.text ?? ''
            if (text !== '') echoSource = text
          } catch { /* 解析失败按原文回显 */ }
        }
      }
      const normalizedEcho = echoSource.replace(/\s+/g, ' ').trim().slice(0, 48)
      const reply = isTitleRequest ? normalizedEcho : `echo: ${normalizedEcho}`
      if (stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.write(`data: ${JSON.stringify({ id: 'echo', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: reply }, finish_reason: null }] })}\n\n`)
        res.write(`data: ${JSON.stringify({ id: 'echo', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`)
        res.end('data: [DONE]\n\n')
      } else {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ id: 'echo', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }] }))
      }
    })
  })
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: server.address().port, close: () => server.close() })
    })
  })
}
async function stopWeb(webProcess) {
  if (webProcess === null || webProcess === undefined || webProcess.exitCode !== null) return
  webProcess.kill('SIGTERM')
  await sleep(1_000)
  if (webProcess.exitCode === null) webProcess.kill('SIGKILL')
}

async function browserOnboard(sessionName, webPort, label) {
  ab(['open', `http://127.0.0.1:${webPort}/`], sessionName)
  log(`$ ${label}: agent-browser open http://127.0.0.1:${webPort}/`)
  await sleep(3_000)
  const workspaceFolderName = workspaceDir.split('/').pop()
  let composerReady = 'missing'
  for (let round = 0; round < 8 && composerReady !== 'ready'; round += 1) {
    for (const dialogLabel of ['Continue', 'Configure later']) {
      if (await clickButtonByText(dialogLabel, sessionName) === 'clicked') { log(`$ ${label}: dismiss dialog "${dialogLabel}"`); await sleep(900) }
    }
    if (await clickButtonByText('Choose workspace', sessionName) === 'clicked') {
      log(`$ ${label}: click "Choose workspace"`)
      await sleep(1_500)
      const folder = await evalPage(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(workspaceFolderName)}); if (!b) return 'not-found'; b.click(); return 'entered' })()`, sessionName)
      log(`$ ${label}: pick workspace folder -> ${folder}`)
      await sleep(900)
      const opened = await clickButtonByText('Open', sessionName)
      log(`$ ${label}: click "Open" -> ${opened}`)
      await sleep(2_500)
    }
    composerReady = await evalPage(`(() => { const t = document.querySelector('textarea'); return t ? 'ready' : 'missing' })()`, sessionName)
    if (composerReady !== 'ready') await sleep(1_200)
  }
  if (composerReady !== 'ready') {
    const body = await evalPage('document.body.innerText.slice(0, 500)', sessionName)
    warn(`$ ${label}: composer still ${composerReady}; body: ${JSON.stringify(body)}`)
  }
  return composerReady === 'ready'
}

async function sendComposerMessage(sessionName, text) {
  return evalPage(`(() => {
    const ta = document.querySelector('textarea')
    if (!ta) return 'no-composer'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, ${JSON.stringify(text)})
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
    return 'sent'
  })()`, sessionName)
}
async function startNewSession(sessionName) {
  return evalPage(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? '').startsWith('New session in'))
    if (!b) return 'not-found'
    b.click()
    return 'clicked'
  })()`, sessionName)
}
async function sidebarTreeText(sessionName) {
  return evalPage(`(() => {
    const trees = [...document.querySelectorAll('[role=tree]')]
    return trees.map(tree => tree.innerText).join('\\n').replace(/\\s+\\n/g, '\\n').slice(0, 1600)
  })()`, sessionName)
}
async function openViewOptions(sessionName) {
  return evalPage(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'View options')
    if (!b) return 'not-found'
    b.click()
    return 'clicked'
  })()`, sessionName)
}
async function pickMenuOption(sessionName, text) {
  return evalPage(`(() => {
    const root = document.querySelector('[role=listbox],[role=menu]')
    if (!root) return 'no-menu'
    const item = [...root.querySelectorAll('[role=option],[role=menuitem]')].find(o => o.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)})
    if (!item) return 'option-not-found'
    item.click()
    return 'picked'
  })()`, sessionName)
}
async function openSessionRowMenu(sessionName, titlePart) {
  return evalPage(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? '').startsWith('Session actions for') && (b.getAttribute('aria-label') ?? '').includes(${JSON.stringify(titlePart)}))
    if (!b) return 'not-found'
    b.click()
    return 'clicked'
  })()`, sessionName)
}
async function expandExternalGroup(sessionName, label) {
  return evalPage(`(() => {
    const row = [...document.querySelectorAll('[role=treeitem]')].find(el => {
      const text = (el.textContent ?? '').replace(/\\s+/g, ' ').trim()
      return text === ${JSON.stringify(label)} && el.getAttribute('aria-expanded') !== null
    })
    if (!row) return 'not-found'
    if (row.getAttribute('aria-expanded') === 'true') return 'already-expanded'
    row.click()
    return 'expanded'
  })()`, sessionName)
}
async function setTagsViaEditor(sessionName, tags) {
  const results = []
  for (const tag of tags) {
    const typed = await evalPage(`(() => {
      const input = document.querySelector('div[role=dialog] input[aria-label="New tag"]')
      if (!input) return 'no-input'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(tag)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return 'typed'
    })()`, sessionName)
    const added = await evalPage(`(() => {
      const dialog = document.querySelector('div[role=dialog]')
      if (!dialog) return 'no-dialog'
      const b = [...dialog.querySelectorAll('button')].find(b => b.innerText.trim() === 'Add tag')
      if (!b) return 'no-add-button'
      b.click()
      return 'added'
    })()`, sessionName)
    results.push(`${tag}:${typed}/${added}`)
    await sleep(300)
  }
  const saved = await evalPage(`(() => {
    const dialog = document.querySelector('div[role=dialog]')
    if (!dialog) return 'no-dialog'
    const b = [...dialog.querySelectorAll('button')].find(b => b.innerText.trim() === 'Save')
    if (!b) return 'no-save-button'
    b.click()
    return 'saved'
  })()`, sessionName)
  await sleep(1_200)
  const closed = await evalPage(`(() => (document.querySelector('div[role=dialog]') ? 'open' : 'closed'))()`, sessionName)
  return { steps: results, saved, closed }
}
async function typeInSearch(sessionName, text) {
  const opened = await evalPage(`(() => {
    const searchInput = [...document.querySelectorAll('input')].find(input =>
      /search/i.test([input.getAttribute('aria-label'), input.getAttribute('placeholder')].filter(Boolean).join(' '))
    )
    if (searchInput) return 'already-open'
    const button = [...document.querySelectorAll('button')].find(button => /search/i.test(button.getAttribute('aria-label') ?? ''))
    if (!button) return 'no-search-button'
    button.click()
    return 'opened'
  })()`, sessionName)
  if (opened === 'opened') await sleep(500)
  return evalPage(`(() => {
    const inputs = [...document.querySelectorAll('input')]
    const input = inputs.find(input =>
      /search/i.test([input.getAttribute('aria-label'), input.getAttribute('placeholder')].filter(Boolean).join(' '))
    ) ?? inputs.find(input => input.tabIndex >= 0)
    if (!input) return 'no-search-input'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(text)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return 'typed'
  })()`, sessionName)
}
async function clickSessionRow(sessionName, titlePart) {
  return evalPage(`(() => {
    const candidates = [...document.querySelectorAll('[role=treeitem]')]
      .filter(el => el.getAttribute('aria-selected') !== null && el.textContent && el.textContent.trim().includes(${JSON.stringify(titlePart)}))
    const row = candidates[0]
    if (!row) return 'not-found'
    row.click()
    return 'clicked:' + row.textContent.trim().slice(0, 40)
  })()`, sessionName)
}
async function currentSessionTitle(sessionName) {
  return evalPage(`(() => {
    const active = document.querySelector('[role=treeitem][aria-selected=true], [aria-current], [data-active=true], [data-current=true]')
    const label = active?.getAttribute('aria-label') ?? active?.textContent ?? ''
    return String(label).trim().slice(0, 80)
  })()`, sessionName)
}

async function findStoragePaths(root) {
  // Web profile 的 storage-json backend 固定写入 <DSH_HOME>/storages/<unit>.json。
  // 只认精确 domain 文件；node_modules 中同名 package 不是 sidecar 证据。
  const candidate = join(root, 'storages', 'yeisme_session_tags_v1.json')
  try {
    await readFile(candidate, 'utf8')
    return [candidate]
  } catch {
    return []
  }
}

async function prepareSeamRuntime() {
  const marker = join(seamCheckout, '.session-tags-seam-build.json')
  try {
    const prior = JSON.parse(await readFile(marker, 'utf8'))
    if (prior.ok === true) {
      log('$ seam runtime: reusing prepared checkout')
      return { ready: true, gates: [gate('seam runtime prepare (cached)', 0, `base ${prior.baseCommit} (${prior.baseTag ?? seamBaseTag}), patch applied`)] }
    }
  } catch { }
  const gates = []
  const steps = []
  const run = async (id, command, args, cwd) => {
    const t0 = Date.now()
    try {
      execFileSync(command, args, { encoding: 'utf8', cwd, stdio: 'pipe', timeout: 20 * 60_000 })
      steps.push({ id, exitCode: 0, ms: Date.now() - t0 })
      gates.push(gate(`seam prepare: ${id}`, 0, `${Date.now() - t0}ms`))
      return true
    } catch (error) {
      steps.push({ id, exitCode: error.status ?? 1, ms: Date.now() - t0, stderr: String(error.stderr ?? error.message).slice(0, 400) })
      gates.push(gate(`seam prepare: ${id}`, error.status ?? 1, String(error.stderr ?? error.message).slice(0, 200)))
      return false
    }
  }
  await rm(seamCheckout, { recursive: true, force: true }).catch(() => { })
  await run('git-init', 'git', ['init', '-q', seamCheckout], tmpdir())
  await run('git-remote', 'git', ['remote', 'add', 'origin', 'https://github.com/deepseek-ai/deepseek-harness.git'], seamCheckout)
  if (!await run('git-fetch', 'git', ['fetch', '-q', '--depth', '1', 'origin', `refs/tags/${seamBaseTag}`], seamCheckout)) {
    return { ready: false, gates, error: 'git fetch of upstream tag failed (network?)' }
  }
  await run('git-checkout', 'git', ['checkout', '-q', 'FETCH_HEAD'], seamCheckout)
  let baseCommit = 'unknown'
  try { baseCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', cwd: seamCheckout }).trim() } catch { }
  if (!await run('apply-patch', 'bash', [join(projectRoot, 'upstream-prs/session-grouping-provider/apply.sh'), seamCheckout], tmpdir())) {
    return { ready: false, gates, error: 'apply.sh failed' }
  }
  if (!await run('pnpm-install', 'pnpm', ['install', '--prefer-offline'], seamCheckout)) return { ready: false, gates, error: 'pnpm install failed' }
  if (!await run('build-lib', 'npm', ['run', 'build:lib'], seamCheckout)) return { ready: false, gates, error: 'build:lib failed' }
  if (!await run('build-web', 'pnpm', ['--filter', '@deepseek-ai/dsh-web-frontend', 'run', 'build'], seamCheckout)) return { ready: false, gates, error: 'web frontend build failed' }
  const prepRecord = { ok: true, baseCommit, baseTag: seamBaseTag, steps, preparedAt: new Date().toISOString() }
  await writeFile(marker, JSON.stringify(prepRecord, null, 2), 'utf8')
  return { ready: true, gates }
}

// ---------------------------------------------------------------------------
async function main() {
  const gates = []
  await mkdir(artifactsRoot, { recursive: true })
  await mkdir(workspaceDir, { recursive: true })
  await writeFile(join(workspaceDir, 'README.md'), 'session-tags integration workspace marker\n', 'utf8')

  const dshHomeA = await mkdtemp(join(tmpdir(), 'dsh-tags-home-a-'))
  const dshHomeB = await mkdtemp(join(tmpdir(), 'dsh-tags-home-b-'))
  const packRoot = await mkdtemp(join(tmpdir(), 'dsh-tags-pack-'))
  redactions = [
    [projectRoot, '<project>'],
    [packageRoot, '<bundle>'],
    [seamCheckout, '<seam-checkout>'],
    [dshHomeA, '<dsh-home-a>'],
    [dshHomeB, '<dsh-home-b>'],
    [packRoot, '<pack-root>'],
    [workspaceDir, '<workspace>'],
    ['/home/linuxbrew/.linuxbrew', '<brew-prefix>'],
    [homedir(), '<home>'],
    [tmpdir(), '<tmp>'],
  ]

  // ---- Phase 0: owned packages build -------------------------------------
  gates.push(...await buildOwnedPackages())
  let packageSpec = ''
  try {
    packageSpec = await packOwnedPackages(packRoot)
    gates.push(gate('pnpm pack (host + client + bundle)', 0, 'registry-shaped tarballs + local dependency resolver'))
  } catch (error) {
    fail('pack-owned-packages', error)
    gates.push(gate('pnpm pack (host + client + bundle)', 1, error instanceof Error ? error.message : String(error)))
  }

  // ---- Phase A: official runtime (probe-degrade honesty) ------------------
  const binOfficial = ['dsh']
  let webProcessA = null
  const browserA = `dsh_tags_official_${process.pid}`
  try {
    const dshVersion = sh('dsh', ['--version']).trim()
    log(`$ official dsh ${dshVersion}`)
    const addOut = pluginAdd(binOfficial, dshHomeA, packageSpec)
    await writeFile(resolve(evidenceRoot, 'out-plugin-add-official.log'), redact(addOut), 'utf8')
    const dump1 = dumpConfig(binOfficial, dshHomeA)
    await writeFile(resolve(evidenceRoot, 'out-dump-config-official.log'), redact(dump1), 'utf8')
    const yeismeRows = dump1.split('\n').filter(line => line.includes('yeisme') || line.includes('dsh-session-tags'))
    const hostRows = yeismeRows.filter(line => line.includes('id: dsh-session-tags-host'))
    const bundleRows = yeismeRows.filter(line => line.includes('id: dsh-session-tags') && !line.includes('host'))
    // 单双面行：根 face 即 Host 插件（re-export），./client face 由 dsh.client 声明挂载。
    // 官方把 host/client 依赖装成 plain dependency（告警属预期），不追加第二行。
    record('official_install_composition', hostRows.length === 0 && bundleRows.length === 1, {
      dsh: dshVersion,
      host_rows: hostRows.length,
      bundle_rows: bundleRows.length,
      rows: yeismeRows.map(line => line.trim()),
    })
    gates.push(gate('dsh plugin --profile web add ./packages/bundle/dsh-session-tags', 0, 'profile rows composed'))

    const bootA = await bootWeb(binOfficial, dshHomeA, resolve(evidenceRoot, 'out-dsh-web-official.log'))
    webProcessA = bootA.webProcess
    record('official_web_boot', bootA.webPort !== 0, {
      resolved_port: bootA.webPort,
      boot_line: redact(bootA.bootBuffer.trim().split('\n').at(-1) ?? ''),
    })
    if (bootA.webPort === 0) throw new Error('official dsh web did not report a port')

    const onboarded = await browserOnboard(browserA, bootA.webPort, 'official')
    record('official_workspace_connected', onboarded, { composer: onboarded ? 'ready' : 'missing' })
    if (!onboarded) throw new Error('official: onboarding did not reach the composer')

    await sendComposerMessage(browserA, 'alpha integration session for probe-degrade check')
    await sleep(3_000)
    ab(['screenshot', resolve(artifactsRoot, 'official-sidebar.png')], browserA)

    await openViewOptions(browserA)
    await sleep(600)
    const optionsA = (await menuOptions(browserA)) ?? []
    record('official_probe_degrades_honestly',
      optionsA.some(o => o.includes('WorkSpace')) && optionsA.some(o => o.includes('In one list')) && !optionsA.some(o => o.includes('By tags')),
      {
        menu_options: optionsA,
        by_tags_present: optionsA.some(o => o.includes('By tags')),
        native_grouping_intact: optionsA.some(o => o.includes('WorkSpace')) && optionsA.some(o => o.includes('In one list')),
      })

    const managePresent = await evalPage(`(() => [...document.querySelectorAll('button,[role=menuitem]')].some(el => (el.textContent ?? '').trim() === 'Manage tags'))()`, browserA)
    // evalPage 经 agent-browser 返回字符串形态，归一化后再判定缺席。
    const manageAbsent = managePresent === false || managePresent === 'false' || managePresent === undefined
    record('official_no_manage_tags_entry', manageAbsent, { manage_tags_anywhere: managePresent })

    const webLogA = await readFile(resolve(evidenceRoot, 'out-dsh-web-official.log'), 'utf8')
    const pluginError = /plugin[^\n]*(error|fail)/i.test(webLogA)
    record('official_host_sidecar_loadable', !pluginError, {
      plugin_load_errors: pluginError,
      storage_paths: (await findStoragePaths(dshHomeA)).map(p => relative(dshHomeA, p)),
    })

    // uninstall + reinstall: composition recovery on the official runtime
    await stopWeb(webProcessA); webProcessA = null
    const removeOut = pluginRemove(binOfficial, dshHomeA)
    await writeFile(resolve(evidenceRoot, 'out-plugin-remove-official.log'), redact(removeOut), 'utf8')
    const dump2 = dumpConfig(binOfficial, dshHomeA)
    const rowsAfterRemove = dump2.split('\n').filter(line => line.includes('dsh-session-tags'))
    const addBack = pluginAdd(binOfficial, dshHomeA, packageSpec)
    await writeFile(resolve(evidenceRoot, 'out-plugin-readd-official.log'), redact(addBack), 'utf8')
    const dump3 = dumpConfig(binOfficial, dshHomeA)
    const rowsAfterReadd = dump3.split('\n').filter(line => line.includes('id: dsh-session-tags'))
    record('official_uninstall_reinstall_composition', rowsAfterRemove.length === 0 && rowsAfterReadd.length === 1, {
      rows_after_remove: rowsAfterRemove.length,
      rows_after_reinstall: rowsAfterReadd.map(line => line.trim()),
    })
    gates.push(gate('dsh plugin --profile web remove + re-add', 0, 'composition removed and restored'))
  } catch (error) {
    fail('phase-a-official', error)
  } finally {
    try { ab(['close'], browserA) } catch { }
    await stopWeb(webProcessA)
    await rm(dshHomeA, { recursive: true, force: true }).catch(() => { })
  }

  // ---- Phase B: seam runtime (full tags flow) -----------------------------
  const binSeam = ['node', join(seamCheckout, 'apps/cli/lib/bin.js')]
  let webProcessB = null
  let echoProvider = null
  let seamPhaseEnv = {}
  const browserB = `dsh_tags_seam_${process.pid}`
  try {
    const prep = await prepareSeamRuntime()
    gates.push(...prep.gates)
    if (!prep.ready) throw new Error(prep.error ?? 'seam runtime preparation failed')

    const addOut = pluginAdd(binSeam, dshHomeB, packageSpec)
    await writeFile(resolve(evidenceRoot, 'out-plugin-add-seam.log'), redact(addOut), 'utf8')
    const dump1 = dumpConfig(binSeam, dshHomeB)
    await writeFile(resolve(evidenceRoot, 'out-dump-config-seam.log'), redact(dump1), 'utf8')
    const rows = dump1.split('\n').filter(line => line.includes('id: dsh-session-tags'))
    record('seam_install_composition', rows.length === 1, { rows: rows.map(line => line.trim()) })

    // 本地 echo provider：让消息完成真实 agent turn 并持久化 sessions
    // （无第三方凭据；DEEPSEEK_BASE_URL 是 provider 公开的 endpoint 覆写）。
    echoProvider = await startEchoProvider()
    const echo = echoProvider
    seamPhaseEnv = {
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${echo.port}`,
      DEEPSEEK_API_KEY: 'local-evidence-echo',
    }
    const bootB = await bootWeb(binSeam, dshHomeB, resolve(evidenceRoot, 'out-dsh-web-seam.log'), seamPhaseEnv)
    webProcessB = bootB.webProcess
    record('seam_web_boot', bootB.webPort !== 0, {
      resolved_port: bootB.webPort,
      boot_line: redact(bootB.bootBuffer.trim().split('\n').at(-1) ?? ''),
    })
    if (bootB.webPort === 0) throw new Error('seam dsh web did not report a port')

    const onboarded = await browserOnboard(browserB, bootB.webPort, 'seam')
    record('seam_workspace_connected', onboarded, { composer: onboarded ? 'ready' : 'missing' })
    if (!onboarded) throw new Error('seam: onboarding did not reach the composer')

    // B.1 create three sessions with distinctive first messages
    const sessionTitles = ['alpha-standup', 'beta-review', 'gamma-notes']
    await sendComposerMessage(browserB, 'alpha-standup first message')
    await sleep(4_000)
    for (const title of ['beta-review', 'gamma-notes']) {
      const started = await startNewSession(browserB)
      log(`$ seam: new session -> ${started}`)
      await sleep(1_500)
      const sent = await sendComposerMessage(browserB, `${title} first message`)
      log(`$ seam: composer -> ${sent}`)
      await sleep(4_000)
    }
    ab(['screenshot', resolve(artifactsRoot, 'seam-sessions.png')], browserB)
    const tree1 = await sidebarTreeText(browserB)
    record('seam_sessions_created', sessionTitles.every(t => tree1.includes(t)), {
      sidebar_excerpt: tree1.slice(0, 400),
      expected_titles: sessionTitles,
    })
    // B.2 "By tags" appears in the native view menu (seam present)
    await openViewOptions(browserB)
    await sleep(600)
    const options1 = (await menuOptions(browserB)) ?? []
    record('seam_by_tags_menu_entry', options1.some(o => o.includes('By tags')), {
      menu_options: options1,
    })
    const picked = await pickMenuOption(browserB, 'By tags')
    await sleep(800)
    log(`$ seam: pick "By tags" -> ${picked}`)
    const untaggedExpanded = await expandExternalGroup(browserB, 'Untagged')
    log(`$ seam: expand "Untagged" -> ${untaggedExpanded}`)
    await sleep(600)

    // B.3 set tags via the editor overlay
    const tagPlan = [
      { title: 'alpha-standup', tags: ['alpha', 'shared'] },
      { title: 'beta-review', tags: ['beta', 'shared'] },
    ]
    for (const plan of tagPlan) {
      const opened = await openSessionRowMenu(browserB, plan.title)
      log(`$ seam: session menu "${plan.title}" -> ${opened}`)
      await sleep(600)
      const manage = await evalPage(`(() => { const root = document.querySelector('[role=listbox],[role=menu]'); if (!root) return 'no-menu'; const item = [...root.querySelectorAll('[role=option],[role=menuitem]')].find(o => o.textContent.replace(/\\s+/g, ' ').trim() === 'Manage tags'); if (!item) return 'manage-not-found'; item.click(); return 'clicked' })()`, browserB)
      log(`$ seam: "Manage tags" -> ${manage}`)
      await sleep(800)
      const result = await setTagsViaEditor(browserB, plan.tags)
      record(`seam_set_tags_${plan.title}`, result.saved === 'saved' && result.closed === 'closed', result)
      ab(['screenshot', resolve(artifactsRoot, `seam-tags-${plan.title}.png`)], browserB)
    }

    // B.4 grouping projection: multi-group membership + untagged group
    const tree2 = await sidebarTreeText(browserB)
    const groupsOk = tree2.includes('alpha') && tree2.includes('beta') && tree2.includes('shared') && tree2.toLowerCase().includes('untagged')
    record('seam_grouping_projection', groupsOk, {
      sidebar_excerpt: tree2.slice(0, 600),
    })
    ab(['screenshot', resolve(artifactsRoot, 'seam-grouped.png')], browserB)

    // B.5 page refresh -> tags and grouping rebuilt from the sidecar
    ab(['open', `http://127.0.0.1:${bootB.webPort}/`], browserB)
    await sleep(5_000)
    const tree3 = await sidebarTreeText(browserB)
    record('seam_refresh_persists', tree3.includes('alpha') && tree3.includes('beta') && tree3.includes('shared'), {
      sidebar_excerpt: tree3.slice(0, 400),
    })
    ab(['screenshot', resolve(artifactsRoot, 'seam-after-refresh.png')], browserB)

    // B.6 tag search
    const typed = await typeInSearch(browserB, 'shared')
    await sleep(1_500)
    const tree4 = await sidebarTreeText(browserB)
    const searchOk = tree4.includes('alpha-standup') && tree4.includes('beta-review') && !tree4.includes('gamma-notes')
    record('seam_tag_search', typed === 'typed' && searchOk, {
      search_typed: typed,
      sidebar_excerpt: tree4.slice(0, 400),
    })
    ab(['screenshot', resolve(artifactsRoot, 'seam-search.png')], browserB)
    await typeInSearch(browserB, '')

    // B.7 open sessions from two different groups (multi-group open)
    const alphaExpanded = await expandExternalGroup(browserB, 'alpha')
    const betaExpanded = await expandExternalGroup(browserB, 'beta')
    log(`$ seam: expand tagged groups -> alpha:${alphaExpanded}, beta:${betaExpanded}`)
    await sleep(500)
    const opened1 = await clickSessionRow(browserB, 'alpha-standup')
    await sleep(1_500)
    const current1 = await currentSessionTitle(browserB)
    const opened2 = await clickSessionRow(browserB, 'beta-review')
    await sleep(1_500)
    const current2 = await currentSessionTitle(browserB)
    record('seam_open_from_two_groups',
      String(opened1).startsWith('clicked') && String(opened2).startsWith('clicked') && String(current1) !== String(current2),
      { opened1: String(opened1).slice(0, 60), opened2: String(opened2).slice(0, 60), current1: String(current1), current2: String(current2) })
    ab(['screenshot', resolve(artifactsRoot, 'seam-opened.png')], browserB)

    // B.8 uninstall: provider gone, sidecar data retained in DSH_HOME
    await stopWeb(webProcessB); webProcessB = null
    const storageBefore = await findStoragePaths(dshHomeB)
    const removeOut = pluginRemove(binSeam, dshHomeB)
    await writeFile(resolve(evidenceRoot, 'out-plugin-remove-seam.log'), redact(removeOut), 'utf8')
    const storageAfterRemove = await findStoragePaths(dshHomeB)
    // keep the retained sidecar data + home layout as durable evidence
    await mkdir(resolve(artifactsRoot, "sidecar"), { recursive: true })
    for (const p2 of storageAfterRemove) {
      try { await fsCopy(p2, resolve(artifactsRoot, "sidecar", relative(dshHomeB, p2).replaceAll("/", "__"))) } catch { }
    }
    await writeFile(resolve(artifactsRoot, "dsh-home-b-layout.txt"), storageAfterRemove.map(p2 => relative(dshHomeB, p2)).join("\n") + "\n", "utf8")
    const bootB2 = await bootWeb(binSeam, dshHomeB, resolve(evidenceRoot, 'out-dsh-web-seam-uninstalled.log'), seamPhaseEnv)
    webProcessB = bootB2.webProcess
    if (bootB2.webPort === 0) throw new Error('seam boot after uninstall did not report a port')
    ab(['open', `http://127.0.0.1:${bootB2.webPort}/`], browserB)
    await sleep(6_000)
    await browserOnboard(browserB, bootB2.webPort, 'seam-uninstalled')
    await openViewOptions(browserB)
    await sleep(600)
    const options2 = (await menuOptions(browserB)) ?? []
    record('seam_uninstall_removes_provider', !options2.some(o => o.includes('By tags')), {
      menu_options: options2,
      sidecar_data_retained: storageAfterRemove.length > 0,
      storage_rel_paths: storageAfterRemove.map(p => relative(dshHomeB, p)),
    })

    // B.9 reinstall: groups restored from retained sidecar data
    const addBack = pluginAdd(binSeam, dshHomeB, packageSpec)
    await writeFile(resolve(evidenceRoot, 'out-plugin-readd-seam.log'), redact(addBack), 'utf8')
    await stopWeb(webProcessB); webProcessB = null
    const bootB3 = await bootWeb(binSeam, dshHomeB, resolve(evidenceRoot, 'out-dsh-web-seam-reinstalled.log'), seamPhaseEnv)
    webProcessB = bootB3.webProcess
    if (bootB3.webPort === 0) throw new Error('seam boot after reinstall did not report a port')
    ab(['open', `http://127.0.0.1:${bootB3.webPort}/`], browserB)
    await sleep(6_000)
    // 重装后浏览器重新走 onboarding（对话框会遮挡树），先归位再读菜单。
    await browserOnboard(browserB, bootB3.webPort, 'seam-reinstalled')
    await openViewOptions(browserB)
    await sleep(600)
    const options3 = (await menuOptions(browserB)) ?? []
    const byTagsBack = options3.some(o => o.includes('By tags'))
    if (byTagsBack) { const picked2 = await pickMenuOption(browserB, 'By tags'); log(`$ seam: re-pick "By tags" -> ${picked2}`); await sleep(1_000) }
    const tree5 = byTagsBack ? await sidebarTreeText(browserB) : ''
    record('seam_reinstall_restores_groups',
      byTagsBack && tree5.includes('alpha') && tree5.includes('beta') && tree5.includes('shared'),
      {
        by_tags_menu: byTagsBack,
        sidebar_excerpt: tree5.slice(0, 400),
      })
    ab(['screenshot', resolve(artifactsRoot, 'seam-reinstalled.png')], browserB)
    gates.push(gate('seam full flow (install/tags/refresh/group/search/open/uninstall/reinstall)', 0, 'see checks'))
  } catch (error) {
    fail('phase-b-seam', error)
  } finally {
    try { ab(['close'], browserB) } catch { }
    await stopWeb(webProcessB)
    if (echoProvider !== null) echoProvider.close()
    await rm(dshHomeB, { recursive: true, force: true }).catch(() => { })
  }

  await rm(workspaceDir, { recursive: true, force: true }).catch(() => { })
  await rm(packRoot, { recursive: true, force: true }).catch(() => { })

  // ---- summary ------------------------------------------------------------
  const finishedAt = new Date()
  const passedCount = checks.filter(c => c.passed).length
  const status = failures.length === 0
    && checks.length > 0
    && checks.every(c => c.passed)
    && gates.every(g => g.exitCode === 0)
    ? 'passed'
    : 'failed'
  const summary = {
    schema_version: 'yeisme.integration_test_evidence.v1',
    project: 'agent/harness-plugins',
    run_id: runId,
    layer: 'browser-e2e',
    change: 'dsh-session-tags-grouping-v1',
    scope: 'task 5.2 disposable web profile integration (official probe-degrade + patched seam full flow)',
    status,
    exit_code: status === 'passed' ? 0 : 1,
    command: publicCommand,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    checks,
    gates,
    failures,
    evidence: {
      summary: relative(projectRoot, resolve(evidenceRoot, 'summary.json')),
      command: relative(projectRoot, resolve(evidenceRoot, 'command.txt')),
      stdout: relative(projectRoot, resolve(evidenceRoot, 'stdout.log')),
      stderr: relative(projectRoot, resolve(evidenceRoot, 'stderr.log')),
      env: relative(projectRoot, resolve(evidenceRoot, 'env.json')),
      artifacts: relative(projectRoot, artifactsRoot),
    },
    redaction: {
      enabled: true,
      policy: 'yeisme.integration-test-redaction.v1',
      notes: 'no credentials, raw prompts, provider payloads, or absolute workspace/seam/home paths persisted',
    },
  }
  const environment = {
    schemaVersion: 'harness-plugins.integration-env.v1',
    generatedAt: finishedAt.toISOString(),
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    packageManager: 'pnpm',
    browserDriver: 'agent-browser',
    dshHome: 'ephemeral',
    seamCheckout: process.env.DSH_SESSION_TAGS_SEAM_CHECKOUT === undefined
      ? '<default-disposable-checkout>'
      : '<user-supplied-checkout>',
    externalCredentials: false,
    provider: 'local synthetic echo server',
  }
  await writeFile(resolve(evidenceRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  await writeFile(resolve(evidenceRoot, 'stdout.log'), redact(stdoutLines.join('\n')) + '\n', 'utf8')
  await writeFile(resolve(evidenceRoot, 'stderr.log'), redact(stderrLines.join('\n')) + '\n', 'utf8')
  await writeFile(resolve(evidenceRoot, 'command.txt'), `${publicCommand}\n`, 'utf8')
  await writeFile(resolve(evidenceRoot, 'env.json'), `${JSON.stringify(environment, null, 2)}\n`, 'utf8')
  log(`summary: ${passedCount}/${checks.length} checks passed; status=${status}`)
  return status === 'passed' ? 0 : 1
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    fail('runner', error)
    process.exit(1)
  })
