import { createHash } from 'node:crypto'
import { z } from 'zod'

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const id = z.string().regex(/^[a-z][a-z0-9._-]{0,159}$/u)
const state = z.enum(['available', 'needs_contract'])
const operation = z.object({
  contract_id: id, action: id, state,
  supports_expected_version: z.boolean(), supports_idempotency: z.boolean(), supports_receipt: z.boolean(),
  supports_status: z.boolean(), supports_reconcile: z.boolean(), supports_cancel: z.boolean(), supports_events: z.boolean(),
  reason_code: id.optional(),
}).strict()
const discovery = z.object({
  contract_id: z.literal('eikona.owner'), contract_version: z.literal('1.0.0'),
  schema_digest: digest, sdk_digest: digest, observed_at: z.string().datetime({ offset: true }),
  auth_mode: z.enum(['local_read_phase_a', 'workload_delegation']),
  capabilities: z.array(z.object({ id, state, read_only: z.boolean(), reason_code: id.optional() }).strict()).max(64),
  operations: z.array(operation).max(64),
  limits: z.object({ max_request_bytes: z.number().int().positive(), max_page_size: z.number().int().positive() }).strict(),
  retention: z.object({ event_cursor_mode: id, receipt_mode: id }).strict(),
  kill_switch: z.object({ new_mutations_enabled: z.boolean(), reads_enabled: z.boolean(), reconcile_enabled: z.boolean() }).strict(),
}).strict()

/** Host-owned admission pins; discovery is never an authorization grant. */
export function inspectEikonaDiscovery(input: unknown, pins: { schemaDigest: string; sdkDigest: string }) {
  const parsed = discovery.safeParse(input)
  if (!parsed.success) return { status: 'needs_contract' as const, reason: 'invalid_discovery', operations: [] }
  const value = parsed.data
  // Match ownerprovider.schemaIdentity field order; observed_at/auth_mode are not in its hash.
  const identity = { contract_id: value.contract_id, contract_version: value.contract_version,
    capabilities: value.capabilities, operations: value.operations, limits: value.limits,
    retention: value.retention, kill_switch: value.kill_switch }
  const actualDigest = `sha256:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`
  if (actualDigest !== value.schema_digest || value.schema_digest !== pins.schemaDigest || value.sdk_digest !== pins.sdkDigest
    || new Set(value.operations.map(item => item.action)).size !== value.operations.length
    || new Set(value.operations.map(item => item.contract_id)).size !== value.operations.length
    || new Set(value.capabilities.map(item => item.id)).size !== value.capabilities.length) {
    return { status: 'needs_contract' as const, reason: 'discovery_pin_or_identity_mismatch', operations: [] }
  }
  return {
    status: 'inspected' as const, observedAt: value.observed_at, schemaDigest: value.schema_digest,
    readsEnabled: value.kill_switch.reads_enabled,
    approvalStatusAvailable: value.auth_mode === 'workload_delegation' && value.kill_switch.reads_enabled
      && value.capabilities.some(item => item.id === 'eikona.generation.preparation.approval_status.v1' && item.state === 'available' && item.read_only),
    preparationAvailable: value.auth_mode === 'workload_delegation' && value.kill_switch.reads_enabled && value.kill_switch.new_mutations_enabled
      && value.capabilities.some(item => item.id === 'eikona.generation.preparation.v1' && item.state === 'available' && !item.read_only),
    operations: value.operations.map(item => ({
      action: item.action, contractId: item.contract_id,
      readiness: item.state === 'available' && value.auth_mode === 'workload_delegation'
        && value.kill_switch.new_mutations_enabled && value.kill_switch.reads_enabled && value.kill_switch.reconcile_enabled
        && item.supports_expected_version && item.supports_idempotency && item.supports_receipt && item.supports_status && item.supports_reconcile
        ? 'requires_authorization' as const : 'needs_contract' as const,
      reasonCode: item.reason_code,
      supportsCancel: item.supports_cancel, supportsEvents: item.supports_events,
      supportsExpectedContentDigest: item.action === 'eikona.review.decide' && item.state === 'available'
        && value.kill_switch.new_mutations_enabled
        && value.capabilities.some(capability => capability.id === 'eikona.review.expected_content_digest.v1'
          && capability.state === 'available' && !capability.read_only),
      supportsRequireNoDecision: item.action === 'eikona.review.decide' && item.state === 'available'
        && value.kill_switch.new_mutations_enabled
        && value.capabilities.some(capability => capability.id === 'eikona.review.require_no_decision.v1'
          && capability.state === 'available' && !capability.read_only),
    })),
  }
}
