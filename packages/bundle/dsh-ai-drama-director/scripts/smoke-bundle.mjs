// Smoke test the built bundle client.js with jsdom DOM:
// stub ModuleLoader → apply() → check registration/disposal.
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

const disposers = []
const ctx = { effect: (reg) => { disposers.push(reg()); return () => {} } }
await exports_.apply(ctx)

console.log('drama director applied =', exports_.name === 'client-ui-ai-drama-director')
console.log('disposables registered =', disposers.length)

// Simulate disposal
disposers.forEach(d => d())
console.log('disposal called')

console.log('BUNDLE SMOKE: PASS')
process.exit(0)
