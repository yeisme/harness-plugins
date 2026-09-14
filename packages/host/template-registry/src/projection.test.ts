import { describe, expect, it } from 'vitest'
import {
  TEMPLATE_COMPILE_PROJECTION_KEY,
  applyTemplateCompileProjection,
  createTemplateCompileProjectionDefinition,
  createTemplateCompileProjectionState,
  registerTemplateCompileProjection,
  templateCompileExportGate,
  templateCompileStateSchema,
  templateCompileWireSchema,
  type TemplateCompileProjectionEvent,
  type TemplateCompileProjectionState,
} from './projection.js'

const REF = 'promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main'
const DIGEST = 'sha256:3435f85bd81ce350646f6888ecbd411203b8c5f4a6a317667f599f51f9310755'
const DRIFTED_DIGEST = 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
const SESSION_ID = 's146abbbae84205569f057fed6aa32c88'

function view(readiness: string, revision: number, fields: { key: string; confirmed: boolean }[] = []) {
  return { id: SESSION_ID, revision, readiness, issues: [], fields, sources: [], steps: [], next_action: 'compile', resource: `template-registry://session/${SESSION_ID}/state` }
}

function envelope(data: unknown, facts: Record<string, unknown> = {}, status = 'success') {
  return JSON.stringify({ spec_version: '1.0', mode: 'json', status, summary: 'ok', facts, data, actions: [], retryable: false })
}

/** The harness-shaped tool/result event: the envelope text nests inside the model-visible tool result message. */
function toolResult(callId: string, text: string, seq: number): TemplateCompileProjectionEvent {
  return {
    type: 'tool/result', seq, time: seq * 1000,
    data: { message: { source: { callId }, content: [{ type: 'tool_result', toolCallId: callId, content: [{ type: 'text', text }] }] } },
  }
}

function toolCall(callId: string, name: string, args: Record<string, unknown>, seq: number): TemplateCompileProjectionEvent {
  return { type: 'tool/call', seq, time: seq * 1000, data: { callId, name, arguments: args } }
}

/** Full folded journey: inspect → create → update → confirm → compile → export. */
function foldJourney(driftDigest?: string): TemplateCompileProjectionState {
  let state = createTemplateCompileProjectionState()
  state = applyTemplateCompileProjection(state, toolCall('c1', 'template_registry_inspect', { ref: REF }, 1))
  state = applyTemplateCompileProjection(state, toolResult('c1', envelope({ ref: REF, digest: driftDigest ?? DIGEST, contract: { digest: 'sha256:c' } }), 2))
  state = applyTemplateCompileProjection(state, toolCall('c2', 'template_registry_session_create', { goal: 'review', ref: REF }, 3))
  state = applyTemplateCompileProjection(state, toolResult('c2', envelope(view('needs_input', 1), { id: SESSION_ID, readiness: 'needs_input', revision: 1 }, 'partial'), 4))
  state = applyTemplateCompileProjection(state, toolCall('c3', 'template_registry_session_update', {
    session_id: SESSION_ID, expected_revision: 1,
    fields: { 'main.asset_ref': { value: 'asset-1', kind: 'user', confirmed: false }, 'main.intended_use': { value: 'review', kind: 'user', confirmed: false } },
  }, 5))
  state = applyTemplateCompileProjection(state, toolResult('c3', envelope(view('needs_confirmation', 2, [{ key: 'main.asset_ref', confirmed: false }, { key: 'main.intended_use', confirmed: false }])), 6))
  state = applyTemplateCompileProjection(state, toolCall('c4', 'template_registry_session_confirm', { session_id: SESSION_ID, expected_revision: 2, decision_ref: 'owner-decision-1', goal: true, fields: ['main.asset_ref', 'main.intended_use'] }, 7))
  state = applyTemplateCompileProjection(state, toolResult('c4', envelope(view('ready_to_compile', 3, [{ key: 'main.asset_ref', confirmed: true }, { key: 'main.intended_use', confirmed: true }])), 8))
  state = applyTemplateCompileProjection(state, toolCall('c5', 'template_registry_compile', { session_id: SESSION_ID, expected_revision: 3 }, 9))
  state = applyTemplateCompileProjection(state, toolResult('c5', envelope(view('ready_to_compile', 3), { id: 'c11bff3165f76491b39c5bfc47903db96', digest: 'sha256:pkg', provider_calls: 0, revision: 3, session_id: SESSION_ID }), 10))
  return state
}

