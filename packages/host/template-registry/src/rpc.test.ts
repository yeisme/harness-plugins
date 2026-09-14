import { describe, expect, it } from 'vitest'
import {
  callTemplateRegistryTool,
  deriveTemplateRights,
  parseRegistryToolCallResult,
  rpcInspectTemplate,
  rpcListTemplates,
  rpcSearchTemplates,
  templateFromBrowseRecord,
  templateInspectionFromInspectData,
  templatePreviewFromInspection,
  templatesFromBrowseData,
} from './rpc.js'
import { createTemplateRegistryMcpConnection } from './transport.js'
import { createFakeProcessController, fixtureSpawn } from './test-support.js'

const REF = 'promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main'

/** Real sampled envelope from the live 2026-09-14 handshake (redacted). */
const LIVE_LIST_ENVELOPE = {
  spec_version: '1.0', mode: 'json', command: 'templateregistry.prompt.list',
  status: 'success', summary: '2 repositories; 106 solutions matched.',
  facts: { documents: 224, entries: 224, solutions: 106 },
  data: {
    status: 'success',
    solutions: [
      {
        repository_id: 'official', package_id: '3d', id: '3d-asset-review-beta', version: '1.0.0-beta.1',
        title: '3D asset review checklist', summary: 'Review a candidate 3D asset.', category: '3d',
        capabilities: ['model3d', 'review'],
        templates: [
          {
            ref: REF,
            digest: 'sha256:3435f85bd81ce350646f6888ecbd411203b8c5f4a6a317667f599f51f9310755',
            title: '3D asset review checklist', summary: 'Review a candidate 3D asset.',
            tags: ['category:3d'], capabilities: ['model3d', 'review'], media: ['3d'], consumers: ['unknown'],
            compiler_status: 'not_checked', rights: 'internal', maturity: 'exploratory', version: '1.0.0-beta.1',
          },
        ],
      },
    ],
  },
  actions: [], retryable: false,
}

const LIVE_INSPECT_DATA = {
  origin: 'file', ref: REF, version: '1.0.0-beta.1',
  digest: 'sha256:3435f85bd81ce350646f6888ecbd411203b8c5f4a6a317667f599f51f9310755',
  locale: 'en', role: 'main', rights: 'internal', trust: 'reviewed', maturity: 'exploratory',
  tags: ['category:3d'], capabilities: ['model3d', 'review'],
  title: '3D asset review checklist', summary: 'Review a candidate 3D asset.',
  usage: 'English-compiled beta; reviews report findings and never issue execution instructions.',
  inputs: [
    { definition: { name: 'asset_ref', type: 'string', required: true, min_length: 1, max_length: 500, labels: { en: 'Asset reference', 'zh-CN': '资产引用' }, descriptions: { en: 'Pointer to the candidate asset under review' } }, status: 'missing' },
  ],
  contract: {
    digest: 'sha256:7d994764cc454c7d98be8a0eac569aeaaa8aeca3895ff045667a02dc6cead918',
    inputs: [{ name: 'asset_ref', type: 'string', required: true, min_length: 1, max_length: 500, labels: { en: 'Asset reference', 'zh-CN': '资产引用' } }],
    license: 'internal', permissions: ['execute_requires_review', 'preview'],
  },
  issues: [], next_action: { kind: 'supply_inputs', required_inputs: ['asset_ref'] },
  compiler_status: 'contract_available', ready: false,
}

function envelopeResult(envelope: unknown): { content: { type: string; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(envelope) }] }
}

describe('envelope extraction', () => {
  it('parses the sampled live list envelope and keeps the raw data block', () => {
    const call = parseRegistryToolCallResult(envelopeResult(LIVE_LIST_ENVELOPE))
    expect(call).toBeDefined()
    expect(call!.envelope.status).toBe('success')
    expect(call!.envelope.facts.solutions).toBe(106)
    expect(templatesFromBrowseData(call!.data)).toHaveLength(1)
  })
  it('fails closed on shape drift (no text block, bad JSON, or missing envelope fields)', () => {
    expect(parseRegistryToolCallResult({ content: [] })).toBeUndefined()
    expect(parseRegistryToolCallResult({ content: [{ type: 'text', text: 'not json' }] })).toBeUndefined()
    expect(parseRegistryToolCallResult({ content: [{ type: 'text', text: '{"spec_version":"9.9"}' }] })).toBeUndefined()
    expect(parseRegistryToolCallResult(undefined)).toBeUndefined()
  })
})

describe('rights derivation (fail-closed)', () => {
  it('derives preview/export from the two-layer model', () => {
    expect(deriveTemplateRights({ rightsLevel: 'internal', permissions: ['preview', 'export'] })).toEqual({ preview: true, export: true })
    expect(deriveTemplateRights({ rightsLevel: 'internal', permissions: ['execute_requires_review', 'preview'] })).toEqual({ preview: true, export: false })
  })
  it('denies everything on deny/blocked permissions, blocked rights levels, and unknown values', () => {
    expect(deriveTemplateRights({ rightsLevel: 'internal', permissions: ['deny'] })).toEqual({ preview: false, export: false })
    expect(deriveTemplateRights({ rightsLevel: 'internal', permissions: ['blocked', 'preview'] })).toEqual({ preview: false, export: false })
    expect(deriveTemplateRights({ rightsLevel: 'prohibited', permissions: ['preview'] })).toEqual({ preview: false, export: false })
    expect(deriveTemplateRights({ rightsLevel: 'internal', permissions: [] })).toEqual({ preview: false, export: false })
    // Unknown or missing values always collapse to "no permission".
    expect(deriveTemplateRights({ rightsLevel: 'internal', permissions: ['mystery', 'preview'] }).preview).toBe(true)
    expect(deriveTemplateRights({ rightsLevel: 'mystery', permissions: ['preview'] })).toEqual({ preview: false, export: false })
    expect(deriveTemplateRights({ permissions: ['preview'] })).toEqual({ preview: false, export: false })
  })
})

