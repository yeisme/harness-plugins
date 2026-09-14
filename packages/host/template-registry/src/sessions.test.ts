import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  foldRegistrySessionView,
  fromWireFieldKey,
  toWireFieldKey,
  registryCompileSession,
  registryExportCompile,
  registrySessionConfirm,
  registrySessionCreate,
  registrySessionShow,
  registrySessionUpdate,
  requiredFieldNamesFromIssues,
  sessionIssuesFromView,
} from './sessions.js'
import { TemplateRegistrySessionStore, type TemplateRegistryDomainHandle, type TemplateRegistryStorage } from './store.js'

/** Narrow a session outcome for the assertions below (failures throw). */
function expectOk<T>(outcome: { ok: true; value: T } | { ok: false; failure: unknown }): T {
  if (!outcome.ok) throw new Error(`expected ok, got ${JSON.stringify(outcome.failure)}`)
  return outcome.value
}
import { createTemplateRegistryMcpConnection } from './transport.js'
import { fixtureSpawn } from './test-support.js'

const REF = 'promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main'
const DIGEST = 'sha256:3435f85bd81ce350646f6888ecbd411203b8c5f4a6a317667f599f51f9310755'
const CONTEXT = { ref: REF, digest: DIGEST, contractDigest: 'sha256:7d994764cc454c7d98be8a0eac569aeaaa8aeca3895ff045667a02dc6cead918' }
const REQUIRED = ['main.asset_ref', 'main.intended_use']

function connection() {
  return createTemplateRegistryMcpConnection({ binary: 'template-registry' }, { spawnProcess: fixtureSpawn() })
}

const stateDirs: string[] = []
afterEach(async () => {
  delete process.env.REGISTRY_FIXTURE_CONFLICT_ONCE
  delete process.env.REGISTRY_FIXTURE_PROVIDER_CALLS
  while (stateDirs.length > 0) await rm(stateDirs.pop()!, { recursive: true, force: true })
})

describe('session view folding', () => {
  it('folds the sampled registry view onto the frozen session projection', () => {
    const session = foldRegistrySessionView({
      id: 'sea5e980fca7b1d371263c1cd2e373ef7', revision: 1, readiness: 'needs_input',
      issues: [{ code: 'GOAL_CONFIRMATION_REQUIRED' }, { code: 'INPUT_REQUIRED', field: 'main.asset_ref', step: 'main' }],
      fields: [], sources: [], steps: [{ id: 'main', status: 'ready', path: '' }],
      next_action: 'session.update', resource: 'template-registry://session/s1/state',
    }, { ...CONTEXT, fields: { 'main.asset_ref': 'asset-1' } })
    expect(session).toMatchObject({ status: 'filling', confirmed: false, readiness: 'needs_input', revision: 1, nextAction: 'session.update' })
    expect(session!.fields['main.asset_ref']).toBe('asset-1')
    expect(session!.provider_calls).toBe(0)
  })
  it('fails closed on views without identity or with unknown readiness', () => {
    expect(foldRegistrySessionView({ revision: 1, readiness: 'needs_input' }, CONTEXT)).toBeUndefined()
    expect(foldRegistrySessionView({ id: 's1', revision: 1, readiness: 'mystery' }, CONTEXT)).toBeUndefined()
  })
  it('learns the wire step ids from the view steps (4.1 field-key translation)', () => {
    const session = foldRegistrySessionView({
      id: 'sea5e980fca7b1d371263c1cd2e373ef7', revision: 1, readiness: 'needs_input',
      issues: [], fields: [], sources: [],
      steps: [{ id: 'main', status: 'ready', path: '' }, { id: 'main', status: 'ready', path: '' }, { id: 'other', status: 'ready', path: '' }],
      next_action: 'session.update',
    }, CONTEXT)
    expect(session!.stepIds).toEqual(['main', 'other'])
    // Without view steps the context-supplied ids survive (host memory path).
    const remembered = foldRegistrySessionView({
      id: 's2', revision: 1, readiness: 'needs_input', issues: [], fields: [], sources: [], steps: [],
    }, { ...CONTEXT, stepIds: ['main'] })
    expect(remembered!.stepIds).toEqual(['main'])
  })
  it('translates contract-name keys to the <step>.<name> wire form and back', () => {
    const steps = ['main']
    expect(toWireFieldKey('asset_ref', steps)).toBe('main.asset_ref')
    expect(toWireFieldKey('main.asset_ref', steps)).toBe('main.asset_ref')
    expect(toWireFieldKey('asset_ref', undefined)).toBe('asset_ref')
    expect(toWireFieldKey('asset_ref', [])).toBe('asset_ref')
    expect(fromWireFieldKey('main.asset_ref', steps)).toBe('asset_ref')
    expect(fromWireFieldKey('main.asset_ref', ['other'])).toBe('main.asset_ref')
    expect(fromWireFieldKey('asset_ref', steps)).toBe('asset_ref')
  })
  it('extracts the required wire field names from INPUT issues', () => {
    const issues = sessionIssuesFromView({ issues: [{ code: 'GOAL_CONFIRMATION_REQUIRED' }, { code: 'INPUT_REQUIRED', field: 'main.asset_ref' }, { code: 'INPUT_CONFIRMATION_REQUIRED', field: 'main.intended_use' }, { code: 'INPUT_REQUIRED', field: 'main.asset_ref' }] })
    expect(requiredFieldNamesFromIssues(issues)).toEqual(['main.asset_ref', 'main.intended_use'])
  })
})

