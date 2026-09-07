import { describe, expect, it } from 'vitest'
import { toolHubRemoteContribution } from '../src/client/remote-contribution.ts'
import { normalizeToolHubClientError } from '../src/client/remote.ts'

const listCodec = toolHubRemoteContribution.descriptors.find(descriptor => descriptor.method === 'list')?.result.schema

function catalog() {
  return {
    ok: true,
    specVersion: '1.0',
    complete: true,
    generation: 1,
    skillsAvailable: false,
    toolsAvailable: true,
    mcpInventoryAvailable: false,
    items: [],
  }
}

describe('toolHub list additive codec', () => {
  it('accepts old and additive responses without changing the v1 descriptor', () => {
    expect(listCodec?.parse(catalog())).toMatchObject({ specVersion: '1.0' })
    expect(listCodec?.parse({
      ...catalog(),
      observedAt: 10,
      healthAvailable: true,
      items: [{
        id: 'mcp:github', family: 'mcp', origin: 'mcp', name: 'github', label: 'mcp__github', description: '', source: 'mcp-client',
        availability: 'available', enabled: true, canToggle: true, reasonCode: 'disabled_by_user', health: { state: 'connected', observedAt: 10 },
      }],
    })).toMatchObject({ healthAvailable: true })
    expect(toolHubRemoteContribution.descriptors.find(descriptor => descriptor.method === 'list')?.id).toContain('toolHub.list@1')
  })

  it('rejects malformed optional health', () => {
    expect(() => listCodec?.parse({ ...catalog(), items: [{ health: { state: 'healthy', observedAt: 10 } }] })).toThrow(/health/)
  })
})

describe('toolHub error normalization', () => {
  it('maps 404 and drops raw details', () => {
    const error = normalizeToolHubClientError({ code: 'internal', message: 'client api failed: HTTP 404', details: { token: 'secret' } })
    expect(error.code).toBe('endpoint_not_found')
    expect(error.message).toBe('endpoint_not_found')
    expect(JSON.stringify(error)).not.toMatch(/secret|HTTP 404/)
  })
})

import { resolveToolHubRemote } from '../src/client/remote.ts'

describe('real remote envelope and recovery', () => {
  it('unwraps an already mounted gateway namespace instead of treating its envelope as the catalog', async () => {
    const namespace = { list: async () => ({ ok: true, value: catalog() }), setEnabled: async () => ({ ok: true, value: { ok: true, id: 'tool:read', enabled: true, generation: 2 } }) }
    const remote = await resolveToolHubRemote({ get: (key: string) => key === 'remote' ? { toolHub: namespace } : undefined } as never)
    expect(await remote?.list()).toEqual(catalog())
    expect(await remote?.setEnabled({ id: 'tool:read', enabled: true, ifGeneration: 1 })).toMatchObject({ generation: 2 })
  })
  it('preserves domain failures inside transport success', async () => {
    const namespace = { list: async () => ({ ok: true, value: { ok: false, code: 'storage-unavailable', message: 'Storage unavailable' } }), setEnabled: async () => undefined }
    const remote = await resolveToolHubRemote({ get: (key: string) => key === 'remote' ? { toolHub: namespace } : undefined } as never)
    expect(await remote?.list()).toMatchObject({ ok: false, code: 'storage-unavailable' })
  })
})

it('shares concurrent namespace mounts and releases them with the plugin context', async () => {
  let mounted: unknown
  let release!: () => void
  let cleaned=0, mounts=0
  const root={$mount:async()=>{mounts++;await new Promise<void>(done=>{release=done});mounted={list:async()=>({ok:true,value:catalog()}),setEnabled:async()=>({ok:true,value:{ok:true}})};return async()=>{cleaned++}}}
  const disposers:Array<()=>void>=[]
  const ctx={get:(key:string)=>key==='remote'?root:key==='remote.toolHub'?mounted:undefined,effect:(factory:()=>()=>void)=>disposers.push(factory())}
  const first=resolveToolHubRemote(ctx as never),second=resolveToolHubRemote(ctx as never)
  release();await Promise.all([first,second]);expect(mounts).toBe(1)
  await resolveToolHubRemote(ctx as never);expect(mounts).toBe(1)
  for(const dispose of disposers)dispose()
  expect(cleaned).toBe(1)
})

it('releases a late namespace mount after plugin disposal', async () => {
  let finish!: (dispose: () => Promise<void>) => void
  let disposeContext!: () => void
  let cleaned = 0
  const ctx = {get: (key: string) => key === 'remote' ? {$mount: () => new Promise<() => Promise<void>>(resolve => {finish=resolve})} : undefined,
    effect: (factory: () => () => void) => {disposeContext=factory()}}
  const result = resolveToolHubRemote(ctx as never)
  disposeContext(); finish(async () => {cleaned++})
  expect(await result).toBeUndefined(); expect(cleaned).toBe(1)
})
