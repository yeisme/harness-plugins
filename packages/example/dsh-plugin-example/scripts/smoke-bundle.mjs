// 真实构建产物冒烟（3.2 best-effort「运行」证据）：stub window.__ModuleLoader__
// → require 真实 lib/client.js → apply(fakeCtx) → 渲染注册面，验证三种 seam
// 组合下的 probe-first 行为。不启动官方 dsh web 宿主（完成门不依赖它，
// 见 docs/plugin-host-protocol.md）；本脚本与官方宿主集成证据互为补充。
import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'

let entry = null
globalThis.window = { __ModuleLoader__: { load: (candidate) => { entry = candidate } } }

const require_ = createRequire(import.meta.url)
require_(new URL('../lib/client.js', import.meta.url).pathname)

if (entry === null) throw new Error('ModuleLoader.load 未被调用')
console.log('banner id =', entry.id)
if (entry.id !== '@yeisme/dsh-plugin-example') throw new Error('banner id 与包名不一致')

const exports_ = entry.factory(require_)
console.log('exports keys =', Object.keys(exports_).join(','))

// fake 宿主结构面：只实现被探测的面，记录全部注册。
function makeHost({ slots = true, pane = true, data = true, throwOnData = false } = {}) {
  const views = []
  const record = (slot, input, component) => {
    const view = { slot, input, component, unregistered: false }
    views.push(view)
    return () => { view.unregistered = true }
  }
  const slotsFace = slots
    ? {
        inject: (slot, factory) => (factory() ?? (() => {})),
        register: (input, component) => record(String(input.name ?? ''), input, component),
      }
    : undefined
  const paneFace = pane
    ? {
        registerView: ({ descriptor, component }) => record(String(descriptor.kind ?? ''), descriptor, component),
        openView: () => {},
      }
    : undefined
  const dataFace = data ? { snapshot: () => ({ meta: { freshness: 'fresh', version: 'v1' }, summary: { text: 'demo', truncated: false } }) } : undefined
  return {
    views,
    ctx: {
      get: (name) => {
        if (name === 'exampleCounter' && throwOnData) throw new Error('counter registry locked')
        if (name === 'slots') return slotsFace
        if (name === 'paneWorkbench') return paneFace
        if (name === 'exampleCounter') return dataFace
        return undefined
      },
    },
  }
}

function renderHeader(host) {
  const header = host.views.find((view) => view.slot === 'conversation.session.header.actions')
  if (header === undefined) return '(no header entry)'
  const face = header.input.inject?.()
  return renderToStaticMarkup(header.component(face))
}

let pass = true
const check = (label, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) pass = false
}

// A：全部 seam 到岗 → 面板+可用入口；dispose 全释放。
{
  const host = makeHost({})
  const dispose = exports_.apply(host.ctx)
  const slots = host.views.map((view) => view.slot).sort().join(',')
  console.log('A registered =', slots)
  check('A pane view registered', host.views.some((view) => view.slot === 'workspace.dsh-plugin-example'))
  check('A header entry registered', host.views.some((view) => view.slot === 'conversation.session.header.actions'))
  const markup = renderHeader(host)
  console.log('A header =', markup)
  check('A header enabled (no disabled attr)', markup.includes('<button') && !markup.includes('disabled'))
  const panel = renderToStaticMarkup(host.views[0].component())
  check('A panel renders available rows', panel.includes('exampleCounter: available'))
  dispose()
  dispose()
  check('A dispose unregisters everything once', host.views.every((view) => view.unregistered))
}

// B：数据 seam 缺席（干净 profile 的真实常态）→ 入口可见但禁用+原因，面板明说。
{
  const host = makeHost({ data: false })
  exports_.apply(host.ctx)
  const markup = renderHeader(host)
  console.log('B header =', markup)
  check('B header disabled with reason', markup.includes('disabled') && markup.includes('needs_contract'))
  const overlayPanel = renderToStaticMarkup(host.views.find((view) => view.slot === 'workspace.dsh-plugin-example').component())
  check('B panel shows degrade row', overlayPanel.includes('exampleCounter: needs_contract'))
}

// C：宿主读取抛错 → unavailable 原因如实呈现（不吞错、不伪造）。
{
  const host = makeHost({ throwOnData: true })
  exports_.apply(host.ctx)
  const markup = renderHeader(host)
  console.log('C header =', markup)
  check('C header disabled with unavailable reason', markup.includes('disabled') && markup.includes('seam unavailable: counter registry locked'))
}

// D：放置 seam 全缺 → 零注册、不抛错。
{
  const host = makeHost({ slots: false, pane: false, data: false })
  const dispose = exports_.apply(host.ctx)
  check('D nothing registered on missing seams', host.views.length === 0)
  dispose()
}

console.log(pass ? 'BUNDLE SMOKE: PASS' : 'BUNDLE SMOKE: FAIL')
process.exit(pass ? 0 : 1)