/** Journey folded up to confirm (ready) without the compile pair. */
function foldJourneyWithoutCompile(): TemplateCompileProjectionState {
  let state = createTemplateCompileProjectionState()
  state = applyTemplateCompileProjection(state, toolCall('d1', 'template_registry_inspect', { ref: REF }, 1))
  state = applyTemplateCompileProjection(state, toolResult('d1', envelope({ ref: REF, digest: DIGEST }), 2))
  state = applyTemplateCompileProjection(state, toolCall('d2', 'template_registry_session_create', { goal: 'review', ref: REF }, 3))
  state = applyTemplateCompileProjection(state, toolResult('d2', envelope(view('ready_to_compile', 3, [{ key: 'main.asset_ref', confirmed: true }])), 4))
  return state
}

describe('templateRegistryCompile projection fold (2.4)', () => {
  it('folds the full tool-log journey into one recovery-contract entry', () => {
    const state = foldJourney()
    expect(state.sessions).toHaveLength(1)
    const entry = state.sessions[0]!
    expect(entry.session).toMatchObject({
      id: SESSION_ID, ref: REF, digest: DIGEST, status: 'compiled', confirmed: true,
      revision: 3, readiness: 'ready_to_compile', decisionRef: 'owner-decision-1',
      fields: { 'main.asset_ref': 'asset-1', 'main.intended_use': 'review' },
      provider_calls: 0,
    })
    expect(entry.compileId).toBe('c11bff3165f76491b39c5bfc47903db96')
    expect(state.pendingCalls).toEqual({})
  })

  it('strips the learned step prefix from wire field keys (pane-canonical restore, 4.1)', () => {
    let state = createTemplateCompileProjectionState()
    state = applyTemplateCompileProjection(state, toolCall('w1', 'template_registry_inspect', { ref: REF }, 1))
    state = applyTemplateCompileProjection(state, toolResult('w1', envelope({ ref: REF, digest: DIGEST }), 2))
    state = applyTemplateCompileProjection(state, toolCall('w2', 'template_registry_session_create', { goal: 'review', ref: REF }, 3))
    // The real owner view carries steps[]: the fold learns the step ids.
    state = applyTemplateCompileProjection(state, toolResult('w2', envelope({ ...view('needs_input', 1), steps: [{ id: 'main', status: 'ready', path: '' }] }, { id: SESSION_ID, readiness: 'needs_input', revision: 1 }, 'partial'), 4))
    expect(state.sessions[0]!.session.stepIds).toEqual(['main'])
    // Wire traffic addresses fields as `<step>.<name>`; the restored session
    // stays contract-name canonical so the reopened pane matches its drafts.
    state = applyTemplateCompileProjection(state, toolCall('w3', 'template_registry_session_update', {
      session_id: SESSION_ID, expected_revision: 1,
      fields: { 'main.asset_ref': { value: 'asset-7', kind: 'user', confirmed: false } },
    }, 5))
    state = applyTemplateCompileProjection(state, toolResult('w3', envelope(view('needs_confirmation', 2, [{ key: 'main.asset_ref', confirmed: false }])), 6))
    expect(state.sessions[0]!.session.fields).toEqual({ asset_ref: 'asset-7' })
  })

  it('returns the SAME state reference for unrelated events (Object.is change gate)', () => {
    const state = foldJourney()
    for (const event of [
      { type: 'user/message', seq: 50, time: 1 },
      { type: 'tool/call', seq: 51, time: 1, data: { callId: 'x', name: 'other_tool', arguments: {} } },
      { type: 'tool/result', seq: 52, time: 1, data: { message: { source: { callId: 'unknown' }, content: [] } } },
      { type: 'tool/call', seq: 53, time: 1, data: { name: 'template_registry_compile' } }, // no callId
    ] as TemplateCompileProjectionEvent[]) {
      expect(applyTemplateCompileProjection(state, event)).toBe(state)
    }
  })

  it('consumes armed calls fail-closed when the result carries no owner envelope', () => {
    let state = createTemplateCompileProjectionState()
    state = applyTemplateCompileProjection(state, toolCall('c1', 'template_registry_session_create', { goal: 'g', ref: REF }, 1))
    const corrupted = applyTemplateCompileProjection(state, toolResult('c1', 'not json', 2))
    // The armed call is consumed but nothing is folded (no fabricated session).
    expect(corrupted.pendingCalls['c1']).toBeUndefined()
    expect(corrupted.sessions).toHaveLength(0)
  })

  it('skips session_create folds without a known digest (honest gap, never guessed)', () => {
    let state = createTemplateCompileProjectionState()
    state = applyTemplateCompileProjection(state, toolCall('c1', 'template_registry_session_create', { goal: 'g', ref: REF }, 1))
    state = applyTemplateCompileProjection(state, toolResult('c1', envelope(view('needs_input', 1), { id: SESSION_ID, revision: 1 }, 'partial'), 2))
    expect(state.sessions).toHaveLength(0)
  })

  it('folds nothing for a compile whose owner reported provider_calls != 0', () => {
    let state = foldJourneyWithoutCompile()
    state = applyTemplateCompileProjection(state, toolCall('c5', 'template_registry_compile', { session_id: SESSION_ID, expected_revision: 3 }, 9))
    state = applyTemplateCompileProjection(state, toolResult('c5', envelope(view('ready_to_compile', 3), { id: 'cviol', provider_calls: 2, revision: 3 }), 10))
    const entry = state.sessions[0]!
    expect(entry.compileId).toBeUndefined()
    expect(entry.session.status).toBe('ready')
  })

  it('attaches the export receipt only for the matching compile id', () => {
    let state = foldJourney()
    state = applyTemplateCompileProjection(state, toolCall('c6', 'template_registry_export', { compile_id: 'wrong-id', output: 'exports/x.md' }, 12))
    state = applyTemplateCompileProjection(state, toolResult('c6', envelope({}, { digest: 'sha256:pkg', output: 'exports/x.md' }), 13))
    expect(state.sessions[0]!.exportReceipt).toBeUndefined()
    state = applyTemplateCompileProjection(state, toolCall('c7', 'template_registry_export', { compile_id: 'c11bff3165f76491b39c5bfc47903db96', output: 'exports/review.md' }, 14))
    state = applyTemplateCompileProjection(state, toolResult('c7', envelope({}, { digest: 'sha256:pkg', output: 'exports/review.md' }), 15))
    expect(state.sessions[0]!.exportReceipt).toMatchObject({ compileId: 'c11bff3165f76491b39c5bfc47903db96', outputRef: 'exports/review.md', providerCalls: 0 })
    expect(state.sessions[0]!.session.status).toBe('exported')
  })

})

