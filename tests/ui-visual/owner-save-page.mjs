/** Real editor fixture. The test process injects a scoped actual-owner Host bridge. */
export function ownerSavePage(importMap) {
  return `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${JSON.stringify(importMap)}</script>
<style>body{margin:0;background:#171719;color:#eee;font:13px Arial}#fixture{width:100%;max-width:100%;min-height:500px}</style></head>
<body><p>Fixture: real editor and Auctra owner; disposable project and test identity.</p><main id="fixture"></main>
<script src="/vendor/react.global.js"></script><script src="/vendor/scheduler.global.js"></script><script src="/vendor/react-dom.global.js"></script><script src="/vendor/react-jsx-runtime.global.js"></script>
<script type="module">
import { CreatorArtifactWorkspace, creatorStudioStyles, createCreatorStudioTranslator } from '/vendor/native-menu.mjs';
import { Surface } from '/vendor/ui-surface.mjs';
const h=React.createElement,t=createCreatorStudioTranslator(new URL(location.href).searchParams.get('locale')==='en'?'en':'zh');
if(typeof window.ownerSnapshot!=='function') throw Error('Scoped owner test bridge unavailable');
const initial=await window.ownerSnapshot(false);
window.ownerBodyReads=[];window.ownerDirty=false;let receiptChanged=()=>{};
const recoveryRuntime=typeof window.ownerDraftSave==='function'?{saveAuctraRecoveryDraft:input=>window.ownerDraftSave(input),listAuctraRecoveryDrafts:input=>window.ownerDraftList(input),readAuctraRecoveryDraft:input=>window.ownerDraftRead(input)}:{};
const runtime={...recoveryRuntime,resolveArtifact:async()=>undefined,listOperationRecoveries:()=>window.ownerRecoveries(),reconcileStoredOperation:async request=>{const receipt=await window.ownerStoredReconcile(request);window.ownerLastReceipt=receipt;receiptChanged(receipt);return receipt},readCandidatePage:query=>window.ownerCandidatePage(query),readArtifactContent:async artifact=>{
 const value=await window.ownerRead(artifact);if(value)window.ownerBodyReads.push(value.contentRevision);return value??undefined;
},dispatchAction:async(descriptor,values)=>{const receipt=await window.ownerDispatch(descriptor,values);window.ownerLastReceipt=receipt;receiptChanged(receipt);return receipt},reconcileAction:async descriptor=>{const receipt=await window.ownerReconcile(descriptor);window.ownerLastReceipt=receipt;receiptChanged(receipt);return receipt}};
function Fixture(){const [snapshot,setSnapshot]=React.useState(initial);const [lastReceipt,setLastReceipt]=React.useState(null);receiptChanged=setLastReceipt;window.refreshOwnerView=async()=>setSnapshot(await window.ownerSnapshot(true));
 const owner=snapshot.owners.find(item=>item.owner==='auctra');
 return h(Surface,{kind:'workspace','data-creator-studio':true},h('style',null,creatorStudioStyles),h(CreatorArtifactWorkspace,{owner,snapshot,
 state:{phase:'ready',snapshot,pendingDescriptorRef:null,lastReceipt},runtime,t,onDirty:value=>{window.ownerDirty=value}}));}
ReactDOM.createRoot(document.getElementById('fixture')).render(h(Fixture));
</script></body></html>`
}
