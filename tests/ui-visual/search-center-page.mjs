/** Browser component fixture; no live owners or business actions are connected. */
export function searchCenterPage(importMap, params) {
  const width = [360, 560, 960, 1200].includes(Number(params.get('width'))) ? Number(params.get('width')) : 960
  const lang = params.get('lang') === 'en' ? 'en' : 'zh'
  const mode = params.get('mode') === 'dialog' ? 'dialog' : 'pane'
  const light = params.get('theme') === 'light'
  const scenario = ['canvas', 'files', 'metadata', 'scope', 'handoff', 'handoff-missing', 'layout', 'providers', 'tools-owner', 'tools-reader', 'restore-selection'].includes(params.get('case')) ? params.get('case') : 'catalog'
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<script type="importmap">${JSON.stringify(importMap)}</script>
<style>
html,body{margin:0;background:${light ? '#f5f5f7' : '#171719'};font-family:Arial,sans-serif;color:${light ? '#202024' : '#ececf1'}}
body{display:flex;justify-content:center}
/* The installed primitive bundle has CSS stubs. Reproduce the host Modal's
   root/mask/card layout from ui-primitives/src/Modal.module.css for this fixture. */
body>[role=presentation]:has(>[role=dialog]){position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px}
body>[role=presentation]>[aria-hidden=true]{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}
[role=dialog]{position:relative;z-index:1;display:flex;flex-direction:column;gap:20px;width:min(380px,100%);padding:0 0 24px;overflow:hidden;border:0;border-radius:24px;background:var(--dsw-alias-bg-layer-2)}
#fixture{width:${width}px;height:760px;min-width:0}
#fixture>.pwr-search-surface{height:100%}
${light ? ':root{--dsw-alias-bg-base:#f5f5f7;--dsw-alias-bg-layer-1:#ffffff;--dsw-alias-bg-layer-2:#eeeeef;--dsw-alias-bg-elevated:#ffffff;--dsw-alias-text-primary:#202024;--dsw-alias-text-secondary:#45454c;--dsw-alias-text-tertiary:#606068;--dsw-alias-border-l1:rgba(0,0,0,.08);--dsw-alias-border-l2:rgba(0,0,0,.16);--dsw-alias-fill-hover:rgba(0,0,0,.06)}' : ''}
</style></head><body><div id="fixture"></div>
<script src="/vendor/react.global.js"></script><script src="/vendor/scheduler.global.js"></script><script src="/vendor/react-dom.global.js"></script><script src="/vendor/react-jsx-runtime.global.js"></script>
<script type="module">
import {WorkspaceSearchOverlay,PaneWorkbenchController,PaneViewRegistry,PaneCommandRegistry,setActiveLocale,createSessionListConversationSearchHost,searchSourcesFor,searchHandoffChannel,applyToolsOwner,toolsOwnerEn,ToolHubSidecar,createExplorerRuntimeSource,registerExplorerProvider,requestExplorerReveal,createFileSearchSource,createProjectCanvasSearchSource} from '/vendor/native-menu.mjs';
setActiveLocale(${JSON.stringify(lang)});
const registry=new PaneViewRegistry({capabilities:new Set()});
for(let index=0;index<9;index++) registry.registerView({descriptor:{kind:'fixture.docs.'+index,label:'Document '+index,componentKey:'doc-'+index,role:'content',preferredRegion:'right',retention:'snapshot',singleton:true},component:()=>null});
const controller=new PaneWorkbenchController({registry});
if(${JSON.stringify(scenario)}==='layout')controller.openView({kind:'fixture.docs.8',resourceKey:'view:fixture.docs.8',title:'Document 8',role:'content',preferredRegion:'right',retention:'snapshot',singleton:true,pinned:true});
window.searchLayoutSnapshot=()=>controller.getSnapshot();
const commands=new PaneCommandRegistry();
window.fixtureExecutions=0;
commands.register({descriptor:{id:'fixture.inspect',label:'Inspect fixture'},execute:()=>{window.fixtureExecutions++}});
let conversationSearch,workspaceContext;
if(${JSON.stringify(scenario)}==='restore-selection'){
  searchSourcesFor(controller).register({descriptor:{id:'fixture.delayed',owner:'fixture',resourceKinds:['skill'],coverage:'catalog',scopes:['profile'],filters:[],sorts:['relevance'],pagination:false,preview:false,open:true},
    search:()=>new Promise(resolve=>{window.releaseHandoffResult=()=>resolve({status:'ready',resources:[{owner:'fixture',ref:'wanted',kind:'skill',title:'Document skill'}]})}),
    open:async()=>{window.fixtureExpectedOpened=true;return {status:'opened'}}});
  searchHandoffChannel(controller).send({query:'Document',category:'all',filters:{category:'all',allAccessibleProjects:true,openedOnly:false,showCompatibility:false},controls:{sort:'relevance'},previewLimit:5,selectedKey:'resource:'+JSON.stringify(['fixture.delayed','fixture','wanted',null])});
}

if(${JSON.stringify(scenario)}==='providers'){
  workspaceContext={getSnapshot:()=>({workspaceRef:'w1',revision:'1'}),listWorkspaces:()=>[{workspaceRef:'w1',label:'Fixture project'}]};
  window.removeResourceSource=searchSourcesFor(controller).register({descriptor:{id:'fixture.resources',owner:'fixture.tools',resourceKinds:['skill'],coverage:'catalog',scopes:['profile'],filters:[],sorts:['relevance'],pagination:false,preview:false,open:true},
    search:async request=>({status:'ready',resources:Array.from({length:7},(_,index)=>({owner:'fixture.tools',ref:'skill:'+index,revision:'v1',kind:'skill',title:'Review skill '+index})).filter(item=>item.title.toLowerCase().includes(request.query.toLowerCase()))}),
    open:async (resource,scope)=>{window.fixtureResourceOpened={ref:resource.ref,revision:resource.revision,scope};return {status:'opened'}}});
}

if(${JSON.stringify(scenario)}==='metadata'){
  const byId={};
  for(let index=0;index<25;index++)byId['s'+index]={displayTitle:'Planning old '+index,updatedAt:'2025-01-01T00:00:00Z',running:false};
  byId.newest={displayTitle:'Planning newest',updatedAt:'2026-09-10T00:00:00Z',running:true};
  const listeners=new Set();
  conversationSearch=createSessionListConversationSearchHost({list:{getSnapshot:()=>({byId}),subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)}}});
  window.removeSearchMetadata=()=>{delete byId.newest;for(const listener of listeners)listener()};
}
if(${JSON.stringify(scenario)}==='scope'){
  let refs=['w1','w2'],revision='1';const listeners=new Set();
  workspaceContext={getSnapshot:()=>({workspaceRef:'w1',revision}),listWorkspaces:()=>refs.map(workspaceRef=>({workspaceRef,label:workspaceRef})),subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},search:async request=>({status:'ready',items:request.workspaceRefs.map(workspaceRef=>({workspaceRef,ref:'session:'+workspaceRef,source:'history',kind:'session',title:'Planning '+workspaceRef}))}),open:item=>{window.fixtureOpenedWorkspace=item.workspaceRef}};
  window.revokeSearchScope=()=>{refs=['w1'];revision='2';for(const listener of listeners)listener()};
}

