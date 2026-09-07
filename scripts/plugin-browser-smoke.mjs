import assert from 'node:assert/strict'
import {readFile, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import {discoverWorkspacePackages, workspaceBundles} from './dsh-dev.mjs'

/** Observe the real loader without replacing any module factory or plugin behavior. */
export async function installModuleProbe(page) {
  await page.addInitScript(() => {
    let loader
    Object.defineProperty(window,'__ModuleLoader__', {configurable:true,get:()=>loader,set(value){
      loader=value
      const create=value.create
      value.create=function(...args){const system=create.apply(this,args);window.__toolsModuleProbe=()=>[...system.loadCache.keys()];return system}
    }})
  })
}

export async function verifyPluginInventory(page, directory) {
  const root=resolve(import.meta.dirname,'..')
  const bundles=workspaceBundles(await discoverWorkspacePackages(root))
  const profile=JSON.parse(await readFile(resolve(process.env.DSH_HOME??resolve(homedir(),'.dsh'),'profiles/web/package.json'),'utf8'))
  const base=new URL(page.url())
  const response=await page.request.post(new URL('/api/pluginInventory/list',base.origin).href,{headers:{origin:base.origin},data:{type:'client-request',rpcId:randomUUID(),method:'pluginInventory/list',payload:{args:{}}}})
  assert.equal(response.status(),200,'Plugin inventory RPC must be available')
  let inventory=await response.json()
  if(inventory.result)inventory=inventory.result
  while(inventory?.ok===true&&inventory.value!==undefined)inventory=inventory.value
  assert(Array.isArray(inventory.entries),'Plugin inventory must contain authoritative Loader entries')
  const modules=await page.evaluate(()=>window.__toolsModuleProbe?.()??[])
  assert(modules.length>0,'Real module materialization must be observed')
  const results=[]
  for(const bundle of bundles){
    const patch=await readFile(resolve(bundle.dir,bundle.manifest.dsh.bundle.patch),'utf8')
    const expected=[...new Set([...patch.matchAll(/^\s*name:\s*['"]?(@[a-zA-Z0-9_./-]+)/gm)].map(match=>match[1]))]
    const entries=expected.map(name=>{
      const rows=inventory.entries.filter(row=>row.moduleName===name)
      const presetRows=(inventory.agentPresets??[]).flatMap(preset=>preset.rows??[]).filter(row=>row.moduleName===name)
      return {name,rootActive:rows.some(row=>row.enabled&&row.fiberPhase==='active'),presetScoped:rows.length===0&&presetRows.length>0,phases:[...new Set(rows.map(row=>row.fiberPhase))]}
    })
    const materialized=modules.filter(id=>id===bundle.name||id.startsWith(bundle.name+'/'))
    const installed=typeof profile.dependencies?.[bundle.name]==='string'
    const hostReady=entries.length>0&&entries.every(entry=>entry.rootActive||entry.presetScoped)
    const clientDeclared=!!bundle.manifest.dsh?.client
    const status=installed&&hostReady&&(!clientDeclared||materialized.length>0)?'passed':'failed'
    results.push({package:bundle.name,status,installed,entries,client:clientDeclared?{materialized}:{notApplicable:'No independent client entry declared'},coverage:'Loader entries and browser module materialization; domain business actions are not executed'})
  }
  const summary={discovered:bundles.length,passed:results.filter(row=>row.status==='passed').length,results,redacted:true}
  await writeFile(new URL('artifacts/plugin-smoke.json',directory),JSON.stringify(summary,null,2))
  assert.equal(summary.passed,summary.discovered,'Every discovered local bundle must pass entry smoke')
  return `All ${bundles.length} local bundles pass installation, Loader-entry and applicable client-module smoke`
}
