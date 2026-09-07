import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
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

// --- /status-flow fixture (dsh-session-insights-and-status, tasks 4.2/4.3) ---
// Serves the real built plugin libs plus browser shims for their externals.
// The flow logic lives in status-flow-host.mjs; primitives are fixture stubs.
const reactDir = dirname(require.resolve('react/package.json'))
const reactDomDir = dirname(require.resolve('react-dom/package.json'))
const reactDomRequire = createRequire(join(reactDomDir, 'package.json'))
const schedulerDir = dirname(reactDomRequire.resolve('scheduler/package.json'))

function wrapCjsGlobal(absolutePath, globalName, requires = {}) {
  const source = readFileSync(absolutePath, 'utf8')
  const requireShim = `var require = function (name) { var map = ${JSON.stringify(requires)}; if (map[name] !== undefined) return window[map[name]]; throw new Error('Unexpected module: ' + name); };`
  // IIFE: the minified CJS top-level vars must not leak onto window — sibling
  // bundles reuse the same one-letter names (e.g. scheduler's `l`).
  return `(function(){\nvar module = { exports: {} }; var exports = module.exports; var process = { env: { NODE_ENV: 'production' } };\n${requireShim}\n${source}\nwindow[${JSON.stringify(globalName)}] = module.exports;\n})();\n`
}

function esmShimFromGlobal(globalName) {
  const keys = Object.keys(require(globalName === 'React' ? 'react' : 'react/jsx-runtime'))
  const named = keys.map(key => `export const ${key} = G[${JSON.stringify(key)}];`).join('\n')
  return `const G = window[${JSON.stringify(globalName)}];\nexport default G;\n${named}\n`
}

const statusFlowVendor = {
  '/vendor/react.global.js': () => wrapCjsGlobal(join(reactDir, 'cjs/react.production.min.js'), 'React'),
  '/vendor/scheduler.global.js': () => wrapCjsGlobal(join(schedulerDir, 'cjs/scheduler.production.min.js'), 'Scheduler'),
  '/vendor/react-dom.global.js': () => `${wrapCjsGlobal(join(reactDomDir, 'cjs/react-dom.production.min.js'), 'ReactDOM', { react: 'React', scheduler: 'Scheduler' })}window.ReactDOMClient = { createRoot: window.ReactDOM.createRoot, hydrateRoot: window.ReactDOM.hydrateRoot };\n`,
  '/vendor/react-jsx-runtime.global.js': () => wrapCjsGlobal(join(reactDir, 'cjs/react-jsx-runtime.production.min.js'), 'ReactJsxRuntime', { react: 'React' }),
  '/vendor/react.mjs': () => esmShimFromGlobal('React'),
  '/vendor/react-jsx-runtime.mjs': () => esmShimFromGlobal('ReactJsxRuntime'),
  '/vendor/fixture-primitives.mjs': () => readFileSync(new URL('./fixture-primitives.mjs', import.meta.url), 'utf8'),
  '/vendor/status-flow-host.mjs': () => readFileSync(new URL('./status-flow-host.mjs', import.meta.url), 'utf8'),
  '/vendor/ui-surface.mjs': () => readFileSync(new URL('../../packages/client/ui-surface/lib/index.mjs', import.meta.url), 'utf8'),
  '/vendor/ui-visual-kit.mjs': () => readFileSync(new URL('../../packages/client/ui-visual-kit/lib/index.mjs', import.meta.url), 'utf8'),
  '/vendor/command-experience-core.mjs': () => readFileSync(new URL('../../packages/client/command-experience-core/lib/index.js', import.meta.url), 'utf8'),
  '/vendor/dsh-plugin-contracts.mjs': () => readFileSync(new URL('../../packages/sdk/dsh-plugin-contracts/lib/index.mjs', import.meta.url), 'utf8'),
  '/vendor/ui-session-status.mjs': () => readFileSync(new URL('../../packages/client/ui-session-status/lib/index.js', import.meta.url), 'utf8'),
  '/vendor/ui-command-experience-web/index.mjs': () => readFileSync(new URL('../../packages/client/ui-command-experience-web/lib/index.mjs', import.meta.url), 'utf8'),
  '/vendor/ui-command-experience-web/client.mjs': () => readFileSync(new URL('../../packages/client/ui-command-experience-web/lib/client.mjs', import.meta.url), 'utf8'),
  '/tools-client.js': () => readFileSync(new URL('../../packages/client/ui-mcp-inspector/lib/client.js', import.meta.url), 'utf8'),
  '/status-flow-client.js': () => readFileSync(new URL('../../packages/client/ui-token-usage/lib/client.js', import.meta.url), 'utf8'),
}