let filesRuntime;
if(${JSON.stringify(scenario)}==='files'){
  window.fixtureFolderBodyReads=0;window.fixtureFolderRevealPaused=false;
  const ownerSignal=new AbortController();
  const node={ref:'dir:reports',name:'Reports',kind:'directory',version:'stat:1',hasChildren:false,sensitive:false,hidden:false,ignored:false,freshness:'fresh',availability:{inspect:{state:'disabled'},preview:{state:'disabled'},download:{state:'disabled'},mutate:{state:'disabled'}}};
  const projected={ref:node.ref,name:node.name,kind:'directory',version:node.version,hasChildren:false,capabilities:[],freshness:'fresh'};
  const page={workspaceRef:'workspace:fixture',generation:'g1',revision:'query:1',truncated:false,loaded:1,nodes:[node]};
  const reveal=async()=>({workspaceRef:page.workspaceRef,generation:page.generation,revision:'parent:1',breadcrumbs:[],target:node});
  const host={treeV2:{capability:'FileTreeProjectionCapabilityV2',roots:async()=>page,listChildren:async()=>page,search:async request=>({...page,nodes:'reports'.includes(request.query.toLowerCase())?[node]:[]}),reveal}};
  filesRuntime=createExplorerRuntimeSource();
  filesRuntime.bind({roots:async()=>[{ref:'file:original',name:'original.txt',kind:'file',version:'v1',hasChildren:false,capabilities:[],freshness:'fresh'}],listChildren:async()=>[],openResource:()=>{window.fixtureExecutions++;return {ok:false}},
    inspectMetadata:async input=>{window.fixtureFolderBodyReads++;return {ref:input.ref,version:input.version,state:'unsupported',label:input.name}},
    revealResource:async(ref,version,signal)=>{if(window.fixtureFolderRevealPaused)await new Promise(resolve=>{window.releaseFolderReveal=resolve});window.fixtureFolderRevealSettled=true;if(signal.aborted||ref!==node.ref||version!==node.version)return undefined;return {node:projected,breadcrumb:[{ref:'workspace:fixture',name:'Fixture project'}]}}});
  registerExplorerProvider(registry,filesRuntime);
  const source=createFileSearchSource({host,context:()=> 'fixture-owner',canOpen:false,open:async()=>false,openFolder:(node,pendingSignal)=>requestExplorerReveal(controller,filesRuntime,node.ref,node.version,ownerSignal.signal,pendingSignal)});
  searchSourcesFor(controller).register(source.source);
  window.cancelFolderOwner=()=>ownerSignal.abort();
  window.folderRevealActive=()=>filesRuntime.reveal.getSnapshot()!==undefined;
}
function FilesFixture(){
  const [showSearch,setShowSearch]=React.useState(true);
  const snapshot=React.useSyncExternalStore(controller.subscribeWorkspace,controller.getSnapshot,controller.getSnapshot);
  const view=Object.values(snapshot.views).find(view=>view.kind==='dsh.explorer');
  return React.createElement(React.Fragment,null,
    showSearch?React.createElement(WorkspaceSearchOverlay,{...searchProps,mode:'dialog',onClose:()=>setShowSearch(false)}):null,
    view?React.createElement(registry.get('dsh.explorer').component,{view,retry:()=>{}}):null);
}
let disposeToolsOwner;
if(['tools-owner','tools-reader'].includes(${JSON.stringify(scenario)})){
  window.fixtureEnableCalls=0;window.fixtureOwnerWrites=0;
  const owner=new ToolHubSidecar({table:{get:()=>({disabled:['skill:review'],version:'fixture:1',updatedAt:0}),put:async()=>{window.fixtureOwnerWrites++}},catalog:{collect:async()=>({skills:[{name:'review',description:'Review installed Skill metadata',source:${JSON.stringify(scenario)}==='tools-reader'?'user-agents':'fixture-provider',invocation:{modelInvocable:true}}],skillsComplete:true,tools:[{name:'read_file'},{name:'mcp__repo__read'}],pluginEntries:[],mcpHealth:[]})}});
  const remote={list:()=>owner.list(),setEnabled:input=>{window.fixtureEnableCalls++;return owner.setEnabled(input)}};
  const pane={controller,registerView:input=>registry.registerView(input),registerSearchSource:source=>searchSourcesFor(controller).register(source),openView:input=>controller.openView(input)};
  const sessionSnapshot={ids:[],byId:{}};
  const sessions={list:{getSnapshot:()=>sessionSnapshot,subscribe:()=>()=>{}}};
  const slots={inject:(_name,setup)=>setup(),register:()=>()=>{}};
  window.fixtureDocumentReads=0;window.fixtureDocumentDenied=false;
  const references={readSkill:async(input,signal)=>{
    window.fixtureDocumentReads++;
    if(input.scope!=='profile'||input.itemId!=='skill:review')throw new Error('unexpected fixture scope');
    if(window.fixtureDocumentDenied)return {ok:true,value:{specVersion:'1.0',status:'denied',reason:'permission_denied'}};
    return {ok:true,value:{specVersion:'1.0',mediaType:'text/markdown',status:input.cursor?'ready':'partial',resourceRef:'skill-document:'+'b'.repeat(64),revision:'a'.repeat(64),startLine:input.cursor?4:1,continuedLine:false,content:input.cursor?'Second section':'# Review guide\\n[External](https://example.invalid/)\\n<em>plain markup</em>',...(input.cursor?{}:{nextCursor:'page_two'})}};
  }};
  const ctx={locale:{register:()=>()=>{},bind:()=>key=>toolsOwnerEn[key]??key},get:key=>({paneWorkbench:pane,sessions,slots,remote:{toolHub:remote,...(${JSON.stringify(scenario)}==='tools-reader'?{toolReferences:references}:{})},'remote.toolHub':remote})[key],provide:()=>()=>{},on:()=>()=>{}};
  disposeToolsOwner=applyToolsOwner(ctx);
}
let canvasSource;
if(${JSON.stringify(scenario)}==='canvas'){
  const project={workspaceRef:'workspace:canvas',projectRef:'project:demo'};
  workspaceContext={getSnapshot:()=>({workspaceRef:'workspace:canvas',revision:'1'}),listWorkspaces:()=>[{workspaceRef:'workspace:canvas',label:'Canvas project'}]};
  const service={snapshot:async()=>({context:project}),canvasRead:async()=>({revision:3,document:{schema:'dsh.project-canvas.v1alpha1',id:'main',revision:3,nodes:[{id:'node:brief',title:'Launch brief',kind:'text'},{id:'node:shot',title:'Storyboard shot',kind:'image'}],edges:[],camera:{x:0,y:0,zoom:1}}})};
  canvasSource=createProjectCanvasSearchSource({service,open:request=>{window.canvasOpened=request;controller.openView(request)}});
  searchSourcesFor(controller).register(canvasSource.source);
  window.canvasProjectChanged=()=>{service.snapshot=async()=>({context:{workspaceRef:'workspace:other',projectRef:'project:other'}});canvasSource.notify()};
}
const searchProps={registry,controller,commands,conversationSearch,workspaceContext};
function ToolsOwnerFixture(){
  const state=React.useSyncExternalStore(controller.subscribeWorkspace,controller.getSnapshot,controller.getSnapshot);
  const view=Object.values(state.views).find(view=>view.kind==='tools-manager');
  return React.createElement('div',{style:{display:'grid',gridTemplateColumns:view?'minmax(0,1fr) 360px':'minmax(0,1fr)',height:'100%'}},
    React.createElement(WorkspaceSearchOverlay,{...searchProps,mode:'pane'}),
    view?React.createElement(registry.get('tools-manager').component,{view}):null);
}
function HandoffFixture(){
  const [dialog,setDialog]=React.useState(true);
  const snapshot=React.useSyncExternalStore(controller.subscribeWorkspace,controller.getSnapshot,controller.getSnapshot);
  const hasPane=Object.values(snapshot.views).some(view=>view.kind==='dsh.workspace-search');
  return React.createElement(React.Fragment,null,
    hasPane&&${JSON.stringify(scenario)}!=='handoff-missing'?React.createElement(WorkspaceSearchOverlay,{...searchProps,key:'pane',mode:'pane'}):null,
    dialog?React.createElement(WorkspaceSearchOverlay,{...searchProps,key:'dialog',mode:'dialog',onClose:()=>setDialog(false),restoreFocus:()=>{window.fixtureRestoredFocus=true}}):null);
}
if(['handoff','handoff-missing'].includes(${JSON.stringify(scenario)}))registry.registerView({descriptor:{kind:'dsh.workspace-search',label:'Search',componentKey:'search',role:'utility',preferredRegion:'right',retention:'recreate',singleton:true},component:()=>null});
ReactDOMClient.createRoot(document.getElementById('fixture')).render(${JSON.stringify(scenario)}==='files'?React.createElement(FilesFixture):['tools-owner','tools-reader'].includes(${JSON.stringify(scenario)})?React.createElement(ToolsOwnerFixture):['handoff','handoff-missing'].includes(${JSON.stringify(scenario)})?React.createElement(HandoffFixture):React.createElement(WorkspaceSearchOverlay,{...searchProps,mode:${JSON.stringify(mode)}}));
</script></body></html>`
}
