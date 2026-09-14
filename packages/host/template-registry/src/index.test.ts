import { describe, expect, it } from 'vitest'
import {
  REQUIRED_TEMPLATE_REGISTRY_MCP_TOOLS,
  TEMPLATE_REGISTRY_DOMAIN,
  TEMPLATE_REGISTRY_TABLE,
  TEMPLATE_SESSION_EVENTS,
  TEMPLATE_SESSION_TRANSITIONS,
  TemplateContractSchema,
  TemplateRegistryCompileRowSchema,
  TemplateSchema,
  TemplateSessionSchema,
  advanceTemplateSession,
  canCompile,
  createTemplateSession,
  markDegraded,
  markStale,
  sessionStatusFromReadiness,
  templateRegistrySessionKey,
} from './index.js'

describe('template sessions', () => {
  it('requires confirmation and fields', () => { const s = createTemplateSession('official/x@1','sha256:x'); expect(canCompile(s,['tone'])).toBe(false); expect(canCompile({...s,fields:{tone:'quiet'},confirmed:true},['tone'])).toBe(true) })
  it('marks digest drift stale', () => { const s = createTemplateSession('x','a'); expect(markStale(s,'b').status).toBe('stale') })
  it('armes compile in the ready state', () => {
    const s = { ...createTemplateSession('official/x@1','sha256:x'), status: 'ready' as const, fields: { tone: 'quiet' }, confirmed: true }
    expect(canCompile(s, ['tone'])).toBe(true)
  })
  it('degrades without losing progress and reconnect folds readiness', () => {
    let s = createTemplateSession('official/x@1', 'sha256:x')
    s = { ...s, fields: { tone: 'dark' }, confirmed: true, readiness: 'ready_to_compile' }
    s = markDegraded(s, false)
    expect(s.status).toBe('degraded')
    expect(s.fields.tone).toBe('dark')
    expect(markDegraded(s, false)).toBe(s)
    s = advanceTemplateSession(s, 'transport_back')
    expect(s.status).toBe('ready')
    s = markDegraded(s, false)
    expect(advanceTemplateSession({ ...s, readiness: 'needs_confirmation' }, 'transport_back').status).toBe('confirming')
    expect(advanceTemplateSession({ ...s, readiness: undefined }, 'transport_back').status).toBe('unknown')
  })
})

describe('frozen state machine (1.2)', () => {
  it('maps every registry readiness onto a DSH status', () => {
    expect(sessionStatusFromReadiness('needs_input')).toBe('filling')
    expect(sessionStatusFromReadiness('needs_analysis')).toBe('filling')
    expect(sessionStatusFromReadiness('needs_confirmation')).toBe('confirming')
    expect(sessionStatusFromReadiness('ready_to_compile')).toBe('ready')
    expect(sessionStatusFromReadiness('blocked')).toBe('disabled')
  })
  it('follows the material flow filling -> confirming -> ready -> compiled -> exported', () => {
    let s = createTemplateSession('official/x@1', 'sha256:x')
    for (const event of ['goal_confirmed', 'all_inputs_ready', 'compiled', 'exported'] as const) {
      s = advanceTemplateSession(s, event)
    }
    expect(s.status).toBe('exported')
  })
  it('digest drift marks any material state stale; only reset leaves stale', () => {
    for (const status of ['filling', 'confirming', 'ready', 'compiled', 'exported'] as const) {
      expect(advanceTemplateSession({ ...createTemplateSession('x', 'd'), status }, 'digest_drift').status).toBe('stale')
    }
    const stale = { ...createTemplateSession('x', 'd'), status: 'stale' as const }
    expect(advanceTemplateSession(stale, 'field_filled').status).toBe('stale')
    expect(advanceTemplateSession(stale, 'reset').status).toBe('filling')
  })
  it('keeps illegal transitions as no-ops instead of throwing', () => {
    const exported = { ...createTemplateSession('x', 'd'), status: 'exported' as const }
    expect(advanceTemplateSession(exported, 'field_filled')).toBe(exported)
    expect(advanceTemplateSession(exported, 'field_filled').status).toBe('exported')
  })
  it('defines a transition for every (status, event) pair it declares', () => {
    for (const status of Object.keys(TEMPLATE_SESSION_TRANSITIONS)) {
      for (const event of TEMPLATE_SESSION_EVENTS) {
        const next = TEMPLATE_SESSION_TRANSITIONS[status as keyof typeof TEMPLATE_SESSION_TRANSITIONS][event]
        if (next !== undefined) expect(Object.keys(TEMPLATE_SESSION_TRANSITIONS)).toContain(next)
      }
    }
  })
})

