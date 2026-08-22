// 在真实构建产物（bundle 的 client.js）上做端到端冒烟：
// stub window.__ModuleLoader__ + jsdom DOM → apply() → 注入 fence → 出图。
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' })
const { window } = dom
const zero = () => ({ x: 0, y: 0, width: 10, height: 10 })
// @ts-expect-error jsdom 缺 SVG 布局
window.SVGElement.prototype.getBBox = zero
// @ts-expect-error jsdom 缺
window.SVGElement.prototype.getTotalLength = () => 100

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

if (entry === null) throw new Error('ModuleLoader.load 未被调用')
console.log('banner id =', entry.id)
const exports_ = entry.factory(require_)
console.log('exports keys =', Object.keys(exports_).join(','))

const disposers = []
const ctx = { effect: (reg) => { disposers.push(reg()); return () => {} } }
await exports_.apply(ctx)

const styleOk = [...window.document.querySelectorAll('style')].some((s) => (s.textContent || '').includes('dsh-mermaid-figure'))
console.log('style injected =', styleOk)

const card = window.document.createElement('div'); card.className = 'md-code-block'
const head = window.document.createElement('div'); const row = window.document.createElement('div')
const lang = window.document.createElement('div'); lang.textContent = 'mermaid'
const btnCell = window.document.createElement('div'); const btn = window.document.createElement('button'); btn.textContent = '复制'; btnCell.append(btn)
row.append(lang, btnCell); head.append(row)
const pre = window.document.createElement('pre'); const code = window.document.createElement('code')
code.textContent = 'graph TD\n  A[用户提问] --> B[DSH 回答]\n  B --> C{含 mermaid?}\n  C -->|是| D[渲染成图]'
pre.append(code); card.append(head, pre); window.document.body.append(card)

await new Promise((r) => setTimeout(r, 5000))
const fig = window.document.querySelector('figure[data-dsh-mermaid-figure]')
console.log('figure is-failed =', fig?.classList.contains('is-failed'))
console.log('status text =', fig?.querySelector('.dsh-mermaid-status')?.textContent?.slice(0, 160))
process.on('unhandledRejection', (e) => console.log('unhandledRejection:', String(e).slice(0, 200)))
const svg = fig?.querySelector('svg') ?? null
console.log('figure =', fig ? 'yes' : 'NO')
console.log('svg =', svg ? `yes viewBox=${svg.getAttribute('viewBox')}` : 'NO')
console.log('card hidden =', card.style.display === 'none')
console.log('buttons =', fig ? fig.querySelectorAll('button').length : 0)
const pass = styleOk && fig && svg && card.style.display === 'none'
console.log(pass ? 'BUNDLE SMOKE: PASS' : 'BUNDLE SMOKE: FAIL')
process.exit(pass ? 0 : 1)
