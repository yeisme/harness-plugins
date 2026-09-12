import { Readable } from 'node:stream'
import type { CreatorStudioContextV1 } from './types.ts'

import { inputViewSchema, fileSchema, type View, type InputQuery } from "./input-contract.ts"
/** The owner adapter resolves names and schemas from its MCP registry. */
export interface InputControl {
 call(operation: 'prepare'|'status'|'renew'|'abort', input: Record<string,unknown>, context: CreatorStudioContextV1): Promise<{ request: unknown; links?: readonly { uri: string }[] }>
}
export interface SelectedInputFile {
 name: string; mime: string; size: number
 read(): AsyncIterable<Uint8Array>
 close(): Promise<void>
}
export interface InputHostSeams {
 chooseFile?(limits: { maxBytes: number; mimeTypes: readonly string[] }): Promise<SelectedInputFile | undefined>
 openPage?(url: string): Promise<void>
}
type Entry = { view: View; grant?: string; page?: string; progress: number; busy: boolean; abort?: AbortController }
const keyOf = (context: CreatorStudioContextV1, id: string) => JSON.stringify([context,id])

/** Ephemeral transport state only. URLs and file handles never cross the Remote boundary. */
export class CreatorInputIntake {
 private readonly entries = new Map<string,Entry>()
 private disposed=false
 constructor(private readonly baseURL: string, private readonly project: string, private readonly control: InputControl, private readonly host: InputHostSeams, private readonly fetcher: typeof fetch = fetch) {}
 private safe(entry: Entry) { return { status:'available' as const, request:entry.view, progressBytes:entry.progress, transferring:entry.busy, canChoose:!!this.host.chooseFile, canOpenPage:!!this.host.openPage } }
 private accept(result: {request:unknown; links?:readonly {uri:string}[]}, context: CreatorStudioContextV1, expected?:string) {
  if(this.disposed)throw new Error("Input adapter disposed")
  const view=inputViewSchema.parse(result.request)
  if(view.project!==this.project || (expected!==undefined&&view.input_request_id!==expected)) throw new Error('Input scope mismatch')
  const key=keyOf(context,view.input_request_id),existing=this.entries.get(key)
  const entry:Entry=existing??{view,progress:0,busy:false};entry.view=view
  for(const link of result.links??[]) {
   const parsed=new URL(link.uri),target=this.baseURL.replace(/\/$/,'')+'/input-requests/'+view.input_request_id
   if(parsed.origin!==new URL(this.baseURL).origin||parsed.username||parsed.password||parsed.search||parsed.href.split('#')[0]!==target)throw new Error('Invalid owner input link')
   if(/^#grant=[a-f0-9]{64}$/.test(parsed.hash))entry.grant=parsed.hash.slice(7)
   else if(/^#page=[a-f0-9]{64}$/.test(parsed.hash))entry.page=parsed.href
   else throw new Error('Invalid owner input link')
  }
  this.entries.set(key,entry)
  while(this.entries.size>64){const idle=[...this.entries].find(([,v])=>!v.busy&&v!==entry);if(!idle)throw new Error('Input transport capacity reached');this.entries.delete(idle[0])}
  return entry
 }
 async run(query:InputQuery,context:CreatorStudioContextV1):Promise<ReturnType<CreatorInputIntake['safe']>|{status:'unavailable'|'unconfirmed'|'invalid_input'|'needs_renewal'}> {
  if(this.disposed)return {status:"unavailable"}
  try {
   if(query.operation==='prepare') {
    if(!query.purpose||!query.idempotencyKey)return {status:'invalid_input'}
    return this.safe(this.accept(await this.control.call('prepare',{purpose:query.purpose,idempotency_key:query.idempotencyKey},context),context))
   }
   if(!query.inputRequestId)return {status:'invalid_input'}
   const id=query.inputRequestId,key=keyOf(context,id)
   if(query.operation==='cancel')this.entries.get(key)?.abort?.abort()
   const operation=query.operation==='renew'?'renew':query.operation==='cancel'?'abort':'status'
   const entry=this.accept(await this.control.call(operation,{input_request_id:id},context),context,id)
   if(query.operation==='recover'||query.operation==='renew'||query.operation==='cancel'||entry.view.state==='ready')return this.safe(entry)
   if(query.operation==='manual') {
    if(!this.host.openPage)return {status:'unavailable'}
    if(!entry.page)return {status:'needs_renewal'}
    const page=entry.page;delete entry.page;await this.host.openPage(page);return this.safe(entry)
   }
   if(entry.busy)return this.safe(entry)
   if(!this.host.chooseFile)return {status:'unavailable'}
   if(!entry.grant)return {status:'needs_renewal'}
   entry.busy=true
   let file:SelectedInputFile|undefined
   const abort=new AbortController();entry.abort=abort
   try {
    file=await this.host.chooseFile({maxBytes:entry.view.max_bytes,mimeTypes:entry.view.mime_types})
    if(!file){entry.busy=false;return this.safe(entry)}
    const metadata=fileSchema.parse({name:file.name,mime:file.mime,size:file.size})
    if(file.size>entry.view.max_bytes||!entry.view.mime_types.includes(file.mime)||/[\\/\x00\r\n]/.test(file.name))return {status:'invalid_input'}
    const target=this.baseURL.replace(/\/$/,'')+'/input-requests/'+id
    const call=async(operation:string,body:unknown,length?:number)=>{
     const headers:Record<string,string>={'X-Input-Grant':entry.grant!,'Content-Type':length===undefined?'application/json':'application/octet-stream'}
     if(length!==undefined)headers['Content-Length']=String(length)
     const response=await this.fetcher(target+'/'+operation,{method:operation==='content'?'PUT':'POST',headers,redirect:'error',credentials:'omit',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(300000)]),body:body as RequestInit["body"],duplex:'half'} as RequestInit)
     if(!response.ok)throw new Error('Input transfer rejected')
     const parts:Uint8Array[]=[];let total=0
     for await(const part of response.body??[]) {total+=part.byteLength;if(total>65536)throw new Error('Input response exceeds limit');parts.push(part)}
     entry.view=this.accept({request:JSON.parse(Buffer.concat(parts,total).toString('utf8'))},context,id).view
    }
    await call('file',JSON.stringify(metadata))
    const state=entry.view.resume_state??entry.view.state
    if(state!=='transferred'&&state!=='verifying') {
     const selected=file;entry.progress=0
     async function* chunks(){for await(const chunk of selected.read()){entry.progress+=chunk.byteLength;if(entry.progress>selected.size)throw new Error('Input size changed');yield chunk}if(entry.progress!==selected.size)throw new Error('Input size changed')}
     await call('content',Readable.from(chunks()),file.size)
    }
    await call('complete','{}');entry.busy=false;return this.safe(entry)
   }finally{entry.busy=false;delete entry.abort;await file?.close()}
  }catch{return {status:'unconfirmed'}}
 }
 dispose(){this.disposed=true;for(const value of this.entries.values())value.abort?.abort();this.entries.clear()}
}