describe('compile journey over the real spawned synthetic fixture (2.3)', () => {
  it('runs create → update → confirm → compile → export with provider_calls=0 asserted', async () => {
    const conn = connection()
    const created = await registrySessionCreate(conn, { goal: 'review the candidate asset', ref: REF }, CONTEXT)
    expect(created.ok).toBe(true)
    const session = expectOk(created)
    expect(session.status).toBe('filling')
    expect(session.confirmed).toBe(false)

    // Missing fields and missing confirmation both refuse BEFORE the wire.
    const earlyCompile = await registryCompileSession(conn, { sessionId: session.id, expectedRevision: session.revision }, { session, required: REQUIRED }, CONTEXT)
    expect(earlyCompile).toMatchObject({ ok: false, failure: { kind: 'guard', code: 'not_confirmed' } })

    // The running session is the fold context: host-known field values ride along.
    const updated = await registrySessionUpdate(conn, {
      sessionId: session.id, expectedRevision: session.revision,
      fields: { 'main.asset_ref': { value: 'asset-1' }, 'main.intended_use': { value: 'internal review' } },
    }, { ...CONTEXT, fields: session.fields })
    expect(updated.ok).toBe(true)
    const updatedSession = expectOk(updated)
    expect(updatedSession.status).toBe('confirming')
    expect(updatedSession.fields['main.asset_ref']).toBe('asset-1')
    // Host-known field values survive the fold (the registry never echoes them).
    expect(updatedSession.confirmedKeys).toEqual([])

    // An empty decision ref is refused before the wire: the host never self-approves.
    expect(await registrySessionConfirm(conn, { sessionId: session.id, expectedRevision: updatedSession.revision, decisionRef: ' ' }, CONTEXT))
      .toMatchObject({ ok: false, failure: { kind: 'guard', code: 'invalid_input' } })

    const confirmed = await registrySessionConfirm(conn, {
      sessionId: session.id, expectedRevision: updatedSession.revision, decisionRef: 'owner-decision-1', goal: true, fields: REQUIRED,
    }, { ...CONTEXT, fields: updatedSession.fields })
    expect(confirmed.ok).toBe(true)
    const confirmedSession = expectOk(confirmed)
    expect(confirmedSession.status).toBe('ready')
    expect(confirmedSession.confirmed).toBe(true)
    expect(confirmedSession.decisionRef).toBe('owner-decision-1')

    // Still-armed guard with a required field missing refuses with the list.
    const partial = { ...confirmedSession, fields: { ...confirmedSession.fields, 'main.intended_use': '' } }
    expect(await registryCompileSession(conn, { sessionId: session.id, expectedRevision: confirmedSession.revision }, { session: partial, required: REQUIRED }, CONTEXT))
      .toMatchObject({ ok: false, failure: { kind: 'guard', code: 'missing_fields', missing: ['main.intended_use'] } })

    const compiled = await registryCompileSession(conn, { sessionId: session.id, expectedRevision: confirmedSession.revision }, { session: confirmedSession, required: REQUIRED }, { ...CONTEXT, fields: confirmedSession.fields })
    expect(compiled.ok).toBe(true)
    const compile = expectOk(compiled)
    expect(compile.session.status).toBe('compiled')
    expect(compile.session.provider_calls).toBe(0)
    expect(compile.compileId.startsWith('c')).toBe(true)

    const exported = await registryExportCompile(conn, { compileId: compile.compileId, output: 'exports/review.md' }, { session: compile.session })
    expect(exported.ok).toBe(true)
    const receipt = expectOk(exported)
    expect(receipt).toMatchObject({ compileId: compile.compileId, providerCalls: 0 })
    // Owner-relative display reference only; never an absolute path.
    expect(receipt.outputRef).toBe('exports/review.md')
    expect(receipt.outputRef.startsWith('/')).toBe(false)
    conn.dispose()
  }, 20000)

  it('fails closed when the owner reports a nonzero provider_calls', async () => {
    process.env.REGISTRY_FIXTURE_PROVIDER_CALLS = '1'
    const conn = connection()
    const created = expectOk(await registrySessionCreate(conn, { goal: 'g', ref: REF }, CONTEXT))
    const updated = expectOk(await registrySessionUpdate(conn, {
      sessionId: created.id, expectedRevision: created.revision,
      fields: { 'main.asset_ref': { value: 'a' }, 'main.intended_use': { value: 'b' } },
    }, { ...CONTEXT, fields: created.fields }))
    const confirmed = expectOk(await registrySessionConfirm(conn, { sessionId: created.id, expectedRevision: updated.revision, decisionRef: 'owner-decision-2', goal: true, fields: REQUIRED }, { ...CONTEXT, fields: updated.fields }))
    const compiled = await registryCompileSession(conn, { sessionId: created.id, expectedRevision: confirmed.revision }, { session: confirmed, required: REQUIRED }, { ...CONTEXT, fields: confirmed.fields })
    expect(compiled).toMatchObject({ ok: false, failure: { kind: 'guard', code: 'provider_calls_nonzero' } })
    conn.dispose()
  }, 15000)

  it('surfaces REVISION_CONFLICT with the re-read latest revision and never retries the write', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-template-registry-cas-'))
    stateDirs.push(dir)
    process.env.REGISTRY_FIXTURE_CONFLICT_ONCE = join(dir, 'conflict-once')
    const conn = connection()
    const created = expectOk(await registrySessionCreate(conn, { goal: 'g', ref: REF }, CONTEXT))
    // The fixture returns REVISION_CONFLICT once and bumps its revision to 2.
    const conflicted = await registrySessionUpdate(conn, {
      sessionId: created.id, expectedRevision: created.revision, fields: { 'main.asset_ref': { value: 'a' } },
    }, CONTEXT)
    expect(conflicted).toMatchObject({ ok: false, failure: { kind: 'revision_conflict' } })
    if (!conflicted.ok && conflicted.failure.kind === 'revision_conflict') {
      // The host re-READ the latest view: the caller can re-derive its edit.
      expect(conflicted.failure.latest?.revision).toBe(2)
    }
    // The independent readonly show channel agrees with the re-read.
    const shown = await registrySessionShow(conn, created.id, CONTEXT)
    expect(shown.ok && shown.value.revision).toBe(2)
    conn.dispose()
  }, 15000)

  it('refuses export before compile and on digest drift (stale gate)', async () => {
    const conn = connection()
    const created = expectOk(await registrySessionCreate(conn, { goal: 'g', ref: REF }, CONTEXT))
    // Not compiled: export refused even with a compile id.
    expect(await registryExportCompile(conn, { compileId: 'c1', output: 'exports/x.md' }, { session: created }))
      .toMatchObject({ ok: false, failure: { kind: 'guard', code: 'not_compiled' } })
    // Digest drift: the template moved on since the session pinned it.
    const compiledSession = { ...created, status: 'compiled' as const }
    expect(await registryExportCompile(conn, { compileId: 'c1', output: 'exports/x.md' }, { session: compiledSession, currentDigest: 'sha256:moved-on' }))
      .toMatchObject({ ok: false, failure: { kind: 'guard', code: 'stale_digest' } })
    conn.dispose()
  }, 15000)

  it('accepts pane-canonical (unprefixed) field keys by translating them onto the wire (4.1 real-binary finding)', async () => {
    const conn = connection()
    const created = await registrySessionCreate(conn, { goal: 'pane flow', ref: REF }, CONTEXT)
    const session = expectOk(created)
    expect(session.stepIds).toEqual(['main'])
    // The pane submits contract input names; the host prefixes them with the
    // learned step id. Without translation the fixture (like the real owner)
    // answers FIELD_INVALID.
    const direct = await registrySessionUpdate(conn, {
      sessionId: session.id, expectedRevision: session.revision,
      fields: { asset_ref: { value: 'asset-9' } },
    }, { ...CONTEXT, fields: session.fields })
    expect(direct).toMatchObject({ ok: false, failure: { kind: 'registry_error', code: 'FIELD_INVALID' } })
    const updated = await registrySessionUpdate(conn, {
      sessionId: session.id, expectedRevision: session.revision,
      fields: { asset_ref: { value: 'asset-9' }, intended_use: { value: 'review pass' } },
    }, { ...CONTEXT, fields: session.fields, stepIds: session.stepIds })
    expect(updated.ok).toBe(true)
    const updatedSession = expectOk(updated)
    // The merged projection stays contract-name canonical (pane keys), not wire keys.
    expect(updatedSession.fields).toMatchObject({ asset_ref: 'asset-9', intended_use: 'review pass' })
    const confirmed = await registrySessionConfirm(conn, {
      sessionId: session.id, expectedRevision: updatedSession.revision, decisionRef: 'owner-decision-2', goal: true,
      fields: ['asset_ref', 'intended_use'],
    }, { ...CONTEXT, fields: updatedSession.fields, stepIds: updatedSession.stepIds })
    expect(confirmed.ok).toBe(true)
    expect(expectOk(confirmed).confirmed).toBe(true)
  })
})

