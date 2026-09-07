import {mkdir, mkdtemp, rm, writeFile, readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {afterEach, describe, expect, it} from 'vitest'
import {Context} from '@deepseek-ai/cordis'
import {apply} from '../src/plugin.ts'
import {vi} from 'vitest'

// Reuse the preview's real Loader, include parser and persistent domain implementation.
const staging=resolve(import.meta.dirname,'../../../../temp/dsh-unified-host-source')
const fromHost=async(path:string)=>(await import(pathToFileURL(join(staging,path)).href)).default
let directory:string|undefined,root:Context|undefined

afterEach(async()=>{await root?.fiber.dispose();root=undefined;if(directory)await rm(directory,{recursive:true,force:true});directory=undefined})

describe('Tools real Loader composition',()=>{
  it('loads a generated cordis.yml, dispatches real gateway calls and preserves CAS failure semantics',async()=>{
    directory=await mkdtemp(join(tmpdir(),'tools-composition-'))
    const Loader=await fromHost('vendor/loader/lib/index.js'),Include=await fromHost('vendor/include/lib/index.js')
    const Registry=await fromHost('packages/typert/registry/lib/index.js'),Gateway=await fromHost('packages/api/gateway/lib/index.js')
    const storageModule=await import(pathToFileURL(join(staging,'packages/storage/storage/lib/index.js')).href)
    const domainModule=await import(pathToFileURL(join(staging,'packages/storage/storage-domain/lib/index.js')).href)
    const jsonModule=await import(pathToFileURL(join(staging,'packages/storage/storage-json/lib/index.js')).href)
    let dispatch:((endpoint:string,payload:unknown,signal:AbortSignal)=>Promise<any>)|undefined
    const provider={name:'tools-test-dependencies',apply(ctx:Context){
      ctx.effect(()=>ctx.provide('tools' as never,{schemas:()=>[{name:'read',description:'Fixture read'}],guard:()=>()=>{}} as never))
      ctx.effect(()=>ctx.provide('skills' as never,{snapshot:async()=>({skills:[],complete:true})} as never))
      ctx.effect(()=>ctx.provide('pluginInventory' as never,{list:async()=>({entries:[]})} as never))
      ctx.effect(()=>ctx.provide('connection' as never,{rpc:{intercept:(_prefix:string,_claims:unknown,handler:typeof dispatch)=>{dispatch=handler;return ()=>{dispatch=undefined}}}} as never))
    }}
    const modules:Record<string,unknown>={'fixture-storage':storageModule.default,'fixture-json':{...jsonModule,Config:undefined,apply:(ctx:Context)=>jsonModule.apply(ctx,{root:join(directory!,'storage')})},'fixture-domain':{...domainModule,Config:undefined,apply:(ctx:Context)=>domainModule.apply(ctx,{backend:'json',routes:{}})},'fixture-dependencies':provider,'fixture-registry':Registry,'fixture-gateway':Gateway,'fixture-tools':{name:'fixture-tools',inject:['typert','storageDomain'],apply}}
    await writeFile(join(directory,'cordis.yml'),Object.keys(modules).map(name=>`- name: '${name}'`).join('\n'))
    root=new Context();root.baseUrl=pathToFileURL(directory).href+'/'
    await root.plugin(Loader)
    const loader=(root as any).loader
    loader.builtins.include=Include
    loader.internal={version:'v2',import:async(name:string)=>{if(!(name in modules))throw new Error('Unexpected fixture module');return modules[name]}}
    await loader.create({name:'cordis:include',config:{path:pathToFileURL(join(directory,'cordis.yml')).href}});await loader.await()
    const call=async(method:string,input?:unknown)=>{expect(dispatch).toBeTypeOf('function');return dispatch!(`toolHub/${method}`,{args:input===undefined?{}:{input}},new AbortController().signal)}
    const listed=await call('list');expect(listed).toMatchObject({ok:true,value:{ok:true,complete:true,items:[{id:'tool:read'}]}})
    const disabled=await call('setEnabled',{id:'tool:read',enabled:false,ifGeneration:1});expect(disabled).toMatchObject({ok:true,value:{ok:true,enabled:false}})
    expect(await readFile(join(directory,'storage/yeisme_tool_hub_v1.json'),'utf8')).toContain('tool:read')
    expect(await call('setEnabled',{id:'tool:read',enabled:true,ifGeneration:1})).toMatchObject({ok:true,value:{ok:false,code:'generation-conflict'}})
    const domain=(root as any).storageDomain.get('yeisme_tool_hub_v1')
    const failWrite=vi.spyOn(domain.table('prefs'),'put').mockRejectedValueOnce(new Error('private-storage-failure'))
    const failure=await call('setEnabled',{id:'tool:read',enabled:true,ifGeneration:2})
    expect(failure).toMatchObject({ok:true,value:{ok:false,code:'storage-unavailable'}});expect(JSON.stringify(failure)).not.toContain('private-storage-failure')
    expect(await call('list')).toMatchObject({ok:true,value:{items:[{enabled:false}]}})
    failWrite.mockRestore()
  },30000)
})
