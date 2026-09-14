/**
 * Scriptable fake of the template-registry host seam for client tests.
 * Mirrors the honest outcome folds of the real service (task 2.1-2.4)
 * without spawning anything: browse/inspect/preview outcomes and a full
 * create -> update -> confirm -> compile -> export session journey.
 */

import type {
  RegistryCompileResult,
  RegistryExportReceipt,
  RegistrySessionContext,
  RegistrySessionCreateInput,
  Template,
  TemplateInspection,
  TemplatePreview,
  TemplateRegistryHealth,
  TemplateSession,
} from '@yeisme/dsh-template-registry'
import type { TemplateRegistryHostFace } from '../src/seam.js'

export interface FakeHostScript {
  templates?: Template[]
  browseFailure?: { kind: 'offline' } | { kind: 'registry_error'; code: string; retryable: boolean } | { kind: 'contract_mismatch' }
  browseOrigin?: 'mcp' | 'catalog'
  health?: TemplateRegistryHealth
  inspection?: TemplateInspection
  inspectFailure?: { kind: 'degraded' } | { kind: 'not_found' } | { kind: 'registry_error'; code: string; retryable: boolean }
  preview?: TemplatePreview
  compileGuard?: 'not_confirmed' | 'missing_fields'
  exportGuard?: 'stale_digest' | 'not_compiled'
  currentDigest?: string
}

export function fakeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    ref: 'solution/demo-template/templates/main@en',
    digest: 'sha256:template-demo-1',
    title: 'Demo guided template',
    summary: 'A demo template with a two-field contract.',
    tags: ['category:demo', 'job:compile'],
    capabilities: ['compile'],
    maturity: 'exploratory',
    rights: { preview: true, export: true },
    source: 'local',
    permissions: ['preview', 'export'],
    ...overrides,
  }
}

export function fakeInspection(overrides: Partial<TemplateInspection> = {}): TemplateInspection {
  return {
    template: fakeTemplate(),
    contract: {
      digest: 'sha256:contract-demo-1',
      inputs: [
        { name: 'subject', type: 'string', required: true, min_length: 1, max_length: 80, labels: { en: 'Subject', 'zh-CN': '主题' }, descriptions: { en: 'What the prompt is about.', 'zh-CN': '提示词的主题。' } },
        { name: 'audience', type: 'string', required: true, labels: { en: 'Audience', 'zh-CN': '受众' }, descriptions: {} },
        { name: 'tone', type: 'string', required: false, labels: { en: 'Tone', 'zh-CN': '语气' }, descriptions: {} },
      ],
      license: 'internal',
      permissions: ['preview', 'export'],
    },
    ready: false,
    issues: [],
    ...overrides,
  }
}

export function fakeSession(overrides: Partial<TemplateSession> = {}): TemplateSession {
  return {
    id: 's' + 'a'.repeat(32),
    ref: 'solution/demo-template/templates/main@en',
    digest: 'sha256:template-demo-1',
    status: 'filling',
    fields: {},
    confirmed: false,
    provider_calls: 0,
    updatedAt: '2026-09-14T00:00:00.000Z',
    revision: 1,
    readiness: 'needs_input',
    confirmedKeys: [],
    ...overrides,
  }
}

export interface FakeHostCalls {
  readonly browseInputs: unknown[]
  readonly decisionRefs: string[]
  readonly probeCount: number
}