const statusFlowImportMap = {
  imports: {
    'react': '/vendor/react.mjs',
    'react/jsx-runtime': '/vendor/react-jsx-runtime.mjs',
    '@deepseek-ai/dsh-client-ui-primitives': '/vendor/fixture-primitives.mjs',
    '@yeisme/dsh-client-ui-surface': '/vendor/ui-surface.mjs',
    '@yeisme/dsh-client-ui-visual-kit': '/vendor/ui-visual-kit.mjs',
    '@yeisme/dsh-client-ui-command-experience-core': '/vendor/command-experience-core.mjs',
    '@yeisme/dsh-plugin-contracts': '/vendor/dsh-plugin-contracts.mjs',
    '@yeisme/dsh-client-ui-session-status': '/vendor/ui-session-status.mjs',
  },
}

function statusFlowPage(width) {
  return `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">${JSON.stringify(statusFlowImportMap)}</script>
<style>
html,body{margin:0;min-height:100%;background:#111113;color:#ececf1;font-family:Arial,sans-serif}
*{animation:none!important;transition:none!important}
body{display:grid;place-items:start center;padding:24px}
.fixture-frame{width:${width}px;min-height:620px;border:1px solid rgba(255,255,255,.12);background:#171719;overflow:hidden;display:flex;flex-direction:column}
.sf-tabs{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08)}
.sf-tabs button{padding:5px 12px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:#242429;color:inherit;font:inherit;cursor:pointer}
.sf-tabs button[aria-pressed="true"]{background:rgba(121,184,255,.18);outline:1px solid rgba(121,184,255,.35)}
.sf-headers{display:flex;gap:8px;padding:8px 10px}
.sf-header{display:flex;align-items:center;gap:8px;flex:1 1 0;min-width:0;padding:6px 9px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#1e1e21}
.sf-header-label{font-size:12px;color:#c6c6cb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sf-composer{display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(255,255,255,.08)}
.sf-composer input{flex:1 1 auto;min-width:0;min-height:34px;padding:4px 10px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#242429;color:inherit;font:inherit}
.sf-composer button{min-height:34px;padding:4px 14px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#2a2a2f;color:inherit;font:inherit;cursor:pointer}
.sf-result{padding:6px 10px;font-size:12px;color:#92929b}
.sf-popover-surface{margin:8px 10px;padding:10px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#242429;box-shadow:0 12px 32px rgba(0,0,0,.36)}
.sf-status-summary{display:grid;gap:6px;font-size:12px}
.sf-status-summary ul{margin:0;padding-left:16px;color:#c6c6cb}
.sf-status-actions{display:flex;gap:6px;margin-top:4px}
.sf-status-actions button,.sf-status-pane button{min-height:30px;padding:4px 12px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#2a2a2f;color:inherit;font:inherit;cursor:pointer}
.sf-status-pane{display:grid;gap:6px;padding:10px;font-size:12px}
.sf-status-pane ul{margin:0;padding-left:16px;color:#c6c6cb}
.sf-panes{display:flex;flex-wrap:wrap;gap:10px;padding:10px;align-items:flex-start}
.sf-pane{flex:1 1 300px;min-width:0;border:1px solid rgba(255,255,255,.12);border-radius:10px;overflow:hidden;outline:none}
.sf-pane:focus{outline:2px solid rgba(121,184,255,.5)}
.fx-btn{font:inherit;cursor:pointer;border:1px solid rgba(255,255,255,.14);border-radius:6px;background:#2a2a2f;color:inherit;padding:2px 10px}
.fx-btn:disabled{opacity:.45;cursor:not-allowed}
.fx-btn[data-active="true"],.fx-pill[aria-pressed="true"]{background:rgba(121,184,255,.18)}
.fx-input{font:inherit;min-height:30px;padding:2px 8px;border:1px solid rgba(255,255,255,.14);border-radius:6px;background:#242429;color:inherit}
.fx-modal{padding:10px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#242429}
.fx-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
#fixture-neighbor{margin:10px;padding:12px;border-radius:8px}
</style></head>
<body><main class="fixture-frame" data-fixture-kind="status-flow" data-fixture-width="${width}">
  <div class="sf-tabs" data-fixture="session-tabs">
    <button type="button" data-session-tab="sess_a" aria-pressed="true">Session A</button>
    <button type="button" data-session-tab="sess_b" aria-pressed="false">Session B</button>
  </div>
  <div class="sf-headers">
    <div class="sf-header" data-fixture="session-header" data-session="sess_a"></div>
    <div class="sf-header" data-fixture="session-header" data-session="sess_b"></div>
  </div>
  <div class="sf-popover-host" data-fixture="popover-host"></div>
  <div class="sf-panes" data-fixture="pane-host"></div>
  <div class="sf-result" data-fixture="command-result" role="status"></div>
  <form class="sf-composer" data-fixture="composer">
    <input data-fixture="composer-input" aria-label="Command input" placeholder="/status" />
    <button type="submit" data-fixture="composer-send">Send</button>
  </form>
  <aside id="fixture-neighbor" data-fixture-neighbor style="background:rgb(9,20,30);color:rgb(200,210,220);font-size:15px">Adjacent plugin sentinel</aside>
</main>
<script>
window.__flow = { queries: [], opened: [], focused: [], popovers: [], results: [], events: [], switches: [], locateCalls: [] };
window.__ModuleLoader__ = { load(entry) { window.__tokenUsageEntry = entry } };
</script>
<script src="/vendor/react.global.js"></script>
<script src="/vendor/scheduler.global.js"></script>
<script src="/vendor/react-dom.global.js"></script>
<script src="/vendor/react-jsx-runtime.global.js"></script>
<script src="/status-flow-client.js"></script>
<script type="module" src="/vendor/status-flow-host.mjs"></script>
</body></html>`
}

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

