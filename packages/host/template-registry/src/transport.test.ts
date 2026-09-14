import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  TEMPLATE_REGISTRY_DISCONNECTED,
  TEMPLATE_REGISTRY_FIXED_ARGV,
  createTemplateRegistryMcpConnection,
  isSafeTemplateRegistryBinary,
} from './transport.js'
import { createFakeProcessController, fixtureSpawn } from './test-support.js'

describe('fixed-argv transport guards', () => {
  it('freezes the owner argv verified live', () => {
    expect([...TEMPLATE_REGISTRY_FIXED_ARGV]).toEqual(['mcp', 'serve'])
  })
  it('rejects unsafe binary names at construction', () => {
    for (const binary of ['/usr/bin/template-registry', '../escape', 'template-registry --flag', '']) {
      expect(isSafeTemplateRegistryBinary(binary)).toBe(false)
    }
    expect(() => createTemplateRegistryMcpConnection({ binary: '/usr/bin/evil' }, { spawnProcess: fixtureSpawn() })).toThrow('unsafe_binary')
    expect(isSafeTemplateRegistryBinary('template-registry')).toBe(true)
  })
})

describe('fixed-argv transport (in-memory fake process)', () => {
  it('handshakes lazily and multiplexes requests by JSON-RPC id', async () => {
    const controller = createFakeProcessController({
      'tools/list': () => ({ result: { tools: [{ name: 'template_registry_list' }] } }),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    const info = await connection.serverInfo()
    expect(info.serverName).toBe('template-registry')
    expect(info.serverVersion.startsWith('template-registry.prompt-compiler.')).toBe(true)
    // One child serves the whole connection: three requests, one spawn.
    const [a, b] = await Promise.all([
      connection.request('tools/list'),
      connection.request('tools/list'),
    ])
    expect((a as { tools: unknown[] }).tools).toHaveLength(1)
    expect((b as { tools: unknown[] }).tools).toHaveLength(1)
    expect(controller.spawns()).toBe(1)
    connection.dispose()
  })

  it('preserves owner JSON-RPC error codes across the seam', async () => {
    const controller = createFakeProcessController({
      'tools/call': () => ({ errorFrame: { code: -32000, data: { code: 'REVISION_CONFLICT' } } }),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    await expect(connection.request('tools/call', { name: 'x', arguments: {} })).rejects.toMatchObject({ data: { code: 'REVISION_CONFLICT' } })
    connection.dispose()
  })

  it('collapses mid-request drops to the constant marker and re-establishes on the next request', async () => {
    let calls = 0
    const controller = createFakeProcessController({
      'tools/call': () => {
        calls += 1
        return calls <= 1 ? { drop: true } : { result: { content: [{ type: 'text', text: '{"spec_version":"1.0"}' }] } }
      },
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    const dropped = await connection.request('tools/call', { name: 'x', arguments: {} }).catch(error => error)
    // Constant text only: no exit codes, no process error text, no fixture names.
    expect(dropped).toBeInstanceOf(Error)
    expect((dropped as Error).message).toBe(TEMPLATE_REGISTRY_DISCONNECTED)
    expect(JSON.stringify(dropped)).not.toMatch(/exit|ECONN|fixture|spawn/i)
    const recovered = await connection.request('tools/call', { name: 'x', arguments: {} })
    expect(recovered).toMatchObject({ content: [{ type: 'text' }] })
    expect(controller.spawns()).toBe(2)
    connection.dispose()
  })

  it('an outer abort drops the whole connection instead of leaving half-read state', async () => {
    const controller = createFakeProcessController({
      'tools/call': () => ({ silence: true }),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    const controller2 = new AbortController()
    const pending = connection.request('tools/call', { name: 'x', arguments: {} }, { signal: controller2.signal })
    controller2.abort()
    await expect(pending).rejects.toMatchObject({ message: TEMPLATE_REGISTRY_DISCONNECTED })
    connection.dispose()
  })

  it('a handshake that answers without a server identity fails honestly', async () => {
    const controller = createFakeProcessController({
      initialize: () => ({ result: { capabilities: {} } }),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    await expect(connection.serverInfo()).rejects.toMatchObject({ message: TEMPLATE_REGISTRY_DISCONNECTED })
    connection.dispose()
  })
})

describe('fixed-argv transport (real spawned synthetic fixture)', () => {
  it('handshakes, lists tools, and serves one tools/call envelope', async () => {
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: fixtureSpawn() })
    expect(await connection.serverInfo()).toMatchObject({ serverName: 'template-registry' })
    const tools = await connection.request('tools/list') as { tools: { name: string }[] }
    expect(tools.tools.map(tool => tool.name)).toContain('template_registry_compile')
    const call = await connection.request('tools/call', {
      name: 'template_registry_inspect',
      arguments: { ref: 'promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main' },
    }) as { content: { type: string; text: string }[] }
    expect(JSON.parse(call.content[0]!.text)).toMatchObject({ spec_version: '1.0', status: 'partial' })
    connection.dispose()
  }, 15000)

  it('survives a deterministic mid-call owner drop and re-establishes a fresh process', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'dsh-template-registry-'))
    const stateFile = join(stateDir, 'dropped-once')
    process.env.REGISTRY_FIXTURE_STATE_FILE = stateFile
    try {
      const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: fixtureSpawn() })
      await expect(connection.request('tools/call', { name: 'template_registry_list', arguments: {} })).rejects.toMatchObject({ message: TEMPLATE_REGISTRY_DISCONNECTED })
      const recovered = await connection.request('tools/call', { name: 'template_registry_list', arguments: {} }) as { content: { text: string }[] }
      expect(JSON.parse(recovered.content[0]!.text)).toMatchObject({ status: 'success' })
      connection.dispose()
    } finally {
      delete process.env.REGISTRY_FIXTURE_STATE_FILE
      await rm(stateDir, { recursive: true, force: true })
    }
  }, 15000)
})