describe('safe projection schemas parse redacted live payloads', () => {
  it('parses a browse record and keeps scaffold rows compatible', () => {
    const record = {
      ref: 'promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main',
      digest: 'sha256:3435f85bd81ce350646f6888ecbd411203b8c5f4a6a317667f599f51f9310755',
      title: '3D asset review checklist', summary: 'Review a candidate 3D asset.',
      tags: ['category:3d'], capabilities: ['model3d', 'review'],
      maturity: 'exploratory', rights: { preview: true, export: false }, source: 'local',
      rightsLevel: 'internal', permissions: ['execute_requires_review', 'preview'],
      compilerStatus: 'not_checked', version: '1.0.0-beta.1',
    }
    const parsed = TemplateSchema.parse(record)
    expect(parsed.rightsLevel).toBe('internal')
    // Scaffold-shaped row (pre-1.2 fields) still parses: backward compatible.
    expect(TemplateSchema.parse({ ref: 'r', digest: 'd', title: 't', summary: 's', rights: { preview: false, export: false }, source: 'catalog' }).permissions).toEqual([])
  })
  it('parses the inspect contract shape with i18n input definitions', () => {
    const contract = TemplateContractSchema.parse({
      digest: 'sha256:7d994764cc454c7d98be8a0eac569aeaaa8aeca3895ff045667a02dc6cead918',
      inputs: [{ name: 'asset_ref', type: 'string', required: true, min_length: 1, max_length: 500, labels: { en: 'Asset reference', 'zh-CN': '资产引用' }, descriptions: { en: 'Pointer to the candidate asset under review' } }],
      license: 'internal', permissions: ['execute_requires_review', 'preview'],
    })
    expect(contract.inputs[0]?.labels['zh-CN']).toBe('资产引用')
    expect(contract.inputs[0]?.required).toBe(true)
  })
  it('parses a session view fold with revision, readiness and recovery fields', () => {
    const session = TemplateSessionSchema.parse({
      id: 's146abbbae84205569f057fed6aa32c88', ref: 'promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1', digest: 'sha256:x',
      status: 'filling', fields: {}, confirmed: false, provider_calls: 0, updatedAt: '2026-09-14T00:00:00.000Z',
      revision: 1, readiness: 'needs_input', nextAction: 'session.update', confirmedKeys: [], contractDigest: 'sha256:c',
    })
    expect(session.revision).toBe(1)
    expect(TemplateSessionSchema.parse({ id: 's1', ref: 'r', digest: 'd', status: 'ready', updatedAt: 't' }).revision).toBe(1)
  })
})

describe('MCP consumption contract (1.2)', () => {
  it('freezes the nine required tools with the template_registry_ prefix', () => {
    expect(REQUIRED_TEMPLATE_REGISTRY_MCP_TOOLS).toHaveLength(9)
    for (const tool of REQUIRED_TEMPLATE_REGISTRY_MCP_TOOLS) expect(tool.startsWith('template_registry_')).toBe(true)
  })
})

describe('storage domain contract (1.2)', () => {
  it('uses the snake_case domain and table names real DSH storage accepts', () => {
    expect(TEMPLATE_REGISTRY_DOMAIN).toBe('yeisme_template_registry_v1')
    expect(/^[a-z][a-z0-9_]*$/.test(TEMPLATE_REGISTRY_DOMAIN)).toBe(true)
    expect(/^[a-z][a-z0-9_]*$/.test(TEMPLATE_REGISTRY_TABLE)).toBe(true)
  })
  it('round-trips a compile row with the recovery contract and export receipt', () => {
    const row = TemplateRegistryCompileRowSchema.parse({
      specVersion: 1, dshSessionRef: 'dsh-session-1',
      session: { id: 's146abbbae84205569f057fed6aa32c88', ref: 'promptrepo://official/x@1.0.0', digest: 'sha256:x', status: 'compiled', fields: { tone: 'dark' }, confirmed: true, provider_calls: 0, updatedAt: '2026-09-14T00:00:00.000Z', revision: 3, readiness: 'ready_to_compile', confirmedKeys: ['tone'], contractDigest: 'sha256:c' },
      exportReceipt: { compileId: 'c1', digest: 'sha256:p', outputRef: 'exports/review.md', providerCalls: 0, exportedAt: '2026-09-14T00:01:00.000Z' },
    })
    expect(row.session.provider_calls).toBe(0)
    expect(row.exportReceipt?.providerCalls).toBe(0)
  })
  it('scopes row keys per DSH session for isolation', () => {
    expect(templateRegistrySessionKey('dsh-a', 's1')).not.toBe(templateRegistrySessionKey('dsh-b', 's1'))
  })
})