function hostThemeDeclarations(theme) {
  const light = '--dsw-alias-bg-base:#f7f8fa;--dsw-alias-bg-layer-1:#ffffff;--dsw-alias-bg-layer-2:#eef1f5;--dsw-alias-bg-overlay:#ffffff;--dsw-alias-label-primary:#18202c;--dsw-alias-label-secondary:#536070;--dsw-alias-label-tertiary:#768294;--dsw-alias-label-caption:#8a95a5;--dsw-alias-brand-text:#18202c;--dsw-alias-border-l1:rgba(24,32,44,.08);--dsw-alias-border-l2:rgba(24,32,44,.16);--dsw-alias-state-business-primary:#2563c9;--dsw-alias-interactive-bg-hover:rgba(38,49,72,.06);--dsw-alias-interactive-bg-hover-accent:rgba(38,49,72,.14);--dsw-alias-interactive-bg-active:rgba(38,49,72,.1);--dsw-alias-state-error-primary:#c83d48;--dsw-alias-state-success-primary:#218653;--dsw-alias-state-warn-primary:#b26a00'
  const dark = '--dsw-alias-bg-base:#171719;--dsw-alias-bg-layer-1:#1e1e21;--dsw-alias-bg-layer-2:#242429;--dsw-alias-bg-overlay:#2a2a2f;--dsw-alias-label-primary:#ececf1;--dsw-alias-label-secondary:#c6c6cb;--dsw-alias-label-tertiary:#92929b;--dsw-alias-label-caption:#6f6f78;--dsw-alias-brand-text:#ececf1;--dsw-alias-border-l1:rgba(255,255,255,.06);--dsw-alias-border-l2:rgba(255,255,255,.12);--dsw-alias-state-business-primary:#79b8ff;--dsw-alias-interactive-bg-hover:rgba(255,255,255,.08);--dsw-alias-interactive-bg-hover-accent:rgba(255,255,255,.24);--dsw-alias-interactive-bg-active:rgba(255,255,255,.14);--dsw-alias-state-error-primary:#ee6b72;--dsw-alias-state-success-primary:#51c58b;--dsw-alias-state-warn-primary:#f0b45a'
  if (theme === 'light') return `:root{${light}}`
  if (theme === 'dark') return `:root{${dark}}`
  if (theme === 'system') return `:root{${light}}@media(prefers-color-scheme:dark){:root{${dark}}}`
  return ''
}

