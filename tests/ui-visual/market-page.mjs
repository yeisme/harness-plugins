/** Real client bundle with an explicitly synthetic, already-projected market host. */
export function marketPage(params) {
  const width = [360, 560, 960].includes(Number(params.get('width'))) ? Number(params.get('width')) : 560
  const locale = ['zh', 'en', 'pseudo'].includes(params.get('lang')) ? params.get('lang') : 'zh'
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}#market{width:${width}px;max-width:100%}</style></head><body>
<main id="market" aria-label="Synthetic market fixture"></main>
<script>window.__ModuleLoader__={load(entry){window.marketEntry=entry}}</script>
<script src="/vendor/react.global.js"></script><script src="/vendor/scheduler.global.js"></script><script src="/vendor/react-dom.global.js"></script><script src="/vendor/react-jsx-runtime.global.js"></script><script src="/market-client.js"></script>
<script type="module">
import * as primitives from '/vendor/fixture-primitives.mjs';
const api=window.marketEntry.factory(name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return ReactJsxRuntime;if(name==='@deepseek-ai/dsh-client-ui-primitives')return primitives;throw new Error('Unexpected market fixture dependency')});
const signal={schema:'dsh.radar.market-signal.v1',signalRef:'signal-a',revision:2,policyRevision:'sha256:policy',title:'测试样本：跨市场长标题与证据限制展示，不代表真实平台趋势判断或商业收益预测',market:'unknown',observedAt:'2026-09-11T08:00:00.000Z',claimKind:'correction',sourceRef:'hongguo',origin:'fixture',assertionLevel:'observed',comparison:null,lifecycle:'retracted',evidenceRefs:['evidence-a'],limitations:['Synthetic sample only.']};
const signalTwo={...signal,signalRef:'signal-b',title:'第二个对照测试信号',market:'US',sourceRef:'reelshort',lifecycle:'active'};
const brief={schema:'dsh.radar.market-brief.v1',briefRef:'brief-a',digest:'sha256:brief',policyRevision:'sha256:policy',generatedAt:'2026-09-11T09:00:00.000Z',timezone:'Asia/Shanghai',window:{start:'2026-09-10T00:00:00.000Z',end:'2026-09-11T00:00:00.000Z'},status:'degraded',main:[signal,signalTwo],watching:[],remaining:0,filtered:false,correctionCount:1,limitations:['Synthetic fixture'],coverage:[{sourceRef:'hongguo',health:'unavailable',qualified:false,reasons:['identity_evidence_missing']}]};
const fixture=window.marketFixture={reads:0,contextListeners:[],policyListeners:[]};
const host={schema:'dsh.radar.market-host.v1',locale:${JSON.stringify(locale)},contextRef:()=> 'session-a',load:async()=>{fixture.reads++;return {ok:true,brief,reader:{schema:'dsh.radar.market-reader.v1',readerRef:'local',revision:1,policyRevision:'sha256:policy'}}},subscribeContext:fn=>{fixture.contextListeners.push(fn);return()=>{}},subscribePolicy:fn=>{fixture.policyListeners.push(fn);return()=>{}}};
fixture.catchupCursors=[];
fixture.detailSelections=[];host.loadSignal=async(_context,selection)=>{fixture.detailSelections.push(selection);return {ok:true,signal,reader:{schema:'dsh.radar.market-reader.v1',readerRef:'local',revision:1,policyRevision:'sha256:policy'}}};
fixture.compareSelections=[];host.loadCompare=async(_context,left,right)=>{fixture.compareSelections.push({left,right});return {ok:true,compare:{schema:'dsh.radar.market-compare.v1',policyRevision:'sha256:policy',sides:[{signalRef:left.signalRef,signalRevision:left.revision,subjectRef:'work-left',title:'跨市场左侧',market:'unknown',lifecycle:'active',identity:{status:'candidate',canonicalRef:null},observations:[]},{signalRef:right.signalRef,signalRevision:right.revision,subjectRef:'work-right',title:'跨市场右侧',market:'US',lifecycle:'active',identity:{status:'candidate',canonicalRef:null},observations:[]}],identityRelation:'not_established',presentation:'side_by_side',sharedNumericAxis:false,causalInference:false,limitations:['Different source scopes.']},reader:{schema:'dsh.radar.market-reader.v1',readerRef:'local',revision:1,policyRevision:'sha256:policy'}}};
host.loadCatchup=async(_context,cursor)=>{fixture.catchupCursors.push(cursor);return {ok:true,reader:{schema:'dsh.radar.market-reader.v1',readerRef:'local',revision:1,policyRevision:'sha256:policy'},page:{schema:'dsh.radar.market-catchup.v1',readerRevision:1,policyRevision:'sha256:policy',window:brief.window,signals:cursor===null?[]:[{...signal,signalRef:'signal-page-two',title:'第二页未读测试信号'}],nextCursor:cursor===null?'page_two':null,historyLimited:true,limitations:[]}}};
let component;const services={radarMarketHost:host,paneWorkbench:{registerView:input=>{component=input.component;return()=>{}},openView:()=>{},registerCommand:()=>()=>{}}};
await api.apply({get:name=>services[name],provide:(name,value)=>{services[name]=value;return()=>{delete services[name]}}});
ReactDOM.createRoot(document.getElementById('market')).render(React.createElement(component));
</script></body></html>`
}
