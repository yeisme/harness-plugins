#!/usr/bin/env node
/**
 * SYNTHETIC fixture only — this is NOT the real template-registry owner.
 *
 * A minimal stdio MCP server used by the unit tests to exercise the
 * fixed-argv host path (`template-registry mcp serve`) end to end with a
 * REAL spawned process. It speaks just enough newline-delimited JSON-RPC:
 * initialize → notifications/initialized → tools/list → tools/call over the
 * frozen nine-tool consumption set, with envelope shapes sampled from the
 * real server (spec_version 1.0, status, facts, data, error{code,retryable}).
 * All payloads are synthetic fixtures.
 *
 * Deterministic knobs (radar's market-stdio-server pattern):
 * - REGISTRY_FIXTURE_STATE_FILE: when set, the FIRST tools/call exits the
 *   process without answering (simulating an owner disconnect); the state
 *   file records that the drop already happened, so a fresh process serves.
 * - REGISTRY_FIXTURE_OMIT_TOOL: remove one tool from tools/list (drives the
 *   tools_missing probe outcome).
 * - REGISTRY_FIXTURE_CONFLICT_ONCE: the first session mutation returns
 *   REVISION_CONFLICT and bumps the revision to 2 (the re-read then shows
 *   revision 2 — the CAS recovery journey).
 * - REGISTRY_FIXTURE_PROVIDER_CALLS: report this value as compile
 *   provider_calls (default 0) to drive the fail-closed contract guard.
 */
import { writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
if (JSON.stringify(argv) !== JSON.stringify(['mcp', 'serve'])) {
  process.stderr.write('synthetic fixture expects the frozen TEMPLATE_REGISTRY_FIXED_ARGV\n')
  process.exit(2)
}

const TOOLS = [
  'template_registry_list',
  'template_registry_search',
  'template_registry_inspect',
  'template_registry_session_create',
  'template_registry_session_show',
  'template_registry_session_update',
  'template_registry_session_confirm',
  'template_registry_compile',
  'template_registry_export',
  ...(process.env.REGISTRY_FIXTURE_OMIT_TOOL ? [] : ['template_registry_doctor', 'template_registry_repository_list']),
].filter(tool => tool !== process.env.REGISTRY_FIXTURE_OMIT_TOOL)

const REF = 'promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main'
const DIGEST = 'sha256:3435f85bd81ce350646f6888ecbd411203b8c5f4a6a317667f599f51f9310755'
const CONTRACT_DIGEST = 'sha256:7d994764cc454c7d98be8a0eac569aeaaa8aeca3895ff045667a02dc6cead918'

const CONTRACT_INPUTS = [
  { name: 'asset_ref', type: 'string', required: true, min_length: 1, max_length: 500, labels: { en: 'Asset reference', 'zh-CN': '资产引用' }, descriptions: { en: 'Pointer to the candidate asset under review', 'zh-CN': '被评审的候选资产引用' } },
  { name: 'intended_use', type: 'string', required: true, min_length: 1, max_length: 2000, labels: { en: 'Intended use', 'zh-CN': '预期用途' }, descriptions: { en: 'Use the asset is reviewed for' } },
  { name: 'scene_context_ref', type: 'string', max_length: 500, labels: { en: 'Scene context ref' } },
]

function browseRecord() {
  return {
    ref: REF, digest: DIGEST, title: '3D asset review checklist',
    summary: 'Review a candidate 3D asset across geometry integrity, UV and texture, scale consistency, and rights.',
    tags: ['category:3d', 'job:critic_review'], capabilities: ['model3d', 'review'], category: '3d',
    repository: 'official', solution: '3d-asset-review-beta', role: 'main', locale: 'en', version: '1.0.0-beta.1',
    rights: 'internal', maturity: 'exploratory', compiler_status: 'not_checked', source_state: 'ready',
    media: ['3d'], consumers: ['unknown'], search_aliases: ['3d 资产评审'],
  }
}

function sessionView(id, revision, readiness, issues, fields) {
  return {
    id, revision, readiness, issues,
    fields: fields.map(field => ({ key: field.key, kind: field.kind ?? 'proposal', confirmed: field.confirmed ?? false })),
    sources: [], steps: [{ id: 'main', status: 'ready', path: '' }],
    next_action: readiness === 'needs_input' ? 'session.update' : readiness === 'needs_confirmation' ? 'session.confirm' : readiness === 'ready_to_compile' ? 'compile' : 'inspect',
    resource: `template-registry://session/${id}/state`,
  }
}

const envelope = (status, summary, facts, data, error) => ({
  spec_version: '1.0', mode: 'json', status, summary, facts, data, ...(error === undefined ? {} : { error }), actions: [], retryable: false,
})

// --- deterministic one-shot knobs -------------------------------------------
let dropped = false
if (process.env.REGISTRY_FIXTURE_STATE_FILE) {
  try { writeFileSync(process.env.REGISTRY_FIXTURE_STATE_FILE, 'dropped', { flag: 'wx' }); dropped = true } catch { /* already dropped once */ }
}
let conflictApplied = false
if (process.env.REGISTRY_FIXTURE_CONFLICT_ONCE) {
  try { writeFileSync(process.env.REGISTRY_FIXTURE_CONFLICT_ONCE, 'conflict', { flag: 'wx' }); conflictApplied = true } catch { /* already applied */ }
}

// --- synthetic session state (one session per process) ----------------------
let session = undefined // { id, revision, readiness, fields[], confirmedKeys[] }

function handleCall(name, args) {
  if (name === 'template_registry_list') {
    return envelope('success', '1 repository; 1 solution matched.', { entries: 1, solutions: 1 },
      { solutions: [{ repository_id: 'official', package_id: '3d', id: '3d-asset-review-beta', version: '1.0.0-beta.1', templates: [browseRecord()] }] })
  }
  if (name === 'template_registry_search') {
    if (Object.keys(args).some(key => !['query', 'locale', 'tags', 'required_capabilities', 'include_incompatible'].includes(key))) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'INPUT_INVALID', message: 'INPUT_INVALID', retryable: false })
    }
    return envelope('success', '1 solution matched.', { solutions: 1 },
      { solutions: [{ repository_id: 'official', package_id: '3d', id: '3d-asset-review-beta', version: '1.0.0-beta.1', templates: [browseRecord()] }] })
  }
  if (name === 'template_registry_inspect') {
    if (args.ref !== REF) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'TEMPLATE_CONTRACT_REQUIRED', message: 'TEMPLATE_CONTRACT_REQUIRED', retryable: false })
    }
    return envelope('partial', 'Template inspected; required inputs are not ready.',
      { digest: DIGEST, next_action: { kind: 'supply_inputs', required_inputs: ['asset_ref', 'intended_use'] } },
      {
        origin: 'file', ref: REF, version: '1.0.0-beta.1', digest: DIGEST, locale: 'en', role: 'main',
        rights: 'internal', trust: 'reviewed', maturity: 'exploratory', tags: ['category:3d'], capabilities: ['model3d', 'review'],
        title: '3D asset review checklist', summary: 'Review a candidate 3D asset.', usage: 'English-compiled beta; reviews report findings.',
        inputs: CONTRACT_INPUTS.map(definition => ({ definition, status: 'missing' })),
        contract: { digest: CONTRACT_DIGEST, inputs: CONTRACT_INPUTS, license: 'internal', permissions: ['execute_requires_review', 'preview'] },
        issues: [], next_action: { kind: 'supply_inputs', required_inputs: ['asset_ref', 'intended_use'] },
        compiler_status: 'contract_available', ready: false,
      })
  }
  if (name === 'template_registry_session_create') {
    const id = 's' + 'f'.repeat(31) + '1'
    session = { id, revision: 1, readiness: 'needs_input', fields: [] }
    return envelope('partial', 'Session saved; follow the reported next action.',
      { id, next_action: 'session.update', readiness: 'needs_input', revision: 1 },
      sessionView(id, 1, 'needs_input', [
        { code: 'GOAL_CONFIRMATION_REQUIRED' },
        { code: 'INPUT_REQUIRED', field: 'main.asset_ref', step: 'main' },
        { code: 'INPUT_REQUIRED', field: 'main.intended_use', step: 'main' },
      ], []))
  }
  if (name === 'template_registry_session_show') {
    if (session === undefined || args.session_id !== session.id) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'SESSION_NOT_FOUND', message: 'SESSION_NOT_FOUND', retryable: false })
    }
    return envelope('partial', 'Session saved; follow the reported next action.',
      { id: session.id, next_action: sessionView(session.id, session.revision, session.readiness, [], session.fields).next_action, readiness: session.readiness, revision: session.revision },
      sessionView(session.id, session.revision, session.readiness, [], session.fields))
  }
  if (name === 'template_registry_session_update') {
    if (session === undefined || args.session_id !== session.id) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'SESSION_NOT_FOUND', message: 'SESSION_NOT_FOUND', retryable: false })
    }
    // Owner rule (mirrors the real compile.go knownField): wire field keys are
    // `<step-id>.<contract-input-name>`; anything else is FIELD_INVALID.
    const known = new Set(CONTRACT_INPUTS.map(input => `main.${input.name}`))
    for (const key of Object.keys(args.fields ?? {})) {
      if (!known.has(key)) {
        return envelope('failed', 'Operation failed.', {}, undefined, { code: 'FIELD_INVALID', message: 'FIELD_INVALID', retryable: false })
      }
    }
    if (conflictApplied) {
      conflictApplied = false
      session.revision = 2
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'REVISION_CONFLICT', message: 'The session changed. Read its latest revision before applying this edit again.', retryable: false })
    }
    if (args.expected_revision !== session.revision) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'REVISION_CONFLICT', message: 'The session changed.', retryable: false })
    }
    session.revision += 1
    session.readiness = 'needs_confirmation'
    session.fields = Object.keys(args.fields ?? {}).map(key => ({ key, kind: 'user', confirmed: false }))
    return envelope('partial', 'Session saved; follow the reported next action.',
      { id: session.id, next_action: 'session.confirm', readiness: session.readiness, revision: session.revision },
      sessionView(session.id, session.revision, session.readiness, [
        { code: 'GOAL_CONFIRMATION_REQUIRED' },
        { code: 'INPUT_CONFIRMATION_REQUIRED', field: 'main.asset_ref', step: 'main' },
        { code: 'INPUT_CONFIRMATION_REQUIRED', field: 'main.intended_use', step: 'main' },
      ], session.fields))
  }
  if (name === 'template_registry_session_confirm') {
    if (session === undefined || args.session_id !== session.id) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'SESSION_NOT_FOUND', message: 'SESSION_NOT_FOUND', retryable: false })
    }
    if (args.expected_revision !== session.revision) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'REVISION_CONFLICT', message: 'The session changed.', retryable: false })
    }
    session.revision += 1
    session.readiness = 'ready_to_compile'
    for (const field of session.fields) field.confirmed = true
    return envelope('success', 'Operation completed.',
      { id: session.id, next_action: 'compile', readiness: session.readiness, revision: session.revision },
      sessionView(session.id, session.revision, session.readiness, [], session.fields))
  }
  if (name === 'template_registry_compile') {
    if (session === undefined || args.session_id !== session.id) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'SESSION_NOT_FOUND', message: 'SESSION_NOT_FOUND', retryable: false })
    }
    if (args.expected_revision !== session.revision) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'REVISION_CONFLICT', message: 'The session changed.', retryable: false })
    }
    const compileId = 'c' + 'a'.repeat(31) + '1'
    const providerCalls = Number(process.env.REGISTRY_FIXTURE_PROVIDER_CALLS ?? '0')
    return envelope('success', 'Operation completed.',
      { digest: 'sha256:dd8abda237611087e36b59f28ceeb25011f04b4284e1f5aa4706569163bbe36e', id: compileId, provider_calls: providerCalls, revision: session.revision, session_id: session.id },
      { id: compileId, session_id: session.id, revision: session.revision, digest: 'sha256:dd8abda237611087e36b59f28ceeb25011f04b4284e1f5aa4706569163bbe36e', steps: [{ id: 'main', status: 'ready', path: 'prompts/main.txt' }], provider_calls: providerCalls, stale: false })
  }
  if (name === 'template_registry_export') {
    if (!String(args.compile_id ?? '').startsWith('c')) {
      return envelope('failed', 'Operation failed.', {}, undefined, { code: 'COMPILE_NOT_FOUND', message: 'COMPILE_NOT_FOUND', retryable: false })
    }
    return envelope('success', 'Operation completed.',
      { digest: 'sha256:dd8abda237611087e36b59f28ceeb25011f04b4284e1f5aa4706569163bbe36e', id: 'e' + 'b'.repeat(31) + '1', output: args.output },
      { id: 'e' + 'b'.repeat(31) + '1', compile_id: args.compile_id, digest: 'sha256:dd8abda237611087e36b59f28ceeb25011f04b4284e1f5aa4706569163bbe36e', mode: 'portable', output: args.output, file_count: 4, stale: false })
  }
  return envelope('failed', 'Operation failed.', {}, undefined, { code: 'INPUT_INVALID', message: `unknown tool ${name}`, retryable: false })
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => {
  buffer += chunk
  let index
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim()
    buffer = buffer.slice(index + 1)
    if (line === '') continue
    let frame
    try { frame = JSON.parse(line) } catch { continue }
    if (typeof frame.id !== 'number') continue // notifications are ignored
    if (frame.method === 'initialize') {
      respond(frame.id, {
        capabilities: { logging: {}, resources: { listChanged: true }, tools: { listChanged: true } },
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'template-registry', version: 'template-registry.prompt-compiler.v0.2' },
      })
      continue
    }
    if (frame.method === 'tools/list') {
      respond(frame.id, { tools: TOOLS.map(name => ({ name, description: `synthetic ${name}`, inputSchema: { type: 'object', properties: {} } })) })
      // A tools_missing fixture exits after answering so the NEXT probe
      // spawns a fresh process (modeling a restarted/upgraded owner).
      if (process.env.REGISTRY_FIXTURE_OMIT_TOOL) setTimeout(() => process.exit(0), 20)
      continue
    }
    if (frame.method === 'tools/call') {
      if (dropped) { process.exit(3) } // deterministic one-shot owner disconnect
      const name = frame.params?.name
      const args = frame.params?.arguments ?? {}
      const call = handleCall(name, args)
      respond(frame.id, {
        content: [{ type: 'text', text: JSON.stringify(call) }],
        isError: call.status === 'failed',
      })
      continue
    }
    respond(frame.id, undefined, { code: -32601, message: 'method not found' })
  }
})

function respond(id, result, error) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...(error === undefined ? { result } : { error }) }) + '\n')
}