function page(kind, width, name, theme) {
  const markup = renderToStaticMarkup(name === undefined ? surfaceFixture(kind) : namedFixture(name))
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${hostThemeDeclarations(theme)}
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
  if (url.pathname === '/selection-client.js') {
    response.writeHead(200, { 'content-type': 'text/javascript' })
    response.end(readFileSync(new URL('../../packages/client/ui-selection-annotation/lib/client.js', import.meta.url)))
    return
  }
  const vendorAsset = statusFlowVendor[url.pathname]
  if (vendorAsset !== undefined) {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
    response.end(vendorAsset())
    return
  }
  if (url.pathname === '/session-tools') {
    const width = [360,560,960].includes(Number(url.searchParams.get('width'))) ? Number(url.searchParams.get('width')) : 560
    const height = url.searchParams.get('short') === 'true' ? 150 : 650
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#111;color:#eee;font-family:Arial,sans-serif}#tools{width:${width}px;height:${height}px}button,input,select{font:inherit}</style></head><body><main id="tools"></main>
<script type="importmap">${JSON.stringify(statusFlowImportMap)}</script><script>window.__ModuleLoader__={load(entry){window.__toolsEntry=entry}}</script>
<script src="/vendor/react.global.js"></script><script src="/vendor/scheduler.global.js"></script><script src="/vendor/react-dom.global.js"></script><script src="/vendor/react-jsx-runtime.global.js"></script><script src="/tools-client.js"></script>
<script type="module">
import * as surface from '/vendor/ui-surface.mjs';
import * as visualKit from '/vendor/ui-visual-kit.mjs';
const exports=window.__toolsEntry.factory(name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return ReactJsxRuntime;if(name==='@yeisme/dsh-client-ui-surface')return surface;if(name==='@yeisme/dsh-client-ui-visual-kit')return visualKit;throw new Error('Unexpected module '+name)})
const activity=exports.deriveToolActivity(Array.from({length:30},(_,i)=>({kind:'tool-result',seq:i,time:10000-i*200,callTime:9900-i*200,call:{name:'fixture_tool_'+i},isError:i===0})),[])
function Fixture(){const [section,setSection]=React.useState('activity'),[call,setCall]=React.useState(),[filter,setFilter]=React.useState('all');return exports.renderToolsInspectorTree({catalogState:{status:'unavailable',message:'catalog_unavailable'},activity,query:'',family:'all',enabled:'all',activeSection:section,selectedCall:call,activityFilter:filter,canRefresh:true,onQueryChange(){},onFamilyChange(){},onEnabledChange(){},onToggle(){},onActiveSectionChange:setSection,onSelectCall:setCall,onActivityFilterChange:setFilter,onRevealCall(){window.__revealed=true},onRefresh(){},toolbarActions:React.createElement('button',{className:'vk-btn'},'Pin to side pane')})}
ReactDOM.createRoot(document.getElementById('tools')).render(React.createElement(Fixture));document.body.dataset.ready='true'
</script></body></html>`)
    return
  }
  if (url.pathname === '/status-flow') {
    const requestedWidth = Math.trunc(Number(url.searchParams.get('width') ?? 560) || 560)
    const width = [360, 560, 960].includes(requestedWidth) ? requestedWidth : 560
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(statusFlowPage(width))
    return
  }
  if (url.pathname === '/selection') {
    const theme = url.searchParams.get('theme') ?? 'fallback'
    const referenceEnabled = url.searchParams.get('reference') === 'true'
    // Additive S-scenario gates; absent params keep the original fixture behavior.
    const act = url.searchParams.get('act') === '1'
    const choose = url.searchParams.get('choose') === '1'
    const chooseResult = url.searchParams.get('chooseResult') ?? 'selected'
    const fail = url.searchParams.get('fail') === '1'
    const delay = Math.max(0, Math.trunc(Number(url.searchParams.get('delay') ?? '0') || 0))
    const noSource = url.searchParams.get('nosource') === '1'
    const tall = url.searchParams.get('tall') === '1'
    const longTitle = url.searchParams.get('longtitle') === '1'
    const fixtureTitle = longTitle
      ? 'Northern Lights production review session — autumn window 47 chars'
      : 'Visual fixture chat'
    const sourceAttributes = `sample.setAttribute('data-dsh-reference-source', '');
      sample.setAttribute('data-dsh-reference-source-owner', source.owner);
      sample.setAttribute('data-dsh-reference-source-ref', source.ref);
      sample.setAttribute('data-dsh-reference-source-version', source.version);
      sample.setAttribute('data-dsh-reference-source-scope', source.scope);
      sample.setAttribute('data-dsh-reference-source-range-start', '0');
      sample.setAttribute('data-dsh-reference-source-range-end', String(new TextEncoder().encode(sample.textContent).byteLength));`
    const chooseTargetMethod = `async chooseTarget() {
        window.__chooseCalls = (window.__chooseCalls ?? 0) + 1;
        const mode = ${JSON.stringify(chooseResult)};
        if (mode === 'cancelled') return { status: 'cancelled' };
        if (mode === 'unavailable') return { status: 'unavailable', reason: 'fixture chooser unavailable' };
        target = { workspaceId: 'visual-workspace', conversationId: 'visual-conversation-2', title: 'Second fixture chat', draftRevision: 1 };
        for (const listener of listeners) listener();
        return { status: 'selected', target };
      },`
    const referenceBridgeScript = referenceEnabled ? `(() => {
      let target = { workspaceId: 'visual-workspace', conversationId: 'visual-conversation', draftRevision: 3, title: ${JSON.stringify(fixtureTitle)} };
      const sample = document.getElementById('sample');
      const source = { owner: 'visual-fixture', ref: 'fixture:selection-sample', version: 'fixture-v1', scope: 'raw-text' };
      ${noSource ? '' : sourceAttributes}
      const listeners = new Set();
      const features = ${act || choose ? `{ activation: ${act}, chooseTarget: ${choose} }` : 'undefined'};
      return {
        snapshot() { return features === undefined ? { available: true, target } : { available: true, target, features }; },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        async resolveSelection({ anchor, source: selectedSource }) {
          window.__resolutions = (window.__resolutions ?? 0) + 1;
          if (selectedSource.owner !== source.owner || selectedSource.ref !== source.ref || selectedSource.version !== source.version || selectedSource.scope !== source.scope) {
            return { status: 'unavailable', reason: 'fixture source proof mismatch' };
          }
          return { status: 'available', reference: {
            id: 'fixture-selection-reference', kind: 'selection', intent: 'content',
            owner: source.owner, ref: source.ref, version: source.version,
            label: 'Selected diagnostic text', scope: source.scope,
            digest: anchor.quoteDigest, freshness: 'fixture-current',
            preview: anchor.quotePreview, window: selectedSource.window,
          } };
        },
        ${choose ? chooseTargetMethod : ''}
      };
    })()` : 'undefined'
    const echoScript = `
    window.__referenceAdds = [];
    window.__submits = [];
    window.addEventListener('dsh-composer-reference:add-to-main', event => {
      window.__referenceAdds.push(event.detail);
      const receipt = { version: 1, requestId: event.detail.requestId, ok: ${fail ? 'false' : 'true'}, ${fail ? `reason: 'fixture rejection',` : ''} target: event.detail.target };
      if (event.detail.activation !== undefined && ${act}) receipt.activated = true;
      const respond = () => window.dispatchEvent(new CustomEvent('dsh-composer-reference:add-to-main-result', { detail: receipt }));
      ${delay > 0 ? `setTimeout(respond, ${delay});` : 'respond();'}
    });
    window.addEventListener('dsh-selection-annotation:submit', event => { window.__submits.push(event.detail); });`
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(`<!doctype html><html><head><meta charset="utf-8"><style>${hostThemeDeclarations(theme)}body{font-family:Arial,sans-serif;background:var(--dsw-alias-bg-base,#171719);color:var(--dsw-alias-label-primary,#ececf1);padding:24px}#sample{margin-top:80px}${tall ? 'body{min-height:2400px}#sample{margin-top:320px}' : ''}</style></head><body><p id="sample">Failed to load plugins — selected diagnostic text with a long reference for annotation.</p><script>
    window.__ModuleLoader__ = { load(entry) { window.selectionClient = entry.factory(name => { if (name === 'react' || name === 'react/jsx-runtime') return {}; throw new Error('Unexpected module: ' + name) }) } };
    </script><script src="/selection-client.js"></script><script>
    // Component-fixture proof only: the source range is owner-backed raw text,
    // and the bridge returns a fixed fixture record instead of deriving authority
    // from arbitrary page content.
    const referenceBridge = ${referenceBridgeScript};${echoScript}
    selectionClient.apply({effect() {}, locale:{getLocale(){return {active:new URLSearchParams(location.search).get('locale') || 'en'}}}}, {referenceBridge}).then(()=>{document.body.dataset.ready='true'});
    </script></body></html>`)
    return
  }
  const kind = kinds.has(url.searchParams.get('kind') ?? '') ? url.searchParams.get('kind') : 'navigator'
  const name = namedFixtures.has(url.searchParams.get('fixture') ?? '') ? url.searchParams.get('fixture') : undefined
  const requestedWidth = Number(url.searchParams.get('width') ?? 560)
  const width = [360, 560, 960].includes(requestedWidth) ? requestedWidth : 560
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  response.end(page(kind, width, name, url.searchParams.get('theme') ?? 'fallback'))
}).listen(port, '127.0.0.1', () => process.stdout.write(`UI_VISUAL_READY http://127.0.0.1:${port}\n`))
