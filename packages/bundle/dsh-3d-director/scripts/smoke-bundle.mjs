// Smoke test the built bundle:
// 1. client.js loads through the ModuleLoader banner without Node process or
//    workspace-package leakage;
// 2. host entry (lib/index.mjs) apply() mounts SceneGraphGateway exactly once
//    (repeat apply is a no-op: no second plugin fiber, no typert re-register);
// 3. without scene3dDirectorExpectedContext/storageDomain the gateway reports
//    an honest unavailable instead of fabricating state.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const bundleUrl = new URL('../lib/client.js', import.meta.url)
const bundleSource = readFileSync(bundleUrl, 'utf8')
// 内联的 three.js 文档注释里含 "process." 字样（"the update matrix process."），
// 并非 Node 全局引用；先剥掉块/行注释再禁止对全局 process 的成员访问
//（process.env 等），浏览器下才会真正抛错。
const codeOnly = bundleSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
if (/\bprocess\s*\./u.test(codeOnly)) throw new Error('browser bundle must not reference the Node.js process global')
if (/require\("@yeisme\/[^"]+"\)/u.test(bundleSource)) throw new Error('browser bundle must not require workspace packages externally')
if (!/window\.__ModuleLoader__\.load\(\{\s*id:\s*"@yeisme\/dsh-3d-director"/u.test(bundleSource)) {
  throw new Error('browser bundle must register under its package name')
}

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' })
const { window } = dom

let entry = null
window.__ModuleLoader__ = {
  load: (e) => { entry = e },
}

globalThis.window = window
globalThis.document = window.document
globalThis.MutationObserver = window.MutationObserver
globalThis.localStorage = window.localStorage

globalThis.DOMParser = window.DOMParser
globalThis.CSSStyleSheet = window.CSSStyleSheet
globalThis.StyleSheet = window.StyleSheet
globalThis.Event = window.Event
globalThis.CustomEvent = window.CustomEvent

const require_ = createRequire(import.meta.url)
const clientRequire = createRequire(new URL('../../../client/ui-3d-director/package.json', import.meta.url))
const primitiveStub = new Proxy({}, { get: () => () => null })
const moduleRequire = id => id === '@deepseek-ai/dsh-client-ui-primitives'
  ? primitiveStub
  : id === 'react' || id.startsWith('react/') || id === 'react-dom' || id.startsWith('react-dom/') ? clientRequire(id) : require_(id)
require_(bundleUrl.pathname)

if (entry === null) throw new Error('ModuleLoader.load was not called')
console.log('bundle entry id =', entry.id)
const exports_ = entry.factory(moduleRequire)
const exportKeys = Object.keys(exports_)
console.log('bundle exports keys =', exportKeys.join(','))
for (const key of ['probeScene3DDirector', 'Scene3DController', 'Director3DSurface', 'ShotTimeline', 'director3DStyles']) {
  assert(exportKeys.includes(key), `client face must re-export ${key}`)
}
// The web loader applies every dsh.client entry as a cordis plugin: the face
// must be applicable (function or object with apply) or boot fails with
// "invalid plugin".
assert(typeof exports_.apply === 'function', 'client face must export apply() for the cordis plugin loader')
assert(exports_.name === 'dsh-3d-director', 'client face must export the plugin name')
assert(Array.isArray(exports_.inject), 'client face must export inject')

// Host face: module load + idempotent apply + honest degradation.
const host = await import(new URL('../lib/index.mjs', import.meta.url))
assert(host.name === 'dsh-3d-director', 'host entry must export the plugin name')
assert(typeof host.apply === 'function', 'host entry must export apply()')

const { Context } = require_('@deepseek-ai/cordis')
const ctx = new Context()
assert(ctx.get('scene3dDirector') === undefined, 'gateway must not be mounted before apply')
await host.apply(ctx)
const gateway = ctx.get('scene3dDirector')
assert(gateway !== undefined, 'apply must mount the scene3dDirector gateway')
// cordis ctx.get returns a fresh accessor each call, so idempotency is proven
// by the plugin fiber count and by the typert registry not re-registering.
let typertRegistrations = 0
const typertStub = { register: () => { typertRegistrations += 1; return () => {} } }
const fiberCount = ctx.registry.size
ctx.provide('typert', typertStub)
await host.apply(ctx)
assert(ctx.registry.size === fiberCount, 'repeat apply must not start a second plugin fiber')
assert(typertRegistrations === 0, 'repeat apply must not re-register the typert contribution')
assert(ctx.get('scene3dDirector') !== undefined, 'gateway must stay mounted after repeat apply')

// No storageDomain and no expected context: reads fail closed, never fabricate.
const read = await gateway.sceneRead({ scope: { workspaceRef: 'ws:smoke', projectRef: 'project:smoke' }, documentId: 'scene:smoke' })
assert(read.status === 'unavailable', `context-less sceneRead must report unavailable, got ${String(read.status)}`)
const imported = await gateway.importGlb({ scope: { workspaceRef: 'ws:smoke', projectRef: 'project:smoke' }, sourceRef: 'file:smoke' })
assert(imported.status === 'unavailable', `context-less importGlb must report unavailable, got ${String(imported.status)}`)

// cordis 4 root contexts expose no dispose(); fiber unload is owned by the
// host runtime and covered by the host pack tests, so the smoke stops at
// mount/idempotency/honest degradation.
console.log('gateway honesty = context-less reads report unavailable (no fabricated state)')
console.log('host lifecycle = apply:1 duplicate:no-op')
console.log('BUNDLE SMOKE: PASS')
process.exit(0)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
