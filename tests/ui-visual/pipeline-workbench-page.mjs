/**
 * Pipeline workbench visual fixture page (dsh-creative-pipeline-visual-workbench-v1, task 5.5).
 *
 * Mounts the REAL built `@yeisme/dsh-client-ui-ai-drama-director` client bundle
 * (ModuleLoader entry) with the fixture projection owner. Only host services
 * are fixture stubs: primitives Modal/Button/Input, the `@xyflow/react` UMD
 * global, and the rich-media ModuleLoader client. The capsule menu uses the
 * real primitives Menu via the shared native-menu fixture bundle.
 *
 * Scenarios (query param `case`) mutate only the fixture owner envelope, so
 * every state still crosses the fail-closed D1 decoders:
 * - desktop (default): full three-column layout at the given width;
 * - narrow: width <= 420 collapses to the object list + detail Modal;
 * - loading: owner snapshot never settles;
 * - stale / unknown: run projections re-marked stale/unknown (mutations
 *   disabled, reconcile required);
 * - needs_contract: run projections omitted entirely (synthetic
 *   needs_contract inspector state);
 * - running / blocked / capsule: baseline fixture; the spec drives edge
 *   selection and capsule switching.
 */
export function pipelineWorkbenchPage(width, scenario, importMap) {
  return `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${JSON.stringify(importMap)}</script>
<style>
:root{--dsw-alias-bg-base:#171719;--dsw-alias-bg-layer-1:#1e1e21;--dsw-alias-bg-layer-2:#242429;--dsw-alias-bg-overlay:#2a2a2f;--dsw-alias-label-primary:#ececf1;--dsw-alias-label-secondary:#c6c6cb;--dsw-alias-label-tertiary:#92929b;--dsw-alias-label-caption:#6f6f78;--dsw-alias-brand-text:#ececf1;--dsw-alias-border-l1:rgba(255,255,255,.06);--dsw-alias-border-l2:rgba(255,255,255,.12);--dsw-alias-state-business-primary:#79b8ff;--dsw-alias-interactive-bg-hover:rgba(255,255,255,.08);--dsw-alias-interactive-bg-hover-accent:rgba(255,255,255,.24);--dsw-alias-interactive-bg-active:rgba(255,255,255,.14);--dsw-alias-state-error-primary:#ee6b72;--dsw-alias-state-success-primary:#51c58b;--dsw-alias-state-warn-primary:#f0b45a}
html,body{margin:0;min-height:100%;background:#111113;color:#ececf1;font-family:Arial,sans-serif}
*{animation:none!important;transition:none!important}
body{display:grid;place-items:start center;padding:8px}
#fixture-frame{width:${width}px;height:820px;border:1px solid rgba(255,255,255,.12);background:#171719;overflow:hidden;display:flex;flex-direction:column}
#fixture-frame>[data-yeisme-surface]{flex:1;min-height:0}
.fx-btn{font:inherit;cursor:pointer;border:1px solid rgba(255,255,255,.14);border-radius:6px;background:#2a2a2f;color:inherit;padding:2px 10px;min-height:28px}
.fx-btn:disabled{opacity:.45;cursor:not-allowed}
.fx-btn[data-active="true"],.fx-pill[aria-pressed="true"]{background:rgba(121,184,255,.18)}
.fx-input{font:inherit;min-height:30px;padding:2px 8px;border:1px solid rgba(255,255,255,.14);border-radius:6px;background:#242429;color:inherit}
.fx-modal{position:absolute;inset:12% 6%;z-index:10;padding:10px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#242429;box-shadow:0 12px 32px rgba(0,0,0,.36);overflow:auto}
.fx-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.fx-menu{padding:6px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#242429;box-shadow:0 12px 32px rgba(0,0,0,.36)}
</style></head>
<body data-fixture="pipeline-workbench" data-scenario="${scenario}">
<p style="margin:4px 8px;font-size:11px;color:#92929b">Fixture: real pipeline workbench bundle + fixture owner projection; no provider execution.</p>
<main id="fixture-frame" data-fixture-width="${width}"><div id="fixture" style="display:flex;flex-direction:column;flex:1;min-height:0"></div></main>
<script>
window.__entries = {};
window.__ModuleLoader__ = { load(entry) { window.__entries[entry.id] = entry } };
</script>
<script src="/vendor/react.global.js"></script>
<script src="/vendor/scheduler.global.js"></script>
<script src="/vendor/react-dom.global.js"></script>
<script src="/vendor/react-jsx-runtime.global.js"></script>
<script>window.jsxRuntime = window.ReactJsxRuntime;</script>
<script src="/vendor/xyflow-umd.js"></script>
<script src="/vendor/rich-media-client.js"></script>
<script src="/drama-client.js"></script>
<script type="module">
import { Button, Input, Modal, Pill, DisclosureRow } from '/vendor/fixture-primitives.mjs';
import { Menu } from '/vendor/native-menu.mjs';

const primitives = { Button, Input, Modal, Pill, DisclosureRow, Menu };
const xyflowCss = await (await fetch('/vendor/xyflow-base.css')).text();
const requireShim = name => {
  if (name === 'react') return window.React;
  if (name === 'react/jsx-runtime') return window.ReactJsxRuntime;
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
  if (name === '@xyflow/react') return window.ReactFlow;
  if (name === '@xyflow/react/dist/base.css?inline') return xyflowCss;
  if (name === '@yeisme/dsh-rich-media/client') {
    const richMediaEntry = window.__entries['@yeisme/dsh-rich-media'];
    return richMediaEntry.factory(dep => {
      if (dep === 'react') return window.React;
      if (dep === 'react-dom') return window.ReactDOM;
      if (dep === 'react/jsx-runtime') return window.ReactJsxRuntime;
      if (dep === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
      if (dep === 'url') return { pathToFileURL: value => ({ href: String(value) }) };
      throw new Error('Unexpected rich-media dependency ' + dep);
    });
  }
  throw new Error('Unexpected drama dependency ' + name);
};

const drama = window.__entries['@yeisme/dsh-client-ui-ai-drama-director'].factory(requireShim);
const scenario = ${JSON.stringify(scenario)};
const base = drama.createPipelineFixtureOwner();
const snapshot = () => base.snapshot();
const variants = {
  desktop: base,
  narrow: base,
  capsule: base,
  running: base,
  blocked: base,
  loading: { ...base, snapshot: () => new Promise(() => {}) },
  stale: { ...base, snapshot: async () => {
    const s = await snapshot();
    return {
      ...s,
      runs: s.runs.map(run => ({ ...run, freshness: 'stale' })),
      runProjections: s.runProjections.map(run => ({ ...run, freshness: 'stale' })),
    };
  } },
  unknown: { ...base, snapshot: async () => {
    const s = await snapshot();
    return {
      ...s,
      runs: s.runs.map(run => ({
        ...run,
        freshness: 'unknown',
        state: { state: 'unknown', reason: 'Owner lost the run cursor', impact: run.state.impact, next_action: 'Reconcile with the owner' },
      })),
      runProjections: s.runProjections.map(run => ({
        schema: run.schema, runRef: run.runRef, executionEdgeRef: run.executionEdgeRef,
        status: 'unknown', freshness: 'unknown', reason: 'Owner lost the run cursor.',
        actions: run.actions, evidenceRefs: run.evidenceRefs, version: run.version,
      })),
    };
  } },
  needs_contract: { ...base, snapshot: async () => {
    const s = await snapshot();
    return { ...s, runProjections: [] };
  } },
};
const owner = variants[scenario] ?? base;
// Visual-tier canvas layout: the shared fixture document spreads nodes to
// x≈1130, but the embedded canvas stage is only ~470px wide at the 1152px
// frame — execution edges either fall outside the rendered viewport
// (onlyRenderVisibleElements) or their labels land under other nodes, so
// the spec's real canvas edge click has nothing to hit. Re-layout fixture
// node positions into a compact two-column grid whose edge label midpoints
// sit in the free gutter (x≈230/370). Fixture data only: ids, edge wiring
// and the contract envelope are unchanged.
const CANVAS_LAYOUT = {
  'node:asset-poster': { x: 10, y: 20, width: 170, height: 100 },
  'node:shot04': { x: 10, y: 150, width: 170, height: 100 },
  'node:char-lin': { x: 10, y: 280, width: 170, height: 100 },
  'node:scene-rooftop': { x: 280, y: 20, width: 180, height: 100 },
  'node:candidate-c2': { x: 280, y: 150, width: 180, height: 100 },
  'node:candidate-c1': { x: 280, y: 280, width: 180, height: 100 },
  'node:op-image-gen': { x: 280, y: 410, width: 180, height: 100 },
};
if (owner.canvasRemote) {
  const read = owner.canvasRemote.canvasRead;
  owner.canvasRemote = { ...owner.canvasRemote, canvasRead: async input => {
    const result = await read(input);
    if (result?.status !== 'ready') return result;
    // Edge stacking: SVG siblings paint in array order, and the two execution
    // bezier strokes cross the gutter near the running edge label. Rendering
    // edge:shot04-run last keeps its label the topmost hit target there (the
    // blocked label at y≈265 stays clear of every later stroke).
    const edges = result.document.edges;
    const running = edges.filter(edge => edge.id === 'edge:shot04-run');
    return { ...result, document: { ...result.document,
      edges: [...edges.filter(edge => edge.id !== 'edge:shot04-run'), ...running],
      nodes: result.document.nodes.map(node => {
        const layout = CANVAS_LAYOUT[node.id];
        return layout === undefined ? node : { ...node, position: { x: layout.x, y: layout.y }, size: { width: layout.width, height: layout.height } };
      }) } };
  } };
}
window.__pipelineOwner = owner;
const View = drama.createPipelineWorkbenchView({ owner });
window.ReactDOM.createRoot(document.getElementById('fixture')).render(window.React.createElement(View));
document.body.dataset.pipelineMounted = scenario;
</script>
</body></html>`
}
