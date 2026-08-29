// Smoke test the built bundle client.js with jsdom DOM:
// ModuleLoader → install → duplicate install → uninstall → reinstall.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const bundleUrl = new URL('../lib/client.js', import.meta.url)
const bundleSource = readFileSync(bundleUrl, 'utf8')
if (/\bprocess\b/u.test(bundleSource)) throw new Error('browser bundle must not reference the Node.js process global')

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
const clientRequire = createRequire(new URL('../../../client/ui-ai-drama-director/package.json', import.meta.url))
const primitiveStub = new Proxy({}, { get: () => () => null })
const moduleRequire = id => id === '@deepseek-ai/dsh-client-ui-primitives'
  ? primitiveStub
  : id === 'react' || id.startsWith('react/') ? clientRequire(id) : require_(id)
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
ctx.provide('paneWorkbench', pane)
ctx.provide('remote', {
  creatorStudio: { snapshot: async () => ({}) },
  dramaDirector: {
    snapshot: async () => ({
      schema: 'drama.context.v1',
      workspaceRef: 'ws:smoke',
      projectRef: 'project:smoke',
      showRef: 'show:smoke',
      ownerVersions: { drama: 'v1' },
      contextRevision: 'revision:smoke',
      freshness: 'fresh',
    }),
  },
})

const firstDispose = await exports_.apply(ctx)
assert(views.size === 10, 'install must register six Director and four additive show-control views')
assert(commands.size === 14, 'install must register ten legacy and four additive show-control commands')
const duplicateDispose = await exports_.apply(ctx)
assert(views.size === 10 && commands.size === 14, 'duplicate install must be a no-op')
duplicateDispose()
assert(views.size === 10 && commands.size === 14, 'duplicate disposer must not remove the active install')
firstDispose()
assert(views.size === 0 && commands.size === 0, 'uninstall must remove all registrations')
assert(ctx.get('dramaDirector') === undefined, 'uninstall must remove the provided client face')

const reinstallDispose = await exports_.apply(ctx)
assert(views.size === 10 && commands.size === 14, 'reinstall must restore exactly one registration set')
reinstallDispose()
assert(views.size === 0 && commands.size === 0, 'reinstall disposer must clean the second install')

console.log('drama director applied =', exports_.name === 'client-ui-ai-drama-director')
console.log('profile lifecycle = install:1 duplicate:1 uninstall:0 reinstall:1 final:0')

console.log('BUNDLE SMOKE: PASS')
process.exit(0)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
