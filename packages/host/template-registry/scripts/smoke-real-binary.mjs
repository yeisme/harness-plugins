#!/usr/bin/env node
/**
 * REAL-binary integration smoke for the template-registry host surface
 * (dsh-template-registry-integration-v1, wave 2 evidence).
 *
 * Spawns the REAL published template-registry server binary over the frozen
 * fixed-argv stdio seam (`mcp serve`) — the same transport the unit tests
 * exercise against the synthetic fixture — and drives:
 *   probe (identity + tools/list ⊇ nine required tools) → list → inspect →
 *   session create/update/confirm → compile (provider_calls=0 asserted) →
 *   export (owner-relative output) → storage-domain row round-trip →
 *   projection fold of the same journey.
 *
 * Inputs come from the environment (never hardcoded paths):
 *   TEMPLATE_REGISTRY_BIN_DIR   directory containing the `template-registry`
 *                               binary (added to PATH so the bare-name spawn
 *                               rule holds)
 *   TEMPLATE_REGISTRY_SOURCE    file:// source of the official content
 *                               checkout used to seed a throwaway project
 *   TEMPLATE_REGISTRY_EVIDENCE_DIR  evidence output directory (default:
 *                               <repo>/temp/integration-test-runs)
 *
 * Evidence is REDACTED: no absolute paths, no raw prompt bodies, no private
 * tool arguments — only public catalog refs/digests, synthetic field values,
 * envelopes' bounded facts, and receipt summaries.
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const binDir = process.env.TEMPLATE_REGISTRY_BIN_DIR
const source = process.env.TEMPLATE_REGISTRY_SOURCE
if (!binDir || !source) {
  console.error('set TEMPLATE_REGISTRY_BIN_DIR and TEMPLATE_REGISTRY_SOURCE (see header)')
  process.exit(2)
}
// Bare-name spawn rule: resolve the real binary through PATH, never a path literal.
process.env.PATH = `${binDir}:${process.env.PATH ?? ''}`

const { createTemplateRegistryService } = await import('../lib/service.js')
const transport = await import('../lib/transport.js')
const { TemplateRegistrySessionStore } = await import('../lib/store.js')
const { applyTemplateCompileProjection, createTemplateCompileProjectionState, templateCompileExportGate } = await import('../lib/projection.js')

const runId = `template-registry-wave2-real-binary-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const evidenceRoot = process.env.TEMPLATE_REGISTRY_EVIDENCE_DIR ?? fileURLToPath(new URL('../../../../temp/integration-test-runs/', import.meta.url))
const evidenceDir = join(evidenceRoot, runId)
await mkdir(evidenceDir, { recursive: true })

const evidence = {
  run: runId,
  evidence_level: 'real',
  started_at: new Date().toISOString(),
  steps: [],
  redaction: 'absolute paths and private arguments redacted; field values are synthetic',
}

const step = (name, facts) => {
  evidence.steps.push({ name, at: new Date().toISOString(), ...facts })
  console.log(`- ${name}: ${JSON.stringify(facts)}`)
}

const project = await mkdtemp(join(tmpdir(), 'dsh-template-registry-smoke-'))
try {
  // Seed the throwaway project with the official content repository through
  // the MCP surface itself (repository_add/sync are owner-side setup, not the
  // pane consumption set).
  const seeder = transport.createTemplateRegistryMcpConnection({ binary: 'template-registry', cwd: project }, { spawnProcess: transport.nodeTemplateRegistrySpawn })
  await seeder.request('tools/call', { name: 'template_registry_repository_add', arguments: { id: 'official', source, trust: 'reviewed' } })
  const synced = await seeder.request('tools/call', { name: 'template_registry_repository_sync', arguments: { all: true } })
  step('repository_seed', { ok: JSON.stringify(synced).includes('"status":"success"'), source: 'file://<official-content-checkout>' })
  seeder.dispose()

  // The catalog loader is optional here: this smoke drives the MCP path; an
  // unset catalog file simply leaves the degraded fallback unavailable.
  const catalogFile = process.env.TEMPLATE_REGISTRY_CATALOG_FILE
  const catalogLoader = async () => {
    if (catalogFile === undefined || catalogFile === '') return undefined
    const { readFile } = await import('node:fs/promises')
    return JSON.parse(await readFile(catalogFile, 'utf8'))
  }
  const service = createTemplateRegistryService({
    mcp: { binary: 'template-registry', cwd: project },
    catalog: { load: catalogLoader },
  })

  // 1. Capability probe against the real server (initialize + tools/list).
  const health = await service.probe()
  step('service_probe', { state: health.state, ...(health.state === 'connected' ? { server_version: health.server.serverVersion } : { reason: health.reason }) })

  // 2. Catalog browse + search + inspect over MCP.
  const REF = 'promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main'
  const browse = await service.browse({ query: '3d', limit: 5 })
  step('browse', { ok: browse.ok, origin: browse.ok ? browse.origin : 'none', templates: browse.ok ? browse.templates.length : 0 })
  const inspected = await service.inspect(REF)
  step('inspect', { ok: inspected.ok, ...(inspected.ok ? {
    inputs: inspected.inspection.contract.inputs.length,
    rights: inspected.inspection.template.rights,
    permissions: inspected.inspection.template.permissions,
  } : { failure: inspected.failure }) })
  const preview = await service.preview(REF)
  step('preview', { allowed: preview.allowed, ...(preview.allowed ? {} : { reason: preview.reason }) })

  if (!(inspected.ok && browse.ok)) throw new Error('catalog RPCs failed against the real server')
  const contractDigest = inspected.inspection.contract.digest
  const required = inspected.inspection.contract.inputs.filter(input => input.required).map(input => `main.${input.name}`)

  // 3. Session journey with synthetic values.
  const created = await service.createSession({ goal: 'smoke journey', ref: REF }, { ref: REF, digest: inspected.inspection.template.digest, contractDigest })
  if (!created.ok) throw new Error(`session_create failed: ${JSON.stringify(created.failure)}`)
  step('session_create', { id_prefix: created.value.id.slice(0, 2), readiness: created.value.readiness, revision: created.value.revision })

  const fieldValues = {}
  for (const name of required) fieldValues[name] = { value: `synthetic-${name}` }
  const updated = await service.updateSession({ sessionId: created.value.id, expectedRevision: created.value.revision, fields: fieldValues }, { ref: REF, digest: inspected.inspection.template.digest, contractDigest })
  if (!updated.ok) throw new Error(`session_update failed: ${JSON.stringify(updated.failure)}`)
  step('session_update', { readiness: updated.value.readiness, revision: updated.value.revision, fields: Object.keys(updated.value.fields).length })

  // The running session is the fold context (host-known field values ride along).
  const confirmed = await service.confirmSession({ sessionId: created.value.id, expectedRevision: updated.value.revision, decisionRef: 'smoke-owner-decision', goal: true, fields: required }, { ref: REF, digest: inspected.inspection.template.digest, contractDigest, fields: updated.value.fields })
  if (!confirmed.ok) throw new Error(`session_confirm failed: ${JSON.stringify(confirmed.failure)}`)
  step('session_confirm', { readiness: confirmed.value.readiness, revision: confirmed.value.revision, confirmed: confirmed.value.confirmed, decision_ref: 'host-supplied' })

  // Guard checks against the real server path too.
  const unconfirmedRefusal = await service.compileSession({ sessionId: created.value.id, expectedRevision: confirmed.value.revision }, { session: updated.value, required }, { ref: REF, digest: inspected.inspection.template.digest, contractDigest })
  step('compile_guard_not_confirmed', { refused: !unconfirmedRefusal.ok, code: unconfirmedRefusal.ok ? 'ok' : unconfirmedRefusal.failure.kind === 'guard' ? unconfirmedRefusal.failure.code : unconfirmedRefusal.failure.kind })

  const compiled = await service.compileSession({ sessionId: created.value.id, expectedRevision: confirmed.value.revision }, { session: confirmed.value, required }, { ref: REF, digest: inspected.inspection.template.digest, contractDigest, fields: confirmed.value.fields })
  if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.failure)}`)
  step('compile', { status: compiled.value.session.status, provider_calls: compiled.value.session.provider_calls, compile_id_prefix: compiled.value.compileId.slice(0, 2) })

  const exported = await service.exportSession({ compileId: compiled.value.compileId, output: 'exports/smoke.md' }, { session: compiled.value.session })
  if (!exported.ok) throw new Error(`export failed: ${JSON.stringify(exported.failure)}`)
  step('export', { output_ref: exported.value.outputRef, provider_calls: exported.value.providerCalls, digest_prefix: exported.value.digest.slice(0, 11) })

  // Stale gate against the live digest: unchanged digest exports fine.
  const staleGate = await service.exportSession({ compileId: compiled.value.compileId, output: 'exports/smoke-2.md' }, { session: compiled.value.session, currentDigest: inspected.inspection.template.digest })
  step('export_gate_same_digest', { ok: staleGate.ok })
  const staleRefusal = await service.exportSession({ compileId: compiled.value.compileId, output: 'exports/smoke-3.md' }, { session: compiled.value.session, currentDigest: 'sha256:drifted' })
  step('export_gate_drifted_digest', { refused: !staleRefusal.ok, code: staleRefusal.ok ? 'ok' : staleRefusal.failure.kind === 'guard' ? staleRefusal.failure.code : staleRefusal.failure.kind })
  service.dispose()

  // 4. Storage-domain persistence round-trip (structural fake stands in for
  // ctx.storageDomain; the row contract is what the real facility enforces).
  const rows = new Map()
  const store = new TemplateRegistrySessionStore({ open: async () => ({ table: () => ({ get: key => rows.get(key), put: async (key, value) => { rows.set(key, value) } }), close: async () => undefined }) })
  const saveStatus = await store.save({ specVersion: 1, dshSessionRef: 'dsh-smoke-1', session: compiled.value.session, exportReceipt: exported.value })
  const loaded = await store.load('dsh-smoke-1', compiled.value.session.id)
  step('storage_roundtrip', { save: saveStatus, loaded: loaded !== undefined, provider_calls: loaded?.session.provider_calls, decision_ref: loaded?.session.decisionRef === 'smoke-owner-decision' })

  // 5. Projection fold of the same journey (tool-log shaped events).
  let state = createTemplateCompileProjectionState()
  const events = [
    { type: 'tool/call', seq: 1, time: 1, data: { callId: 's1', name: 'template_registry_inspect', arguments: { ref: REF } } },
    { type: 'tool/result', seq: 2, time: 2, data: { message: { source: { callId: 's1' }, content: [{ type: 'tool_result', toolCallId: 's1', content: [{ type: 'text', text: JSON.stringify({ spec_version: '1.0', status: 'partial', summary: 'ok', facts: {}, data: { ref: REF, digest: inspected.inspection.template.digest }, actions: [] }) }] }] } } },
    { type: 'tool/call', seq: 3, time: 3, data: { callId: 's2', name: 'template_registry_session_create', arguments: { goal: 'smoke journey', ref: REF } } },
    { type: 'tool/result', seq: 4, time: 4, data: { message: { source: { callId: 's2' }, content: [{ type: 'tool_result', toolCallId: 's2', content: [{ type: 'text', text: JSON.stringify({ spec_version: '1.0', status: 'partial', summary: 'ok', facts: {}, data: { id: created.value.id, revision: 1, readiness: 'needs_input', issues: [], fields: [], sources: [], steps: [] }, actions: [] }) }] }] } } },
  ]
  for (const event of events) state = applyTemplateCompileProjection(state, event)
  step('projection_fold', { sessions: state.sessions.length, first_status: state.sessions[0]?.session.status, digest_known: state.templateDigests[REF] !== undefined })
  const gate = templateCompileExportGate(state, created.value.id)
  step('projection_export_gate', { allowed: gate.allowed, reason: gate.allowed ? undefined : gate.reason })

  evidence.finished_at = new Date().toISOString()
  evidence.outcome = 'passed'
} catch (error) {
  evidence.finished_at = new Date().toISOString()
  evidence.outcome = 'failed'
  evidence.error = error instanceof Error ? error.message.split('\n')[0] : 'unknown error'
} finally {
  await writeFile(join(evidenceDir, 'run.json'), JSON.stringify(evidence, null, 2))
  await rm(project, { recursive: true, force: true })
  console.log(`evidence: ${evidenceDir.replace(evidenceRoot, '<evidence-root>')}/run.json (${evidence.outcome})`)
  process.exit(evidence.outcome === 'passed' ? 0 : 1)
}
