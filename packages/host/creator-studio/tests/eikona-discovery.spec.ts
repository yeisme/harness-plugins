import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { inspectEikonaDiscovery } from '../src/eikona-discovery.ts'
const pins = { schemaDigest: `sha256:${'a'.repeat(64)}`, sdkDigest: `sha256:${'b'.repeat(64)}` }
function fixture() {
  const value = { contract_id: 'eikona.owner', contract_version: '1.0.0', schema_digest: pins.schemaDigest, sdk_digest: pins.sdkDigest,
    observed_at: '2026-09-08T00:00:00Z', auth_mode: 'workload_delegation', capabilities: [] as Array<{ id: string; state: string; read_only: boolean }>,
    operations: [{ contract_id: 'eikona.generation.submit.v1', action: 'eikona.generation.submit', state: 'available',
      supports_expected_version: true, supports_idempotency: true, supports_receipt: true, supports_status: true,
      supports_reconcile: true, supports_cancel: true, supports_events: true }],
    limits: { max_request_bytes: 1048576, max_page_size: 200 }, retention: { event_cursor_mode: 'opaque_resumable', receipt_mode: 'durable_owner_lookup' },
    kill_switch: { new_mutations_enabled: true, reads_enabled: true, reconcile_enabled: true } }
  seal(value)
  return value
}
function seal(value: ReturnType<typeof fixture>) {
  const { contract_id, contract_version, capabilities, operations, limits, retention, kill_switch } = value
  value.schema_digest = `sha256:${createHash('sha256').update(JSON.stringify({ contract_id, contract_version, capabilities, operations, limits, retention, kill_switch })).digest('hex')}`
}
function admit(value: ReturnType<typeof fixture>) {
  return inspectEikonaDiscovery(value, { ...pins, schemaDigest: value.schema_digest })
}
describe('Eikona discovery admission', () => {
  it('recognizes approval recovery with writes disabled but refuses missing or invalid declarations', () => {
    const value = fixture()
    value.kill_switch.new_mutations_enabled = false
    value.capabilities.push({ id: 'eikona.generation.preparation.approval_status.v1', state: 'available', read_only: true })
    seal(value)
    expect(admit(value)).toMatchObject({ status: 'inspected', approvalStatusAvailable: true })
    value.kill_switch.reads_enabled = false
    seal(value)
    expect(admit(value)).toMatchObject({ approvalStatusAvailable: false })
    value.kill_switch.reads_enabled = true
    value.capabilities[0]!.read_only = false
    seal(value)
    expect(admit(value)).toMatchObject({ approvalStatusAvailable: false })
    value.capabilities[0]!.read_only = true
    expect(admit(value).status).toBe('needs_contract')
  })
  it('keeps content and first-decision support independent and requires pinned mutation declarations', () => {
    const value = fixture()
    value.operations[0]!.action = 'eikona.review.decide'
    value.operations[0]!.contract_id = 'eikona.review.decide.v1'
    value.capabilities.push({ id: 'eikona.review.expected_content_digest.v1', state: 'available', read_only: false })
    seal(value)
    const enabled = admit(value).operations[0]
    expect(enabled?.supportsExpectedContentDigest).toBe(true)
    expect(enabled?.supportsRequireNoDecision).toBe(false)
    expect(enabled?.readiness).toBe('requires_authorization')
    for (const change of ['disabled', 'read-only', 'wrong-action', 'switch']) {
      const altered = structuredClone(value)
      if (change === 'disabled') altered.capabilities[0]!.state = 'needs_contract'
      if (change === 'read-only') altered.capabilities[0]!.read_only = true
      if (change === 'wrong-action') altered.operations[0]!.action = 'eikona.generation.submit'
      if (change === 'switch') altered.kill_switch.new_mutations_enabled = false
      seal(altered)
      expect(admit(altered).operations[0]?.supportsExpectedContentDigest).toBe(false)
    }
  })
  it('recognizes first-decision support only from a pinned matching mutation capability', () => {
    const value = fixture()
    value.operations[0]!.action = 'eikona.review.decide'
    value.operations[0]!.contract_id = 'eikona.review.decide.v1'
    seal(value)
    expect(admit(value).operations[0]?.supportsRequireNoDecision).toBe(false)
    value.capabilities.push({ id: 'eikona.review.require_no_decision.v1', state: 'available', read_only: false })
    seal(value)
    expect(admit(value).operations[0]?.supportsRequireNoDecision).toBe(true)
    expect(admit(value).operations[0]?.readiness).toBe('requires_authorization')
    for (const change of ['disabled', 'read-only', 'wrong-action', 'switch']) {
      const altered = structuredClone(value)
      if (change === 'disabled') altered.capabilities[0]!.state = 'needs_contract'
      if (change === 'read-only') altered.capabilities[0]!.read_only = true
      if (change === 'wrong-action') altered.operations[0]!.action = 'eikona.generation.submit'
      if (change === 'switch') altered.kill_switch.new_mutations_enabled = false
      seal(altered)
      expect(admit(altered).operations[0]?.supportsRequireNoDecision).toBe(false)
    }
  })
  it('requires independent authorization even for a fully backed operation', () => {
    expect(admit(fixture()).operations[0]?.readiness).toBe('requires_authorization')
  })
  it('retains disabled actions for Phase A, kill switches and missing recovery', () => {
    for (const change of ['phase', 'mutation', 'read', 'reconcile', 'receipt']) {
      const value = fixture()
      if (change === 'phase') value.auth_mode = 'local_read_phase_a'
      if (change === 'mutation') value.kill_switch.new_mutations_enabled = false
      if (change === 'read') value.kill_switch.reads_enabled = false
      if (change === 'reconcile') value.operations[0]!.supports_reconcile = false
      if (change === 'receipt') value.operations[0]!.supports_receipt = false
      seal(value)
      expect(admit(value).operations[0]?.readiness).toBe('needs_contract')
    }
  })
  it('rejects content changed under an unchanged pin while timestamps remain independent', () => {
    const value = fixture()
    const trusted = { ...pins, schemaDigest: value.schema_digest }
    value.observed_at = '2026-09-08T01:00:00Z'
    expect(inspectEikonaDiscovery(value, trusted).status).toBe('inspected')
    value.operations[0]!.supports_cancel = false
    expect(inspectEikonaDiscovery(value, trusted).status).toBe('needs_contract')
  })
  it('rejects drift and duplicate identities without exposing payloads', () => {
    const duplicate = fixture(); duplicate.operations.push(duplicate.operations[0]!)
    for (const input of [duplicate, { ...fixture(), schema_digest: `sha256:${'c'.repeat(64)}` }, { ...fixture(), secret: 'PRIVATE_SENTINEL' }]) {
      const result = inspectEikonaDiscovery(input, pins)
      expect(result.status).toBe('needs_contract'); expect(result.operations).toEqual([])
      expect(JSON.stringify(result)).not.toContain('PRIVATE_SENTINEL')
    }
  })
})
