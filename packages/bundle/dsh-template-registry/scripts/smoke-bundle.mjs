// Smoke test the built bundle client.js: ModuleLoader -> install ->
// duplicate install -> uninstall -> reinstall, with a fake Pane Workbench
// face and a fake templateRegistryHost seam, plus the probe-fail path
// (missing host seam => probe-only face with the disabled reason and zero
// registrations). No DOM is required: the bundle never touches
// window/document beyond the ModuleLoader banner.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const bundleUrl = new URL('../lib/client.js', import.meta.url)
const bundleSource = readFileSync(bundleUrl, 'utf8')
// Inlined zod uses internal identifiers like `process$1`; only the bare
// global (word+dollar boundaries on both sides) is a browser violation.
if (/(?<![\w$])process(?![\w$])/u.test(bundleSource)) throw new Error('browser bundle must not reference the Node.js process global')

let entry = null
globalThis.window = {
  __ModuleLoader__: {
    load: (e) => { entry = e },
  },
}

const require_ = createRequire(import.meta.url)
// The browser factory runs in Node only for this smoke: react and the host
// ui-primitives are runtime externals declared by the workspace client
// package, not by this bundle, so resolve them from the client's own tree.
const clientRequire = createRequire(new URL('../../../client/ui-template-registry/package.json', import.meta.url))
// The real ui-primitives bundle pulls KaTeX CSS, which Node cannot load and
// which the browser Host supplies anyway; the smoke never renders, so a
// non-rendering component stub keeps the boundary honest.
const stubs = new Map([['@deepseek-ai/dsh-client-ui-primitives', { Button: () => null, Input: () => null }]])
const moduleRequire = id => {
  if (stubs.has(id)) return stubs.get(id)
  try { return require_(id) } catch { return clientRequire(id) }
}
require_(bundleUrl.pathname)

if (entry === null) throw new Error('ModuleLoader.load was not called')
if (entry.id !== '@yeisme/dsh-template-registry-bundle') throw new Error(`unexpected ModuleLoader id: ${entry.id}`)
console.log('bundle entry id =', entry.id)
const exports_ = entry.factory(moduleRequire)
console.log('bundle exports keys =', Object.keys(exports_).join(','))

const { Context } = require_('@deepseek-ai/cordis')
const views = new Map()
const commands = new Map()
const opened = []
const pane = {
  registerView(registration) {
    const id = registration.descriptor.kind
    if (views.has(id)) throw new Error(`duplicate view ${id}`)
    views.set(id, registration)
    return () => views.delete(id)
  },
  registerCommand(registration) {
    const id = registration.descriptor.id
    if (commands.has(id)) throw new Error(`duplicate command ${id}`)
    commands.set(id, registration)
    return () => commands.delete(id)
  },
  openView(request) { opened.push(request.kind) },
}

// Minimal structural fake of the host Remote (schema discriminator + the
// full 2.x service method surface the client probe verifies).
const fakeHost = {
  schema: 'dsh.template-registry.host.v1',
  locale: 'zh',
  health: () => ({ state: 'connected', server: { serverName: 'template-registry', serverVersion: 'template-registry.prompt-compiler.v0.2', protocolVersion: '2025-06-18' } }),
  probe: async () => fakeHost.health(),
  browse: async () => ({ ok: true, origin: 'mcp', templates: [] }),
  search: async () => ({ ok: true, origin: 'mcp', templates: [] }),
  inspect: async () => ({ ok: false, failure: { kind: 'not_found' } }),
  preview: async ref => ({ ref, allowed: false, reason: 'degraded' }),
  createSession: async () => ({ ok: false, failure: { kind: 'guard', code: 'degraded', detail: 'smoke' } }),
  updateSession: async () => ({ ok: false, failure: { kind: 'guard', code: 'degraded', detail: 'smoke' } }),
  confirmSession: async () => ({ ok: false, failure: { kind: 'guard', code: 'degraded', detail: 'smoke' } }),
  compileSession: async () => ({ ok: false, failure: { kind: 'guard', code: 'degraded', detail: 'smoke' } }),
  exportSession: async () => ({ ok: false, failure: { kind: 'guard', code: 'degraded', detail: 'smoke' } }),
  showSession: async () => ({ ok: false, failure: { kind: 'guard', code: 'degraded', detail: 'smoke' } }),
  dispose() {},
}

const connectedCtx = new Context()
connectedCtx.provide('paneWorkbench', pane)
connectedCtx.provide('templateRegistryHost', fakeHost)

const firstDispose = await exports_.apply(connectedCtx)
assert(views.size === 2, 'install must register the catalog and compile pane views')
assert(commands.size === 2, 'install must register two /template command entries')
const duplicateDispose = await exports_.apply(connectedCtx)
assert(views.size === 2 && commands.size === 2, 'duplicate install must be a no-op')
duplicateDispose()
assert(views.size === 2 && commands.size === 2, 'duplicate disposer must not remove the active install')
firstDispose()
assert(views.size === 0 && commands.size === 0, 'uninstall must remove all registrations')
assert(connectedCtx.get('templateRegistryPane') === undefined, 'uninstall must remove the provided client face')

const reinstallDispose = await exports_.apply(connectedCtx)
assert(views.size === 2 && commands.size === 2, 'reinstall must restore exactly one registration set')
const face = connectedCtx.get('templateRegistryPane')
assert(face !== undefined && typeof face.openCatalog === 'function', 'reinstall must provide the pane face')
face.openCatalog()
face.openCompile('solution/smoke/templates/main@en')
assert(opened.join(',') === 'template-registry.catalog,template-registry.compile', `unexpected open sequence: ${opened.join(',')}`)
reinstallDispose()
assert(views.size === 0 && commands.size === 0, 'reinstall disposer must clean the second install')

// Probe-fail path: pane slot present, host seam missing => the entry is
// disabled with a reason; zero registrations and zero fabricated content.
const probeFailCtx = new Context()
probeFailCtx.provide('paneWorkbench', pane)
const probeFailDispose = await exports_.apply(probeFailCtx)
const probeOnlyFace = probeFailCtx.get('templateRegistryPane')
assert(probeOnlyFace !== undefined, 'probe-fail must still provide the probe-only face')
assert(probeOnlyFace.probe.available === false, 'probe-fail must report unavailable')
assert(probeOnlyFace.probe.templateRegistryHost.reason.includes('needs_template_registry'), 'probe-fail must carry the disabled reason')
assert(views.size === 0 && commands.size === 0, 'probe-fail must register no views or commands')
probeFailDispose()
assert(probeFailCtx.get('templateRegistryPane') === undefined, 'probe-fail disposer must remove the probe-only face')

console.log('template-registry client exported =', typeof exports_.apply === 'function')
console.log('profile lifecycle = install:1 duplicate:1 uninstall:0 reinstall:1 probe-fail:0 final:0')
console.log('BUNDLE SMOKE: PASS')
process.exit(0)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
