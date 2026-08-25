// Smoke test the built bundle client.js with jsdom DOM:
// stub ModuleLoader → apply() → check registration/disposal.
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

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
require_(new URL('../lib/client.js', import.meta.url).pathname)

if (entry === null) throw new Error('ModuleLoader.load was not called')
console.log('bundle entry id =', entry.id)
const exports_ = entry.factory(require_)
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
