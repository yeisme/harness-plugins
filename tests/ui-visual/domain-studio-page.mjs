import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
export function domainStudioPage(importMap, params) {
  const width = [360, 560, 960, 1440].includes(Number(params.get('width'))) ? Number(params.get('width')) : 960
  const owner = params.get('owner') === 'scaena' ? 'scaena' : 'eikona'
  const digest = createHash('sha256').update(readFileSync(new URL('../../../../cli/eikona/prompts/generic/precision-candid/french-vintage-editorial/french-vintage-editorial.png', import.meta.url))).digest('hex')
  const lang = params.get('lang') === 'en' ? 'en' : 'zh'
  return `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${JSON.stringify(importMap)}</script>
  <style>body{margin:0;background:#171719;color:#eee;font:13px Arial}#fixture{width:${width}px;max-width:100%;min-height:700px}.fixture-note{padding:8px 16px;opacity:.65}</style></head>
  <body><p class="fixture-note">UI fixture · existing editorial image · no generation or production execution</p><main id="fixture"></main>
  <script src="/vendor/react.global.js"></script><script src="/vendor/scheduler.global.js"></script><script src="/vendor/react-dom.global.js"></script><script src="/vendor/react-jsx-runtime.global.js"></script>
  <script type="module">
  import { DomainStudioView, CreatorStudioController, creatorSnapshot, createCreatorStudioTranslator } from '/vendor/native-menu.mjs';
  const h=React.createElement, owner=${JSON.stringify(owner)}, t=createCreatorStudioTranslator(${JSON.stringify(lang)});
  const base=creatorSnapshot(), digest=${JSON.stringify(digest)}, ref='eikona://artifacts/run_editorial/cover';
  const source=base.owners.find(item=>item.owner===owner);
  const projection={...source,actions:[],artifactWorkspace:undefined,resources:owner==='eikona'?[
    {ref:'eikona:local:preparation',version:'1',kind:'preparation-capability',title:'Local preparation',status:'available',evidenceRefs:[]},
    {ref:'eikona:local:approval',version:'1',kind:'approval-capability',title:'Local approval',status:'available',evidenceRefs:[]}
  ]:[{ref:'shot:opening',version:'1',kind:'shot',title:'01 · Opening / 封面镜头',status:'review_required',evidenceRefs:[],artifact:{schema:'pane.artifact.v1alpha1',owner:'scaena',kind:'image',ref:'artifact:cover',version:'1',mediaType:'image/png',title:'Editorial cover',evidenceRefs:[],capabilities:['preview']}}]};
  window.studioDispatches=0;window.studioMediaReads=0;
  const remote={snapshot:async()=>({ok:true,value:base}),snapshotOwner:async()=>({ok:true,value:{...base,owners:[projection]}}),
    listOperationRecoveries:async()=>({ok:true,value:{schemaVersion:'creator.operation-recovery-page.v1alpha1',status:'ready',context:base.context,operations:[]}}),
    readEikonaDraft:async input=>({ok:true,value:{status:'missing'}}),
    dispatch:async()=>{window.studioDispatches++;return {ok:true,value:{status:'rejected',receiptRef:'fixture:disabled'}}},
    readEikonaAssetPage:async()=>({ok:true,value:{status:'ready',items:[{ref,title:'Élégance · Editorial cover',versionStatus:'observed_digest',contentDigest:digest,mediaType:'image/png'}]}}),
    readEikonaCandidateImage:async()=>{window.studioMediaReads++;const bytes=new Uint8Array(await (await fetch('/domain-studio-image')).arrayBuffer());let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);return {ok:true,value:{status:'ready',value:{artifactRef:ref,contentDigest:digest,byteLength:bytes.length,mediaType:'image/png',base64:btoa(raw)}}}},
    resolveArtifact:async()=>({ok:true,value:{url:location.origin+'/domain-studio-image',expiresAt:new Date(Date.now()+60000).toISOString()}})};
  const controller=new CreatorStudioController(remote,owner);await controller.refresh();
  ReactDOM.createRoot(document.getElementById('fixture')).render(h(DomainStudioView,{owner,mode:owner==='eikona'?'visual':'production',controller,pane:{openView(){}},onOpenMode(){},t}));
  </script></body></html>`
}
