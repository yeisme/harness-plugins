import { expect,it,vi } from 'vitest'
import { CreatorInputIntake, type InputControl } from '../src/input-intake.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef:'tenant',workspaceRef:'workspace',projectRef:'project:dsh',sessionRef:'session',principalRef:'principal',revision:'1',membershipRevision:'1',installationRef:'installation',pluginDigest:'digest',policyRevision:'1',runtimeGeneration:'1' }
const id='inp_'+'a'.repeat(32),secret='b'.repeat(64),base='http://127.0.0.1:12345'
function fixture(){
 let view:any={schema_version:'yeisme.input_intake.v1',input_request_id:id,project:'owner-project',purpose:'reference',state:'awaiting_file',expires_at:'2026-09-10T12:00:00Z',max_bytes:100,mime_types:['image/png']}
 const calls:string[]=[],data:Uint8Array[]=[]
 const control:InputControl={call:vi.fn(async operation=>({request:view,links:operation==='prepare'||operation==='renew'?[{uri:base+'/input-requests/'+id+'#grant='+secret},{uri:base+'/input-requests/'+id+'#page='+secret}]:[]}))}
 const fetcher=vi.fn<typeof fetch>(async(url,options)=>{
  expect(options?.redirect).toBe('error');expect(options?.credentials).toBe('omit');expect(new Headers(options?.headers).get('Authorization')).toBeNull()
  expect(new Headers(options?.headers).get('X-Input-Grant')).toBe(secret)
  const operation=String(url).split('/').at(-1)!;calls.push(operation)
  if(operation==='file')view={...view,state:'prepared',file:JSON.parse(String(options?.body))}
  if(operation==='content'){for await(const chunk of options?.body as unknown as AsyncIterable<Uint8Array>)data.push(chunk);view={...view,state:'transferred'}}
  if(operation==='complete')view={...view,state:'ready',receipt:{ref:'eikona://asset/fixture',sha256:'c'.repeat(64),size:3,domain_state:'unreviewed'}}
  return Response.json(view)
 })
 return {control,fetcher,calls,data}
}
it('selects and streams one file, returns safe progress and resumes without another generation or upload',async()=>{
 const f=fixture(),close=vi.fn(async()=>{}),chooseFile=vi.fn(async()=>({name:'ref.png',mime:'image/png',size:3,async *read(){yield new Uint8Array([1]);yield new Uint8Array([2,3])},close}))
 const host=new CreatorInputIntake(base,'owner-project',f.control,{chooseFile},f.fetcher)
 const prepared=await host.run({owner:'eikona',operation:'prepare',purpose:'reference',idempotencyKey:'original'},context)
 expect(JSON.stringify(prepared)).not.toContain(secret)
 const ready=await host.run({owner:'eikona',operation:'choose',inputRequestId:id},context)
 expect(ready).toMatchObject({status:'available',progressBytes:3,transferring:false,request:{state:'ready'}});expect(close).toHaveBeenCalledOnce()
 await host.run({owner:'eikona',operation:'choose',inputRequestId:id},context)
 expect(chooseFile).toHaveBeenCalledOnce();expect(f.calls).toEqual(['file','content','complete'])
 host.dispose()
 expect((await host.run({owner:"eikona",operation:"recover",inputRequestId:id},context)).status).toBe("unavailable")
})
it('supports a one-time external page without exposing its credential, and isolates session selections',async()=>{
 const f=fixture(),openPage=vi.fn(async()=>{}),host=new CreatorInputIntake(base,'owner-project',f.control,{openPage},f.fetcher)
 await host.run({owner:'eikona',operation:'prepare',purpose:'reference',idempotencyKey:'original'},context)
 const other=await host.run({owner:'eikona',operation:'manual',inputRequestId:id},{...context,sessionRef:'other'})
 expect(other.status).toBe('needs_renewal');expect(openPage).not.toHaveBeenCalled()
 const value=await host.run({owner:'eikona',operation:'manual',inputRequestId:id},context)
 expect(openPage).toHaveBeenCalledOnce();expect(JSON.stringify(value)).not.toContain(secret)
 expect((await host.run({owner:'eikona',operation:'manual',inputRequestId:id},context)).status).toBe('needs_renewal')
})
it('fails closed on foreign links and unavailable host file-selection seams',async()=>{
 const f=fixture(),host=new CreatorInputIntake(base,'owner-project',f.control,{},f.fetcher)
 await host.run({owner:'eikona',operation:'prepare',purpose:'reference',idempotencyKey:'original'},context)
 expect((await host.run({owner:'eikona',operation:'choose',inputRequestId:id},context)).status).toBe('unavailable')
 const bad:InputControl={call:async()=>({request:{schema_version:'yeisme.input_intake.v1',input_request_id:id,project:'foreign'},links:[{uri:'https://foreign.example/#grant='+secret}]})}
 expect((await new CreatorInputIntake(base,'owner-project',bad,{}).run({owner:'eikona',operation:'prepare',purpose:'reference',idempotencyKey:'original'},context)).status).toBe('unconfirmed')
})
