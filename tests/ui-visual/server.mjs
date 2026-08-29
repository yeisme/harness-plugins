import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '../../packages/client/ui-surface/lib/index.mjs'

const require = createRequire(new URL('../../packages/client/ui-surface/package.json', import.meta.url))
const { createElement: h } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const port = Number(process.env.UI_VISUAL_PORT ?? 4178)
const kinds = new Set(['navigator', 'workspace', 'inspector', 'dialog', 'micro'])
const namedFixtures = new Set(['creator', 'source-control', 'desktop-git', 'command-dialog', 'session-tags', 'rich-media'])

function button(label, primary = false) {
  return h('button', { type: 'button', className: 'vk-btn', 'data-primary': primary || undefined }, label)
}

function surfaceFixture(kind) {
  if (kind === 'navigator') return h(Surface, { kind, 'aria-label': 'Repository' },
    h(SurfaceContextBar, {
      context: 'Repository · yeisme-agent',
      description: 'main · origin/main · +0/−0',
      status: h('span', null, 'fresh'),
      actions: button('Refresh'),
    }),
    h('div', { className: 'ys-body' },
      h('label', { className: 'ys-field' }, h('span', null, 'Repository'), h('select', { defaultValue: 'main' }, h('option', { value: 'main' }, 'yeisme-agent'))),
      h(SurfaceSection, { title: 'Changes', meta: '0' }, h(SurfaceState, { phase: 'success', title: 'Working tree clean', description: 'No pending changes on main.' })),
    ),
    h(SurfaceActionBar, null, button('History'), button('Commit', true)),
  )
  if (kind === 'workspace') return h(Surface, { kind, 'aria-label': 'Creator workspace' },
    h(SurfaceContextBar, {
      context: 'Creator Studio · Create',
      description: 'Current project · owner projections fresh',
      status: h('span', null, '6 owners ready'),
      nav: h('div', null, button('Start'), button('Create', true), button('Produce'), button('Review'), button('Library')),
      actions: button('Refresh'),
    }),
    h('div', { className: 'ys-body' },
      h(SurfaceSection, { title: 'Next action', description: 'Continue the current creative task.' }, h('div', { className: 'ys-row' }, h('span', null, '●'), h('strong', null, 'Review shot 04 candidate'), button('Open'))),
      h(SurfaceSection, { title: 'Production', meta: '3 / 6 stages' }, h('div', { className: 'ys-grid' }, h('div', { className: 'vk-card' }, 'Text · done'), h('div', { className: 'vk-card' }, 'Visual · running'), h('div', { className: 'vk-card' }, 'Review · pending'))),
    ),
  )
  if (kind === 'inspector') return h(Surface, { kind, 'aria-label': 'Capabilities inspector' },
    h(SurfaceContextBar, { context: 'Workspace capabilities', description: 'Tier 1 · safe projection', actions: button('Refresh') }),
    h('div', { className: 'ys-body' },
      h(SurfaceSection, { title: 'Seams', meta: '3 ready' }, h('ul', { className: 'ys-list' },
        h('li', { className: 'ys-row' }, h('span', null, '●'), h('span', null, 'pane.workbench.v1'), h('small', null, 'ready')),
        h('li', { className: 'ys-row' }, h('span', null, '●'), h('span', null, 'artifact.intent.v1'), h('small', null, 'ready')),
      )),
      h(SurfaceState, { phase: 'stale', title: 'TerminalHostV2 unavailable', description: 'Interactive terminal actions stay disabled.' }),
    ),
  )
  if (kind === 'dialog') return h('div', { className: 'dialog-mask' }, h(Surface, { kind, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Confirm action' },
    h(SurfaceContextBar, { title: 'Confirm action', description: 'Review the target and expected effect.' }),
    h('div', { className: 'ys-body' }, h(SurfaceSection, { title: 'Commit 3 staged files' }, h('label', { className: 'ys-field' }, h('span', null, 'Message'), h('textarea', { defaultValue: 'Unify Web surface chrome' })))),
    h(SurfaceActionBar, null, button('Cancel'), button('Confirm', true)),
  ))
  return h(Surface, { kind: 'micro', 'aria-label': 'Suggestions' }, h('div', { className: 'ys-body' }, button('Run focused tests'), button('Open evidence')))
}

function namedFixture(name) {
  if (name === 'creator') return h(Surface, { kind: 'workspace', 'aria-label': 'Creator Studio' },
    h(SurfaceContextBar, {
      title: 'Creator Studio', context: 'Start · Northern Lights', description: 'Context frozen at revision 42',
      status: h('span', null, '5 ready · 1 stale'), actions: button('Refresh'),
      nav: h('div', null, button('Start', true), button('Create'), button('Produce'), button('Review'), button('Library')),
    }),
    h('div', { className: 'ys-body' },
      h(SurfaceSection, { title: 'Next action' }, h('div', { className: 'ys-row' }, h('span', null, '1'), h('span', { className: 'ys-row-main' }, h('strong', null, 'Review shot 04'), h('small', null, 'Visual candidate ready for approval')), button('Open', true))),
      h(SurfaceSection, { title: 'Production status', meta: '3 / 5 complete' }, h('ul', { className: 'ys-list' },
        h('li', { className: 'ys-row' }, h('span', null, '●'), h('span', { className: 'ys-row-main' }, h('strong', null, 'Text'), h('small', null, 'Owner complete')), h('small', null, 'done')),
        h('li', { className: 'ys-row' }, h('span', null, '●'), h('span', { className: 'ys-row-main' }, h('strong', null, 'Visual'), h('small', null, 'Shot generation')), h('small', null, 'running')),
      )),
      h(SurfaceSection, { title: 'Review queue', meta: '2' }, h('div', { className: 'ys-row' }, h('span', null, '●'), h('span', { className: 'ys-row-main' }, h('strong', null, 'Shot 04 candidate B'), h('small', null, 'Eikona · 2 minutes ago')), button('Review'))),
    ),
  )
  if (name === 'source-control') return h(Surface, { kind: 'navigator', 'aria-label': 'Source Control' },
    h(SurfaceContextBar, { title: 'Source Control', context: 'yeisme-agent', description: 'main · +0/−0', actions: button('Refresh') }),
    h('div', { className: 'ys-body' },
      h('label', { className: 'ys-field' }, h('span', null, 'Repository'), h('select', { defaultValue: 'repo' }, h('option', { value: 'repo' }, 'yeisme-agent'))),
      h(SurfaceState, { phase: 'success', title: 'Working tree clean', description: 'Recent commit 8b3a17e · Unify Web surface chrome' }),
    ),
    h(SurfaceActionBar, null, button('History'), button('Refresh')),
  )
  if (name === 'desktop-git') return h(Surface, { kind: 'workspace', 'aria-label': 'Desktop Git' },
    h(SurfaceContextBar, { title: 'Git', context: 'yeisme-agent', description: 'main · 2 staged · 1 unstaged', actions: button('Refresh') }),
    h('div', { className: 'ys-body named-split' },
      h(SurfaceSection, { title: 'Changes', meta: '3' }, h('ul', { className: 'ys-list' },
        h('li', { className: 'ys-row' }, h('span', null, 'M'), h('span', { className: 'ys-row-main' }, h('strong', null, 'CreatorStudio.tsx'), h('small', null, 'staged')), h('small', null, '+24 −9')),
        h('li', { className: 'ys-row' }, h('span', null, 'M'), h('span', { className: 'ys-row-main' }, h('strong', null, 'surface.css'), h('small', null, 'unstaged')), h('small', null, '+8 −2')),
      )),
      h(SurfaceSection, { title: 'Commit staged changes', description: 'Only staged files will be committed.' }, h('label', { className: 'ys-field' }, h('span', null, 'Commit message'), h('textarea', { defaultValue: 'Unify pane surface chrome' }))),
    ),
    h(SurfaceActionBar, null, button('Commit', true)),
  )
  if (name === 'command-dialog') return h('div', { className: 'dialog-mask' }, h(Surface, { kind: 'dialog', role: 'dialog', 'aria-label': 'Command Menu' },
    h(SurfaceContextBar, { title: 'Command Menu', description: 'Search and run an available command.' }),
    h('div', { className: 'ys-body' },
      h('label', { className: 'ys-field' }, h('span', null, 'Command'), h('input', { value: '/session', readOnly: true })),
      h('ul', { className: 'ys-list' },
        h('li', { className: 'ys-row selected-row' }, h('span', null, '↵'), h('span', { className: 'ys-row-main' }, h('strong', null, '/session resume'), h('small', null, 'Resume a saved session')), h('small', null, 'Session')),
        h('li', { className: 'ys-row' }, h('span', null, '•'), h('span', { className: 'ys-row-main' }, h('strong', null, '/session archive'), h('small', null, 'Owner preview required')), h('small', null, 'Disabled')),
      ),
    ),
  ))
  if (name === 'session-tags') return h('div', { className: 'dialog-mask' }, h(Surface, { kind: 'dialog', role: 'dialog', 'aria-label': 'Manage tags' },
    h(SurfaceContextBar, { title: 'Manage tags', context: 'Creator review session' }),
    h('div', { className: 'ys-body' },
      h('div', { className: 'chip-row' }, h('span', { className: 'fixture-chip' }, 'creator ×'), h('span', { className: 'fixture-chip' }, 'review ×')),
      h('label', { className: 'ys-field' }, h('span', null, 'New tag'), h('input', { value: 'production', readOnly: true })),
      h(SurfaceSection, { title: 'Existing tags' }, h('div', { className: 'chip-row' }, button('priority'), button('handoff'), button('visual'))),
    ),
    h(SurfaceActionBar, null, button('Cancel'), button('Save', true)),
  ))
  return h(Surface, { kind: 'workspace', 'aria-label': 'Rich Media' },
    h(SurfaceContextBar, { title: 'Rich Media', context: 'Northern Lights', description: '12 owner-authorized assets', actions: button('Refresh') }),
    h('div', { className: 'ys-body named-split media-layout' },
      h(SurfaceSection, { title: 'Media library', meta: '12' }, h('div', { className: 'media-grid' },
        h('div', { className: 'media-card selected-row' }, h('div', { className: 'media-thumb' }, 'SHOT 04'), h('strong', null, 'Candidate B'), h('small', null, 'image · ready')),
        h('div', { className: 'media-card' }, h('div', { className: 'media-thumb' }, 'VOICE'), h('strong', null, 'Take 03'), h('small', null, 'audio · partial')),
      )),
      h(SurfaceSection, { title: 'Preview', description: 'Candidate B · 1920×1080' }, h('div', { className: 'preview-stage' }, 'OWNER PREVIEW')),
    ),
  )
}

function page(kind, width, name) {
  const markup = renderToStaticMarkup(name === undefined ? surfaceFixture(kind) : namedFixture(name))
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;min-height:100%;background:#111113;color:#ececf1;font-family:Arial,sans-serif}
  *{animation:none!important;transition:none!important}
  body{display:grid;place-items:start center;padding:24px}
  .fixture-frame{width:${width}px;min-height:${kind === 'micro' ? 80 : 620}px;border:1px solid rgba(255,255,255,.12);background:#171719;overflow:hidden}
  .dialog-mask{display:grid;place-items:center;min-height:620px;padding:24px;background:rgba(0,0,0,.46)}
  .dialog-mask>[data-yeisme-surface]{width:min(440px,100%);min-height:0;border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 18px 48px rgba(0,0,0,.36)}
  .named-split{grid-template-columns:minmax(0,1.2fr) minmax(240px,.8fr)}
  .chip-row{display:flex;flex-wrap:wrap;gap:8px}.fixture-chip{padding:5px 9px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:#242429}
  .selected-row{background:rgba(121,184,255,.12);outline:1px solid rgba(121,184,255,.35)}
  .media-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.media-card{display:grid;gap:6px;padding:8px;border:1px solid rgba(255,255,255,.12);border-radius:9px}.media-thumb,.preview-stage{display:grid;place-items:center;min-height:110px;border-radius:7px;background:linear-gradient(135deg,#293345,#171b22);color:#a9bdd8;font-size:11px;letter-spacing:.12em}.preview-stage{min-height:240px}
  @container yeisme-surface (max-width:720px){.named-split{grid-template-columns:1fr}.media-grid{grid-template-columns:1fr}.preview-stage{min-height:160px}}
  </style></head><body><main class="fixture-frame" data-fixture-kind="${name ?? kind}" data-fixture-width="${width}">${markup}</main></body></html>`
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('ok')
    return
  }
  const kind = kinds.has(url.searchParams.get('kind') ?? '') ? url.searchParams.get('kind') : 'navigator'
  const name = namedFixtures.has(url.searchParams.get('fixture') ?? '') ? url.searchParams.get('fixture') : undefined
  const requestedWidth = Number(url.searchParams.get('width') ?? 560)
  const width = [360, 560, 960].includes(requestedWidth) ? requestedWidth : 560
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  response.end(page(kind, width, name))
}).listen(port, '127.0.0.1', () => process.stdout.write(`UI_VISUAL_READY http://127.0.0.1:${port}\n`))