describe('export gate: digest-stale detection (2.4)', () => {
  it('allows export for a compiled session whose pinned digest still matches', () => {
    const gate = templateCompileExportGate(foldJourney(), SESSION_ID)
    expect(gate).toMatchObject({ allowed: true })
  })
  it('disables export when the template digest drifted (re-pin required)', () => {
    // The session pinned the digest observed at creation; a LATER inspect
    // fold recorded a newer digest for the same exact ref.
    let state = foldJourney()
    state = applyTemplateCompileProjection(state, toolCall('c8', 'template_registry_inspect', { ref: REF }, 20))
    state = applyTemplateCompileProjection(state, toolResult('c8', envelope({ ref: REF, digest: DRIFTED_DIGEST }), 21))
    expect(state.templateDigests[REF]).toBe(DRIFTED_DIGEST)
    const gate = templateCompileExportGate(state, SESSION_ID)
    expect(gate).toMatchObject({ allowed: false, reason: 'digest_stale' })
  })
  it('explains unknown sessions, uncompiled sessions, and finished packages', () => {
    expect(templateCompileExportGate(createTemplateCompileProjectionState(), 'smissing')).toMatchObject({ allowed: false, reason: 'unknown_session' })
    const ready = foldJourneyWithoutCompile()
    expect(templateCompileExportGate(ready, SESSION_ID)).toMatchObject({ allowed: false, reason: 'not_compiled' })
    let exported = foldJourney()
    exported = applyTemplateCompileProjection(exported, toolCall('c6', 'template_registry_export', { compile_id: 'c11bff3165f76491b39c5bfc47903db96', output: 'exports/review.md' }, 12))
    exported = applyTemplateCompileProjection(exported, toolResult('c6', envelope({}, { digest: 'sha256:pkg', output: 'exports/review.md' }), 13))
    expect(templateCompileExportGate(exported, SESSION_ID)).toMatchObject({ allowed: false, reason: 'already_exported' })
  })
})

