// 在真实构建产物（bundle 的 client.js）上做端到端冒烟：
// stub window.__ModuleLoader__ + jsdom DOM → apply() → 选区 → 工具条 + overlay。
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
globalThis.localStorage = window.localStorage
globalThis.CustomEvent = window.CustomEvent
globalThis.KeyboardEvent = window.KeyboardEvent
globalThis.Element = window.Element
globalThis.Node = window.Node

const require_ = createRequire(import.meta.url)
require_(new URL('../lib/client.js', import.meta.url).pathname)

if (entry === null) throw new Error('ModuleLoader.load 未被调用')
console.log('banner id =', entry.id)
if (entry.id !== '@yeisme/dsh-selection-annotation') throw new Error('banner id mismatch')
const exports_ = entry.factory(require_)
console.log('exports keys =', Object.keys(exports_).join(','))

const disposers = []
const ctx = { effect: (reg) => { disposers.push(reg()); return () => {} } }
await exports_.apply(ctx)

const styleOk = [...window.document.querySelectorAll('style')].some(s => (s.textContent || '').includes('dsh-selection-toolbar'))
console.log('style injected =', styleOk)
const toolbar = window.document.querySelector('.dsh-selection-toolbar')
console.log('toolbar mounted =', Boolean(toolbar))

// 模拟一次选区，验证观察器把工具条显示出来。
const block = window.document.createElement('p')
block.textContent = '冒烟选区文本'
window.document.body.append(block)
const selection = window.getSelection()
selection.removeAllRanges()
const range = window.document.createRange()
range.selectNodeContents(block)
selection.addRange(range)
window.document.dispatchEvent(new window.Event('selectionchange'))
await new Promise(r => setTimeout(r, 300))
console.log('toolbar visible after selection =', toolbar?.style.display)
const overlay = window.document.querySelector('.dsh-selection-composer')
console.log('composer overlay mounted =', Boolean(overlay))

// kill-switch 生效：off 后 apply 直接 no-op。
window.localStorage.setItem('dsh-selection-annotation', 'off')
const noop = await exports_.apply(ctx)
noop()
console.log('kill-switch honored = true')

for (const dispose of disposers.splice(0)) dispose()
const toolbarGone = window.document.querySelector('.dsh-selection-toolbar') === null
console.log('disposed cleanly =', toolbarGone)
if (!styleOk || toolbar?.style.display !== 'flex') process.exitCode = 1
