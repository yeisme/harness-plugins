/** Real bundled React Flow and Pane registration; only Host storage and primitives are fixtures. */
export function projectCanvasPage(width, importMap) {
  return `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${JSON.stringify(importMap)}</script>
<style>body{margin:0;background:#171719;color:#eee;font:13px Arial}#fixture{width:${width}px;height:760px}button,input,textarea,select{font:inherit}button{cursor:pointer}textarea{box-sizing:border-box}</style></head>
<body><p>Fixture: real canvas renderer, synthetic Host storage</p><button id="remount">Close and reopen Pane</button><main id="fixture"></main>
<script>window.__ModuleLoader__={load(entry){window.__canvasEntry=entry}}</script>
<script src="/vendor/react.global.js"></script><script src="/vendor/scheduler.global.js"></script><script src="/vendor/react-dom.global.js"></script><script src="/vendor/react-jsx-runtime.global.js"></script><script src="/canvas-client.js"></script>
<script type="module">
import * as primitives from '/vendor/fixture-primitives.mjs';
const module=window.__canvasEntry.factory(name=>{
  if(name==='react')return React;if(name==='react/jsx-runtime')return ReactJsxRuntime;
  if(name==='react-dom')return ReactDOM;if(name==='react-dom/client')return ReactDOMClient;
  if(name==='@deepseek-ai/dsh-client-ui-primitives')return primitives;
  throw new Error('Unexpected canvas dependency '+name);
});
let saved;window.canvasWrites=0;
const views=new Map();
const service={snapshot:async()=>({context:{tenantRef:'tenant:fixture',workspaceRef:'workspace:fixture',projectRef:'project:fixture'},owners:[]}),
  canvasRead:async()=>saved?{status:'ready',document:structuredClone(saved)}:{status:'missing'},
  canvasSave:async request=>{window.canvasWrites++;saved=structuredClone(request.document);saved.revision++;window.canvasSaved=saved;return {status:'saved',requestId:request.requestId,revision:saved.revision}},
  canvasReconcile:async()=>({status:'unknown'})};
const pane={registerView:input=>{views.set(input.descriptor.kind,input.component);return()=>views.delete(input.descriptor.kind)}};
module.apply({get:key=>key==='paneWorkbench'?pane:key==='remote'?{creatorStudio:service}:undefined});
let root=ReactDOM.createRoot(document.getElementById('fixture'));
const render=()=>root.render(React.createElement(views.get('creator.canvas')));render();
document.getElementById('remount').onclick=()=>{root.unmount();root=ReactDOM.createRoot(document.getElementById('fixture'));render()};
</script></body></html>`
}