describe('storage domain persistence (yeisme_template_registry_v1)', () => {
  function fakeStorage(rows = new Map<string, unknown>()): TemplateRegistryStorage & { opens: number; closes: number } {
    const stats = { opens: 0, closes: 0 }
    const handle: TemplateRegistryDomainHandle = {
      table: () => ({
        get: key => rows.get(key),
        put: async (key, value) => { rows.set(key, value) },
      }),
      close: async () => { stats.closes += 1 },
    }
    return {
      open: async () => { stats.opens += 1; return handle },
      get opens() { return stats.opens },
      get closes() { return stats.closes },
    }
  }

  function row(overrides: Record<string, unknown> = {}) {
    return {
      specVersion: 1 as const,
      dshSessionRef: 'dsh-session-1',
      session: {
        id: 's146abbbae84205569f057fed6aa32c88', ref: REF, digest: DIGEST, status: 'compiled' as const,
        fields: { 'main.asset_ref': 'asset-1' }, confirmed: true, provider_calls: 0 as const,
        updatedAt: '2026-09-14T00:00:00.000Z', revision: 3, readiness: 'ready_to_compile' as const,
        confirmedKeys: ['main.asset_ref'], contractDigest: CONTEXT.contractDigest, decisionRef: 'owner-decision-1',
        stepIds: ['main'],
      },
      ...overrides,
    }
  }

  it('round-trips compile rows with the recovery contract and export receipt', async () => {
    const storage = fakeStorage()
    const store = new TemplateRegistrySessionStore(storage)
    const receipt = { compileId: 'c1', digest: 'sha256:pkg', outputRef: 'exports/review.md', providerCalls: 0 as const, exportedAt: '2026-09-14T00:01:00.000Z' }
    expect(await store.save({ ...row(), exportReceipt: receipt })).toBe('saved')
    const loaded = await store.load('dsh-session-1', 's146abbbae84205569f057fed6aa32c88')
    expect(loaded?.session.decisionRef).toBe('owner-decision-1')
    expect(loaded?.session.confirmedKeys).toEqual(['main.asset_ref'])
    expect(loaded?.exportReceipt?.providerCalls).toBe(0)
    // The persisted row carries the recovery contract (digests + revision).
    expect(loaded?.session.contractDigest).toBe(CONTEXT.contractDigest)
  })

  it('scopes rows per DSH session (cross-session isolation)', async () => {
    const storage = fakeStorage()
    const store = new TemplateRegistrySessionStore(storage)
    await store.save(row())
    await store.save(row({ dshSessionRef: 'dsh-session-2' }))
    expect(await store.load('dsh-session-1', 's146abbbae84205569f057fed6aa32c88')).toBeDefined()
    expect(await store.load('dsh-session-2', 's146abbbae84205569f057fed6aa32c88')).toBeDefined()
    // A different registry session id under the same DSH session is absent.
    expect(await store.load('dsh-session-1', 'sother')).toBeUndefined()
  })

  it('opens the domain once (single-open discipline) and serializes writes', async () => {
    const storage = fakeStorage()
    const store = new TemplateRegistrySessionStore(storage)
    await Promise.all([
      store.save(row({ dshSessionRef: 'a' })),
      store.save(row({ dshSessionRef: 'b' })),
      store.save(row({ dshSessionRef: 'c' })),
    ])
    expect(storage.opens).toBe(1)
    await store.close()
    expect(storage.closes).toBe(1)
    // close() is final: later saves degrade honestly.
    expect(await store.save(row())).toBe('unavailable')
    expect(await store.load('dsh-session-1', 's146abbbae84205569f057fed6aa32c88')).toBeUndefined()
  })

  it('fails closed on contract-invalid rows (never stored, never loaded)', async () => {
    const storage = fakeStorage()
    const store = new TemplateRegistrySessionStore(storage)
    // provider_calls must be literal 0; a nonzero value violates the row contract.
    const invalid = row({ session: { ...row().session, provider_calls: 3 as unknown as 0 } })
    expect(await store.save(invalid)).toBe('unavailable')
    // A shape-drifted persisted row fails closed on load.
    const rows = new Map<string, unknown>([['dsh-session-1 s146abbbae84205569f057fed6aa32c88', { garbage: true }]])
    const drifted = new TemplateRegistrySessionStore(fakeStorage(rows))
    expect(await drifted.load('dsh-session-1', 's146abbbae84205569f057fed6aa32c88')).toBeUndefined()
  })
})
