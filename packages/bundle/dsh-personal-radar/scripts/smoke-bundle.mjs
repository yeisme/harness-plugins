// Smoke test the built bundle client.js: ModuleLoader → install →
// duplicate install → uninstall → reinstall, with a fake Pane Workbench
// face and a fake radar host transport. No DOM is required: the bundle
// never touches window/document beyond the ModuleLoader banner.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const bundleUrl = new URL('../lib/client.js', import.meta.url)
const bundleSource = readFileSync(bundleUrl, 'utf8')
if (/\bprocess\b/u.test(bundleSource)) throw new Error('browser bundle must not reference the Node.js process global')

let entry = null
globalThis.window = {
  __ModuleLoader__: {
    load: (e) => { entry = e },
  },
}

const require_ = createRequire(import.meta.url)
const moduleRequire = id => require_(id)
require_(bundleUrl.pathname)

if (entry === null) throw new Error('ModuleLoader.load was not called')
console.log('bundle entry id =', entry.id)
const exports_ = entry.factory(moduleRequire)
console.log('bundle exports keys =', Object.keys(exports_).join(','))

const { Context } = require_('@deepseek-ai/cordis')
const ctx = new Context()
const views = new Map()
const commands = new Map()
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
  openView() {},
}
const radarHost = {
  probe: async () => ({
    ready: true,
    detail: 'fake owner ready',
    binary: { ok: true, detail: 'ok' },
    contract: { ok: true, detail: 'ok' },
    capabilities: { ok: true, detail: 'ok' },
    paneSlot: { ok: true, detail: 'ok' },
  }),
  snapshot: async () => ({
    schema: 'dsh.radar.projection.v1',
    editionRef: 'edition:smoke',
    profileRevision: 'profile-rev:smoke',
    status: 'ready',
    ageMs: 60_000,
    observedAt: 1_787_600_000_000,
    opportunities: [],
  }),
}
ctx.provide('paneWorkbench', pane)
ctx.provide('radarHost', radarHost)

const firstDispose = await exports_.apply(ctx)
assert(views.size === 2, 'install must register the badge and the radar pane views')
assert(commands.size === 7, 'install must register seven /drama radar command entries')
const duplicateDispose = await exports_.apply(ctx)
assert(views.size === 2 && commands.size === 7, 'duplicate install must be a no-op')
duplicateDispose()
assert(views.size === 2 && commands.size === 7, 'duplicate disposer must not remove the active install')
firstDispose()
assert(views.size === 0 && commands.size === 0, 'uninstall must remove all registrations')
assert(ctx.get('personalRadar') === undefined, 'uninstall must remove the provided client face')

const reinstallDispose = await exports_.apply(ctx)
assert(views.size === 2 && commands.size === 7, 'reinstall must restore exactly one registration set')
reinstallDispose()
assert(views.size === 0 && commands.size === 0, 'reinstall disposer must clean the second install')

console.log('personal radar client exported =', typeof exports_.apply === 'function')
console.log('profile lifecycle = install:1 duplicate:1 uninstall:0 reinstall:1 final:0')
console.log('BUNDLE SMOKE: PASS')
process.exit(0)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