describe('projection unit contract', () => {
  it('keeps the state plain JSON (persisted-cache precondition)', () => {
    const state = foldJourney()
    const json = JSON.parse(JSON.stringify(state)) // throws on undefined-valued properties? No — but lossy round-trips must parse.
    expect(templateCompileStateSchema.safeParse(json).success).toBe(true)
    expect(JSON.stringify(state)).not.toContain('undefined')
    void json
  })
  it('serves the bounded wire view and validates against its schema', () => {
    const definition = createTemplateCompileProjectionDefinition()
    expect(definition.key).toBe(TEMPLATE_COMPILE_PROJECTION_KEY)
    expect(definition.stateVersion).toBe(1)
    const view = definition.wire.view(foldJourney())
    expect(templateCompileWireSchema.safeParse(view).success).toBe(true)
    expect(view.sessions[0]!.session.id).toBe(SESSION_ID)
    // Host-side fold material (digest map, pending calls) never rides the wire.
    expect('templateDigests' in view).toBe(false)
    expect('pendingCalls' in view).toBe(false)
    expect(definition.stateSchema.safeParse(foldJourney()).success).toBe(true)
  })
  it('registers through the structural sessionProjections face', () => {
    const registered: unknown[] = []
    registerTemplateCompileProjection({ register: definition => { registered.push(definition); return () => undefined } })
    expect(registered).toHaveLength(1)
    expect(registered[0]).toMatchObject({ key: 'templateRegistryCompile', stateVersion: 1 })
  })
  it('bounds the sessions ring (newest first, oldest trimmed)', () => {
    let state = createTemplateCompileProjectionState()
    for (let index = 0; index < 12; index += 1) {
      state = applyTemplateCompileProjection(state, toolCall(`i${index}`, 'template_registry_inspect', { ref: `promptrepo://official/x/x${index}@1` }, index * 2))
      state = applyTemplateCompileProjection(state, toolResult(`i${index}`, envelope({ ref: `promptrepo://official/x/x${index}@1`, digest: `sha256:d${index}` }), index * 2))
      state = applyTemplateCompileProjection(state, toolCall(`s${index}`, 'template_registry_session_create', { goal: 'g', ref: `promptrepo://official/x/x${index}@1` }, index * 2 + 1))
      state = applyTemplateCompileProjection(state, toolResult(`s${index}`, envelope({ ...view('needs_input', 1), id: `s${index}` }, { id: `s${index}` }, 'partial'), index * 2 + 1))
    }
    expect(state.sessions.length).toBeLessThanOrEqual(8)
    if (state.sessions.length > 0) expect(state.sessions[0]!.session.id).toBe('s11')
  })
})