describe('browse and inspect folding (sampled live shapes)', () => {
  it('folds a browse record with fail-closed rights (no contract permissions at list time)', () => {
    const template = templateFromBrowseRecord(LIVE_LIST_ENVELOPE.data.solutions[0]!.templates[0])
    expect(template).toMatchObject({
      ref: REF, rightsLevel: 'internal', maturity: 'exploratory', compilerStatus: 'not_checked', source: 'local',
    })
    expect(template!.rights).toEqual({ preview: false, export: false })
  })
  it('folds the inspect answer into a template + contract with derived rights', () => {
    const inspection = templateInspectionFromInspectData(LIVE_INSPECT_DATA)
    expect(inspection).toBeDefined()
    expect(inspection!.template.rights).toEqual({ preview: true, export: false })
    expect(inspection!.template.permissions).toEqual(['execute_requires_review', 'preview'])
    expect(inspection!.contract.inputs[0]!.labels['zh-CN']).toBe('资产引用')
    expect(inspection!.contract.digest).toBe('sha256:7d994764cc454c7d98be8a0eac569aeaaa8aeca3895ff045667a02dc6cead918')
    expect(inspection!.usage).toContain('English-compiled beta')
    expect(inspection!.template.rightsLevel).toBe('internal')
  })
  it('drops inspect answers without a usable contract (fail-closed)', () => {
    expect(templateInspectionFromInspectData({ ref: REF, digest: 'sha256:x' })).toBeUndefined()
    expect(templateInspectionFromInspectData(undefined)).toBeUndefined()
  })
})

describe('preview derivation (owner-approved DTO only)', () => {
  it('allows a bounded preview when the contract grants preview', () => {
    const inspection = templateInspectionFromInspectData(LIVE_INSPECT_DATA)!
    const preview = templatePreviewFromInspection(inspection)
    expect(preview.allowed).toBe(true)
    if (preview.allowed) {
      expect(preview.ref).toBe(REF)
      expect(preview.contractDigest).toBe(inspection.contract.digest)
      expect(preview.usage).toBeDefined()
    }
  })
  it('returns a stable deny reason code when preview is not permitted', () => {
    const denied = templatePreviewFromInspection(templateInspectionFromInspectData({ ...LIVE_INSPECT_DATA, contract: { ...LIVE_INSPECT_DATA.contract, permissions: ['execute_requires_review'] } })!)
    expect(denied).toMatchObject({ allowed: false, reason: 'permission_denied' })
    const blocked = templatePreviewFromInspection(templateInspectionFromInspectData({ ...LIVE_INSPECT_DATA, rights: 'blocked' })!)
    expect(blocked).toMatchObject({ allowed: false, reason: 'rights_denied' })
  })
})

describe('typed RPC calls (real spawned synthetic fixture)', () => {
  it('lists, searches, and inspects through the fixed-argv transport', async () => {
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: fixtureSpawn() })
    const listed = await rpcListTemplates(connection, { query: '3d' })
    expect(listed.ok).toBe(true)
    if (listed.ok) {
      expect(listed.templates).toHaveLength(1)
      expect(listed.templates[0]!.rights).toEqual({ preview: false, export: false })
    }
    const searched = await rpcSearchTemplates(connection, 'asset')
    expect(searched.ok && searched.templates).toHaveLength(1)
    const inspected = await rpcInspectTemplate(connection, REF)
    expect(inspected.ok).toBe(true)
    if (inspected.ok) expect(inspected.inspection.template.rights.preview).toBe(true)
    const missing = await rpcInspectTemplate(connection, 'promptrepo://official/nope/x@1?locale=en')
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.failure).toMatchObject({ kind: 'registry_error', code: 'TEMPLATE_CONTRACT_REQUIRED', retryable: false })
    connection.dispose()
  }, 15000)

  it('maps JSON-RPC owner error frames and disconnects to the failure taxonomy', async () => {
    const controller = createFakeProcessController({
      'tools/call': () => ({ errorFrame: { code: -32000, data: { code: 'SESSION_STORE_BUSY' } } }),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    const outcome = await callTemplateRegistryTool(connection, 'template_registry_list', {})
    expect(outcome).toMatchObject({ ok: false, failure: { kind: 'registry_error', code: 'SESSION_STORE_BUSY', retryable: true } })
    // A fresh owner process that dies on the call surfaces as disconnected.
    controller.setScript({ 'tools/call': () => ({ drop: true }) })
    const dropped = await callTemplateRegistryTool(connection, 'template_registry_list', {})
    expect(dropped).toMatchObject({ ok: false, failure: { kind: 'disconnected' } })
    connection.dispose()
  })

  it('maps envelope-level failures to registry_error with the owner code', async () => {
    const controller = createFakeProcessController({
      'tools/call': () => ({ result: envelopeResult({ spec_version: '1.0', status: 'failed', summary: 'Operation failed.', facts: {}, error: { code: 'INPUT_INVALID', message: 'INPUT_INVALID', retryable: false }, actions: [] }) }),
    })
    const connection = createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: controller.factory })
    const outcome = await callTemplateRegistryTool(connection, 'template_registry_search', { query: 'x' })
    expect(outcome).toMatchObject({ ok: false, failure: { kind: 'registry_error', code: 'INPUT_INVALID', retryable: false } })
    connection.dispose()
  })
})
