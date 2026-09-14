import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTemplateRegistryService } from './service.js'
import { probeTemplateRegistryMcp } from './service.js'
import { createTemplateRegistryMcpConnection } from './transport.js'
import { createFakeProcessController, fixtureSpawn, sampleCatalog } from './test-support.js'

const stateDirs: string[] = []
afterEach(async () => {
  delete process.env.REGISTRY_FIXTURE_OMIT_TOOL
  delete process.env.REGISTRY_FIXTURE_STATE_FILE
  while (stateDirs.length > 0) await rm(stateDirs.pop()!, { recursive: true, force: true })
})

const REQUIRED_TOOLS = [
  'template_registry_list', 'template_registry_search', 'template_registry_inspect',
  'template_registry_session_create', 'template_registry_session_show', 'template_registry_session_update',
  'template_registry_session_confirm', 'template_registry_compile', 'template_registry_export',
]

function toolsResult(names: string[]) {
  return { result: { tools: names.map(name => ({ name })) } }
}

describe('capability probe (2.1)', () => {
  it('reports connected when the server identity and all nine tools check out', async () => {
    const controller = createFakeProcessController({
      'tools/list': () => toolsResult([...REQUIRED_TOOLS, 'template_registry_doctor']),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    const probe = await probeTemplateRegistryMcp(connection)
    expect(probe).toMatchObject({ state: 'connected', server: { serverName: 'template-registry', serverVersion: 'template-registry.prompt-compiler.v0.2' } })
    connection.dispose()
  })
  it('reports tools_missing with the exact missing set', async () => {
    const controller = createFakeProcessController({
      'tools/list': () => toolsResult(REQUIRED_TOOLS.filter(tool => tool !== 'template_registry_compile')),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    const probe = await probeTemplateRegistryMcp(connection)
    expect(probe).toMatchObject({ state: 'unavailable', reason: 'tools_missing', missingTools: ['template_registry_compile'] })
    connection.dispose()
  })
  it('reports server_mismatch for a foreign server identity', async () => {
    const controller = createFakeProcessController({
      initialize: () => ({ result: { protocolVersion: '2025-06-18', serverInfo: { name: 'other-server', version: '9.9' } } }),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    expect(await probeTemplateRegistryMcp(connection)).toMatchObject({ state: 'unavailable', reason: 'server_mismatch' })
    connection.dispose()
  })
  it('times out honestly when the owner never answers (transport re-check by abort)', async () => {
    const controller = createFakeProcessController({
      initialize: () => ({ silence: true }),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    const started = Date.now()
    const probe = await probeTemplateRegistryMcp(connection, { timeoutMs: 120 })
    expect(probe).toMatchObject({ state: 'unavailable', reason: 'connect_failed' })
    expect(Date.now() - started).toBeLessThan(2000)
    expect(controller.spawns()).toBeGreaterThanOrEqual(1)
    connection.dispose()
  })
})

describe('template-registry service three honest states (2.1)', () => {
  it('connected: probe passes and browse/search/inspect serve over MCP', async () => {
    const service = createTemplateRegistryService({
      mcp: { binary: 'template-registry', spawnProcess: fixtureSpawn() },
      catalog: { load: async () => sampleCatalog() },
    })
    expect(await service.probe()).toMatchObject({ state: 'connected' })
    expect(service.health().state).toBe('connected')
    const browse = await service.browse({ query: '3d' })
    expect(browse).toMatchObject({ ok: true, origin: 'mcp' })
    if (browse.ok) expect(browse.templates[0]!.source).toBe('local')
    const search = await service.search('asset')
    expect(search).toMatchObject({ ok: true, origin: 'mcp' })
    const inspect = await service.inspect('promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main')
    expect(inspect.ok).toBe(true)
    if (inspect.ok) expect(inspect.inspection.template.rights.preview).toBe(true)
    const preview = await service.preview('promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main')
    expect(preview.allowed).toBe(true)
    service.dispose()
  }, 15000)

  it('degraded: probe failure with a readable catalog serves the bounded fallback', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-template-registry-degraded-'))
    stateDirs.push(dir)
    process.env.REGISTRY_FIXTURE_OMIT_TOOL = 'template_registry_compile'
    const service = createTemplateRegistryService({
      mcp: { binary: 'template-registry', spawnProcess: fixtureSpawn() },
      catalog: { load: async () => sampleCatalog('sha256:catalog-snapshot-1') },
    })
    const health = await service.probe()
    expect(health).toMatchObject({ state: 'degraded', reason: 'tools_missing', catalogDigest: 'sha256:catalog-snapshot-1' })
    const browse = await service.browse({})
    expect(browse).toMatchObject({ ok: true, origin: 'catalog' })
    if (browse.ok) {
      expect(browse.templates.length).toBeGreaterThanOrEqual(3)
      // Catalog rows are fail-closed: no contract permissions exist offline.
      expect(browse.templates.every(template => template.rights.preview === false && template.source === 'catalog')).toBe(true)
      expect(browse.catalogDigest).toBe('sha256:catalog-snapshot-1')
    }
    const filtered = await service.browse({ category: '3d' })
    expect(filtered.ok && filtered.templates.every(template => template.tags.includes('category:3d'))).toBe(true)
    // Inspect/preview are MCP-only: degraded denies preview with the reason code.
    const preview = await service.preview('promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main')
    expect(preview).toMatchObject({ allowed: false, reason: 'degraded' })
    const inspect = await service.inspect('promptrepo://official/3d/x@1')
    expect(inspect).toMatchObject({ ok: false, failure: { kind: 'degraded' } })
    // Session mutations fail closed in degraded state.
    const session = await service.createSession({ goal: 'g' }, { ref: 'r', digest: 'd' })
    expect(session).toMatchObject({ ok: false, failure: { kind: 'guard', code: 'degraded' } })
    // Recovery: the tools_missing fixture exits after answering, so the next
    // probe spawns a fresh process; with the knob removed it heals to connected.
    delete process.env.REGISTRY_FIXTURE_OMIT_TOOL
    await new Promise(resolve => setTimeout(resolve, 120))
    expect(await service.probe()).toMatchObject({ state: 'connected' })
    service.dispose()
  }, 20000)

  it('offline: no MCP and no catalog fabricates nothing', async () => {
    const controller = createFakeProcessController({ initialize: () => ({ silence: true }) })
    const service = createTemplateRegistryService({
      mcp: { binary: 'template-registry', spawnProcess: controller.factory },
      catalog: { load: async () => ({ schema_version: 'not-a-catalog' }) },
      probeTimeoutMs: 120,
    })
    expect(await service.probe()).toMatchObject({ state: 'offline', reason: 'connect_failed' })
    const browse = await service.browse({})
    expect(browse).toMatchObject({ ok: false, failure: { kind: 'offline' } })
    service.dispose()
  })

  it('transport lost mid-browse flips to degraded and the catalog answers; probe re-checks the transport', async () => {
    let listCalls = 0
    const controller = createFakeProcessController({
      'tools/list': () => toolsResult(REQUIRED_TOOLS),
      'tools/call': () => {
        listCalls += 1
        return listCalls === 1 ? { drop: true } : {
          result: { content: [{ type: 'text', text: JSON.stringify({ spec_version: '1.0', status: 'success', summary: 'ok', facts: {}, data: { solutions: [] }, actions: [] }) }] },
        }
      },
    })
    const service = createTemplateRegistryService({
      mcp: { binary: 'template-registry', spawnProcess: controller.factory },
      catalog: { load: async () => sampleCatalog() },
    })
    expect(await service.probe()).toMatchObject({ state: 'connected' })
    // The owner dies mid-read: the shared disconnected marker maps to the
    // catalog fallback, and the health flips to degraded (transport_lost).
    const fallen = await service.browse({})
    expect(fallen).toMatchObject({ ok: true, origin: 'catalog' })
    expect(service.health()).toMatchObject({ state: 'degraded', reason: 'transport_lost' })
    // The probe re-checks the transport with a fresh child process: healed.
    expect(await service.probe()).toMatchObject({ state: 'connected' })
    const recovered = await service.browse({})
    expect(recovered).toMatchObject({ ok: true, origin: 'mcp', templates: [] })
    service.dispose()
  })

  it('translates pane-canonical field keys onto the wire using learned step ids (4.1)', async () => {
    const service = createTemplateRegistryService({
      mcp: { binary: 'template-registry', spawnProcess: fixtureSpawn() },
      catalog: { load: async () => sampleCatalog() },
    })
    expect(await service.probe()).toMatchObject({ state: 'connected' })
    const REF = 'promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main'
    const inspected = await service.inspect(REF)
    expect(inspected.ok).toBe(true)
    if (!inspected.ok) return
    const context = { ref: REF, digest: inspected.inspection.template.digest, contractDigest: inspected.inspection.contract.digest }
    const created = await service.createSession({ goal: 'pane journey', ref: REF }, context)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.value.stepIds).toEqual(['main'])
    // The pane submits contract input names with NO stepIds in the context:
    // the service replays the step ids it learned from the create view, so
    // the owner's `<step>.<name>` wire keys are satisfied (FIELD_INVALID
    // otherwise — the 4.1 real-binary finding).
    const updated = await service.updateSession({
      sessionId: created.value.id, expectedRevision: created.value.revision,
      fields: { asset_ref: { value: 'asset-9' }, intended_use: { value: 'review pass' } },
    }, { ...context, fields: created.value.fields })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.value.fields).toMatchObject({ asset_ref: 'asset-9', intended_use: 'review pass' })
    const confirmed = await service.confirmSession({
      sessionId: created.value.id, expectedRevision: updated.value.revision,
      decisionRef: 'dsh.template-registry.confirm.v1.test.3', goal: true, fields: ['asset_ref', 'intended_use'],
    }, { ...context, fields: updated.value.fields })
    expect(confirmed.ok).toBe(true)
    expect(confirmed.ok && confirmed.value.confirmed).toBe(true)
    service.dispose()
  })

  it('rejects unsafe binary names at construction', () => {
    expect(() => createTemplateRegistryService({
      mcp: { binary: '/bin/sh' }, catalog: { load: async () => sampleCatalog() },
    })).toThrow('unsafe_binary')
  })
})