export function createFakeHost(script: FakeHostScript = {}) {
  const templates = script.templates ?? [fakeTemplate()]
  const calls: FakeHostCalls = { browseInputs: [], decisionRefs: [], probeCount: 0 }
  let session: TemplateSession | undefined
  let compile: RegistryCompileResult | undefined

  const host: TemplateRegistryHostFace & { calls: FakeHostCalls; sessionState(): TemplateSession | undefined } = {
    schema: 'dsh.template-registry.host.v1',
    locale: 'zh',
    calls,
    sessionState: () => session,
    health: () => script.health ?? { state: 'connected', server: { serverName: 'template-registry', serverVersion: 'template-registry.prompt-compiler.v0.2', protocolVersion: '2025-06-18' } },
    async probe() {
      calls.probeCount += 1
      return host.health()
    },
    async browse(input = {}) {
      calls.browseInputs.push(input)
      if (script.browseFailure !== undefined) {
        return { ok: false, failure: script.browseFailure, health: host.health() }
      }
      return { ok: true, origin: script.browseOrigin ?? 'mcp', templates }
    },
    async search(query) {
      return host.browse({ query })
    },
    async inspect(ref) {
      if (script.inspectFailure !== undefined) return { ok: false, failure: script.inspectFailure }
      if (script.inspection === undefined) return { ok: false, failure: { kind: 'not_found' } }
      return { ok: true, inspection: { ...script.inspection, template: { ...script.inspection.template, ref } } }
    },
    async preview(ref) {
      if (script.preview !== undefined) return script.preview
      return { ref, allowed: true, digest: 'sha256:template-demo-1', title: 'Demo guided template', summary: 'A demo template with a two-field contract.' }
    },
    async createSession(input: RegistrySessionCreateInput, context: { ref: string; digest: string; contractDigest?: string }) {
      if (input.goal.trim() === '') return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'goal is required' } }
      session = fakeSession({ ref: context.ref, digest: context.digest, ...(context.contractDigest === undefined ? {} : { contractDigest: context.contractDigest }), readiness: 'needs_input', status: 'filling' })
      return { ok: true, value: session }
    },
    async updateSession(input: { sessionId: string; expectedRevision: number; fields: Readonly<Record<string, { value: unknown; kind?: string }>> }, context: RegistrySessionContext) {
      if (session === undefined) return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'no session' } }
      const fields = Object.fromEntries(Object.entries(input.fields).map(([name, entry]) => [name, entry.value]))
      session = { ...session, revision: session.revision + 1, fields: { ...session.fields, ...fields } }
      return { ok: true, value: session }
    },
    async confirmSession(input: { sessionId: string; expectedRevision: number; decisionRef: string }, _context: RegistrySessionContext) {
      if (session === undefined) return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'no session' } }
      if (input.decisionRef.trim() === '') return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'decision_ref is required' } }
      calls.decisionRefs.push(input.decisionRef)
      session = { ...session, revision: session.revision + 1, confirmed: true, readiness: 'ready_to_compile', status: 'ready', decisionRef: input.decisionRef }
      return { ok: true, value: session }
    },
    async compileSession(_input: { sessionId: string; expectedRevision: number }, guard: { session: TemplateSession; required: readonly string[] }, _context: RegistrySessionContext) {
      if (script.compileGuard === 'not_confirmed') {
        return { ok: false, failure: { kind: 'guard', code: 'not_confirmed', detail: 'the session was never explicitly confirmed' } }
      }
      if (script.compileGuard === 'missing_fields') {
        return { ok: false, failure: { kind: 'guard', code: 'missing_fields', detail: 'required fields are missing or empty', missing: guard.required } }
      }
      if (session === undefined) return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'no session' } }
      compile = { session: { ...session, status: 'compiled', readiness: 'ready_to_compile' }, compileId: 'c' + 'b'.repeat(24), digest: 'sha256:compile-demo-1' }
      return { ok: true, value: compile }
    },
    async exportSession(input: { compileId: string; output: string }, guard: { session: TemplateSession; currentDigest?: string }) {
      if (script.exportGuard === 'stale_digest' || (guard.currentDigest !== undefined && guard.currentDigest !== guard.session.digest)) {
        return { ok: false, failure: { kind: 'guard', code: 'stale_digest', detail: 'the template digest changed since the session pinned it; re-pin before exporting' } }
      }
      if (script.exportGuard === 'not_compiled' || (guard.session.status !== 'compiled' && guard.session.status !== 'stale')) {
        return { ok: false, failure: { kind: 'guard', code: 'not_compiled', detail: 'only a compiled session may export' } }
      }
      const receipt: RegistryExportReceipt = { compileId: input.compileId, digest: 'sha256:compile-demo-1', outputRef: `exports/${input.output}.md`, providerCalls: 0, exportedAt: '2026-09-14T12:00:00.000Z' }
      if (session !== undefined) session = { ...session, status: 'exported' }
      return { ok: true, value: receipt }
    },
    async showSession(sessionId: string, _context: RegistrySessionContext) {
      if (session === undefined || session.id !== sessionId) return { ok: false, failure: { kind: 'guard', code: 'invalid_input', detail: 'no session' } }
      return { ok: true, value: session }
    },
    dispose() {},
  }
  return host
}
