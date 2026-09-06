/**
 * Additive consumer for Scaena's canonical OPC scene-package projection.
 *
 * This module intentionally lives beside the frozen legacy DSH OPC adapter.
 * It copies owner identity for cross-entry verification and does not translate
 * canonical enums into the legacy DSH schema or synthesize owner state.
 */

export const SCAENA_CANONICAL_OPC_SCENE_PACKAGE_SUMMARY_SCHEMA =
  'scaena.opc.scene_package_summary.v1alpha1' as const

export type ScaenaCanonicalOpcFreshness = 'fresh' | 'stale' | 'unknown'
export type ScaenaCanonicalOpcSurfaceState =
  | 'needs_input'
  | 'empty'
  | 'blocked'
  | 'stale'
  | 'partial'
  | 'review'
  | 'export_ready'
  | 'ready'
export type ScaenaCanonicalOpcGateId =
  | 'direction_confirm'
  | 'visual_foundation_accept'
  | 'export_confirm'
export type ScaenaCanonicalOpcGateState = 'pending' | 'satisfied' | 'blocked'
export type ScaenaCanonicalOpcSideEffectClass =
  | 'none'
  | 'local_state'
  | 'external_write'
  | 'paid'

export interface ScaenaCanonicalOpcHumanGateV1 {
  readonly gateId: ScaenaCanonicalOpcGateId
  readonly state: ScaenaCanonicalOpcGateState
  readonly receiptRef?: string
  readonly blockerCodes?: readonly string[]
  readonly requiredRef?: string
}

export interface ScaenaCanonicalOpcActionDescriptorV1 {
  readonly actionId: string
  readonly owner: 'scaena'
  readonly ownerAuthority: string
  readonly permission: string
  readonly expectedVersion: string
  readonly idempotencyRequired: boolean
  readonly targetRef: string
  readonly reconcileRef?: string
  readonly sideEffectClass: ScaenaCanonicalOpcSideEffectClass
  readonly confirmationRequired: boolean
}

export interface ScaenaCanonicalOpcScenePackageSummaryV1alpha1 {
  readonly contractVersion: typeof SCAENA_CANONICAL_OPC_SCENE_PACKAGE_SUMMARY_SCHEMA
  readonly projectRef: string
  readonly episodeRef: string
  readonly sceneRef?: string
  readonly packageRef: string
  readonly packageVersion: string
  readonly surfaceState: ScaenaCanonicalOpcSurfaceState
  readonly currentStage: string
  readonly freshness: ScaenaCanonicalOpcFreshness
  readonly humanGates: readonly ScaenaCanonicalOpcHumanGateV1[]
  readonly primaryAction?: ScaenaCanonicalOpcActionDescriptorV1
  readonly receiptRefs: readonly string[]
  readonly observedAtUnixMs: number
}

export interface ScaenaCanonicalOpcCrossEntryIdentityV1 {
  readonly packageRef: string
  readonly packageVersion: string
  readonly primaryAction?: ScaenaCanonicalOpcActionDescriptorV1
  readonly gateReceipts: Readonly<Partial<Record<ScaenaCanonicalOpcGateId, string>>>
  readonly receiptRefs: readonly string[]
  readonly reconcileRef?: string
}

/** Compared identity fields for one canonical package revision. */
export interface ScaenaCanonicalOpcCrossEntryComparedV1 {
  readonly packageRef: string
  readonly packageVersion: string
  readonly actionId: string
  readonly targetRef: string
  readonly expectedVersion: string
  readonly sideEffectClass: ScaenaCanonicalOpcSideEffectClass
  readonly confirmationRequired: boolean
  readonly idempotencyRequired: boolean
  readonly gateReceipts: Readonly<Partial<Record<ScaenaCanonicalOpcGateId, string | undefined>>>
  readonly receiptRefs: readonly string[]
  readonly reconcileRef?: string
}

export interface ScaenaCanonicalOpcCrossEntryVerificationV1 {
  readonly identity: ScaenaCanonicalOpcCrossEntryIdentityV1
  readonly compared: ScaenaCanonicalOpcCrossEntryComparedV1
}

export class ScaenaCanonicalOpcContractError extends Error {
  constructor(detail: string) {
    super(`scaena_opc_contract_mismatch: ${detail}`)
    this.name = 'ScaenaCanonicalOpcContractError'
  }
}

const refPattern = /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,255}$/
const controlCharacters = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/
const unsafeText = /\bbearer |begin private key|api-key:|authorization:/i
const forbiddenField = /(?:^|_)(?:token|secret|credential|password|api[_-]?key|raw[_-]?prompt|provider[_-]?payload|private[_-]?path)(?:_|$)/i
const forbiddenRef = /^(?:authorization|bearer|password|secret|token|api[_-]?key|raw[_-]?prompt|provider[_-]?payload|private[_-]?path|blob)(?::|$)/i
const freshnesses = new Set<ScaenaCanonicalOpcFreshness>(['fresh', 'stale', 'unknown'])
const surfaceStates = new Set<ScaenaCanonicalOpcSurfaceState>([
  'needs_input',
  'empty',
  'blocked',
  'stale',
  'partial',
  'review',
  'export_ready',
  'ready',
])
const gateIds = new Set<ScaenaCanonicalOpcGateId>([
  'direction_confirm',
  'visual_foundation_accept',
  'export_confirm',
])
const gateStates = new Set<ScaenaCanonicalOpcGateState>(['pending', 'satisfied', 'blocked'])
const sideEffectClasses = new Set<ScaenaCanonicalOpcSideEffectClass>([
  'none',
  'local_state',
  'external_write',
  'paid',
])

function mismatch(detail: string): never {
  throw new ScaenaCanonicalOpcContractError(detail)
}

function plain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function camelOf(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase())
}

function rawField(source: Record<string, unknown>, snake: string): unknown {
  if (Object.prototype.hasOwnProperty.call(source, snake)) return source[snake]
  return source[camelOf(snake)]
}

function assertNoForbiddenFields(value: unknown, path = 'summary'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFields(item, `${path}[${index}]`))
    return
  }
  if (!plain(value)) return
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenField.test(key)) mismatch(`${path} carries forbidden field ${key}`)
    assertNoForbiddenFields(item, `${path}.${key}`)
  }
}

function opaque(value: unknown, name: string): string {
  if (typeof value !== 'string' || !refPattern.test(value) || forbiddenRef.test(value)) {
    mismatch(`${name} must be a safe opaque ref`)
  }
  return value
}

function optionalOpaque(value: unknown, name: string): string | undefined {
  return value === undefined || value === null || value === '' ? undefined : opaque(value, name)
}

function safeText(value: unknown, name: string, maxLength = 128): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    controlCharacters.test(value) ||
    /\r|\n/.test(value) ||
    unsafeText.test(value)
  ) {
    mismatch(`${name} must be safe one-line text`)
  }
  return value
}

function enumValue<T extends string>(value: unknown, allowed: ReadonlySet<T>, name: string): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) mismatch(`${name} is outside its closed enum`)
  return value as T
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') mismatch(`${name} must be boolean`)
  return value
}

function timestampMs(value: unknown, name: string): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return mismatch(`${name} must be a positive timestamp`)
}

function refList(value: unknown, name: string, maxLength: number): readonly string[] {
  if (!Array.isArray(value) || value.length > maxLength) mismatch(`${name} must be a bounded ref list`)
  return value.map((entry, index) => opaque(entry, `${name}[${index}]`))
}

function normalizeGate(value: unknown, index: number): ScaenaCanonicalOpcHumanGateV1 {
  if (!plain(value)) mismatch(`human_gates[${index}] must be an object`)
  const receiptRef = optionalOpaque(rawField(value, 'receipt_ref'), `human_gates[${index}].receipt_ref`)
  const requiredRef = optionalOpaque(rawField(value, 'required_ref'), `human_gates[${index}].required_ref`)
  const blockerValue = rawField(value, 'blocker_codes')
  const blockerCodes =
    blockerValue === undefined || blockerValue === null
      ? undefined
      : refList(blockerValue, `human_gates[${index}].blocker_codes`, 16)
  const state = enumValue(rawField(value, 'state'), gateStates, `human_gates[${index}].state`)
  if (state === 'satisfied' && receiptRef === undefined) mismatch(`human_gates[${index}] is satisfied without receipt_ref`)
  return {
    gateId: enumValue(rawField(value, 'gate_id'), gateIds, `human_gates[${index}].gate_id`),
    state,
    ...(receiptRef === undefined ? {} : { receiptRef }),
    ...(blockerCodes === undefined ? {} : { blockerCodes }),
    ...(requiredRef === undefined ? {} : { requiredRef }),
  }
}

function normalizeAction(value: unknown): ScaenaCanonicalOpcActionDescriptorV1 {
  if (!plain(value)) mismatch('primary_action must be an object')
  if (rawField(value, 'owner') !== 'scaena') mismatch('primary_action.owner must be scaena')
  const reconcileRef = optionalOpaque(rawField(value, 'reconcile_ref'), 'primary_action.reconcile_ref')
  return {
    actionId: opaque(rawField(value, 'action_id'), 'primary_action.action_id'),
    owner: 'scaena',
    ownerAuthority: opaque(rawField(value, 'owner_authority'), 'primary_action.owner_authority'),
    permission: safeText(rawField(value, 'permission'), 'primary_action.permission', 32),
    expectedVersion: opaque(rawField(value, 'expected_version'), 'primary_action.expected_version'),
    idempotencyRequired: booleanValue(rawField(value, 'idempotency_required'), 'primary_action.idempotency_required'),
    targetRef: opaque(rawField(value, 'target_ref'), 'primary_action.target_ref'),
    ...(reconcileRef === undefined ? {} : { reconcileRef }),
    sideEffectClass: enumValue(
      rawField(value, 'side_effect_class'),
      sideEffectClasses,
      'primary_action.side_effect_class',
    ),
    confirmationRequired: booleanValue(rawField(value, 'confirmation_required'), 'primary_action.confirmation_required'),
  }
}

/** Normalize only canonical owner facts required for DSH cross-entry identity. */
export function normalizeScaenaCanonicalOpcScenePackageSummary(
  input: unknown,
): ScaenaCanonicalOpcScenePackageSummaryV1alpha1 {
  if (!plain(input)) mismatch('summary must be an object')
  assertNoForbiddenFields(input)
  if (rawField(input, 'schema_version') !== SCAENA_CANONICAL_OPC_SCENE_PACKAGE_SUMMARY_SCHEMA) {
    mismatch('schema_version is unsupported')
  }
  const packageVersion = rawField(input, 'package_version')
  if (typeof packageVersion !== 'number' || !Number.isSafeInteger(packageVersion) || packageVersion < 0) {
    mismatch('package_version must be a non-negative integer')
  }
  const gatesValue = rawField(input, 'human_gates')
  if (!Array.isArray(gatesValue) || gatesValue.length > 8) mismatch('human_gates must be a bounded list')
  const humanGates = gatesValue.map(normalizeGate)
  if (new Set(humanGates.map(gate => gate.gateId)).size !== humanGates.length) {
    mismatch('human_gates contains a duplicate gate_id')
  }
  const primaryActionValue = rawField(input, 'primary_action')
  const receiptRefsValue = rawField(input, 'receipt_refs')
  const sceneRef = optionalOpaque(rawField(input, 'scene_ref'), 'scene_ref')
  return {
    contractVersion: SCAENA_CANONICAL_OPC_SCENE_PACKAGE_SUMMARY_SCHEMA,
    projectRef: opaque(rawField(input, 'project_ref'), 'project_ref'),
    episodeRef: opaque(rawField(input, 'episode_ref'), 'episode_ref'),
    ...(sceneRef === undefined ? {} : { sceneRef }),
    packageRef: opaque(rawField(input, 'package_ref'), 'package_ref'),
    packageVersion: String(packageVersion),
    surfaceState: enumValue(rawField(input, 'surface_state'), surfaceStates, 'surface_state'),
    currentStage: safeText(rawField(input, 'current_stage'), 'current_stage'),
    freshness: enumValue(rawField(input, 'freshness'), freshnesses, 'freshness'),
    humanGates,
    ...(primaryActionValue === undefined || primaryActionValue === null
      ? {}
      : { primaryAction: normalizeAction(primaryActionValue) }),
    receiptRefs:
      receiptRefsValue === undefined || receiptRefsValue === null
        ? []
        : refList(receiptRefsValue, 'receipt_refs', 64),
    observedAtUnixMs: timestampMs(rawField(input, 'observed_at'), 'observed_at'),
  }
}

/** Copy canonical cross-entry identity without recomputation or enum mapping. */
export function projectScaenaCanonicalOpcCrossEntryIdentity(
  summary: ScaenaCanonicalOpcScenePackageSummaryV1alpha1,
): ScaenaCanonicalOpcCrossEntryIdentityV1 {
  const gateReceipts: Partial<Record<ScaenaCanonicalOpcGateId, string>> = {}
  for (const gate of summary.humanGates) {
    if (gate.receiptRef !== undefined) gateReceipts[gate.gateId] = gate.receiptRef
  }
  return {
    packageRef: summary.packageRef,
    packageVersion: summary.packageVersion,
    ...(summary.primaryAction === undefined ? {} : { primaryAction: summary.primaryAction }),
    gateReceipts,
    receiptRefs: summary.receiptRefs,
    ...(summary.primaryAction?.reconcileRef === undefined
      ? {}
      : { reconcileRef: summary.primaryAction.reconcileRef }),
  }
}

function equalIdentity(field: string, actual: unknown, wanted: unknown): void {
  if (actual !== wanted) mismatch(`${field} mismatch: expected=${String(wanted)} actual=${String(actual)}`)
}

function findCanonicalSummaryCase(
  fixture: Record<string, unknown>,
  packageRef: string,
  packageVersion: unknown,
): Record<string, unknown> {
  const cases = fixture.cases
  if (!Array.isArray(cases)) mismatch('fixture.cases must be an array')
  const match = cases.find(candidate => {
    if (!plain(candidate) || candidate.kind !== 'summary' || !plain(candidate.payload)) return false
    return (
      rawField(candidate.payload, 'package_ref') === packageRef &&
      rawField(candidate.payload, 'package_version') === packageVersion
    )
  })
  if (!plain(match) || !plain(match.payload)) {
    mismatch('fixture has no canonical summary for dsh_expectations package revision')
  }
  return match.payload
}

/**
 * Compare one fixture-authored package revision through the shipped adapter.
 * Path I/O stays in the CLI; this function is pure and does not persist state.
 */
export function verifyScaenaCanonicalOpcCrossEntryConformance(
  fixture: unknown,
): ScaenaCanonicalOpcCrossEntryVerificationV1 {
  if (!plain(fixture)) mismatch('fixture must be an object')
  const expected = fixture.dsh_expectations
  if (!plain(expected)) mismatch('fixture is missing dsh_expectations')
  const packageRef = opaque(expected.package_ref, 'dsh_expectations.package_ref')
  const packageVersion = expected.package_version
  const payload = findCanonicalSummaryCase(fixture, packageRef, packageVersion)
  const identity = projectScaenaCanonicalOpcCrossEntryIdentity(
    normalizeScaenaCanonicalOpcScenePackageSummary(payload),
  )
  equalIdentity('package_ref', identity.packageRef, packageRef)
  equalIdentity('package_version', identity.packageVersion, String(packageVersion))

  const expectedAction = expected.expected_action
  if (!plain(expectedAction)) mismatch('fixture or DSH projection is missing expected_action')
  const action = identity.primaryAction
  if (action === undefined) mismatch('fixture or DSH projection is missing expected_action')
  equalIdentity('action_id', action.actionId, expectedAction.action_id)
  equalIdentity('target_ref', action.targetRef, expectedAction.target_ref)
  equalIdentity('expected_version', action.expectedVersion, expectedAction.expected_version)
  equalIdentity('side_effect_class', action.sideEffectClass, expectedAction.side_effect_class)
  equalIdentity('confirmation_required', action.confirmationRequired, expectedAction.confirmation_required)
  equalIdentity('idempotency_required', action.idempotencyRequired, expectedAction.idempotency_required)

  const expectedGates = expected.expected_gate_receipts
  const comparedGates: Partial<Record<ScaenaCanonicalOpcGateId, string | undefined>> = {
    ...identity.gateReceipts,
  }
  if (expectedGates !== undefined) {
    if (!plain(expectedGates)) mismatch('expected_gate_receipts must be an object')
    for (const [gateId, receiptRef] of Object.entries(expectedGates)) {
      const wanted = receiptRef === null ? undefined : receiptRef
      equalIdentity(`gate_receipt.${gateId}`, identity.gateReceipts[gateId as ScaenaCanonicalOpcGateId], wanted)
    }
  }

  if (expected.expected_receipt_refs !== undefined) {
    if (!Array.isArray(expected.expected_receipt_refs)) mismatch('expected_receipt_refs must be a list')
    equalIdentity(
      'receipt_refs',
      identity.receiptRefs.join('|'),
      expected.expected_receipt_refs.map(entry => String(entry)).join('|'),
    )
  }
  if (expectedAction.reconcile_ref !== undefined) {
    equalIdentity('reconcile_ref', identity.reconcileRef, expectedAction.reconcile_ref)
  }

  return {
    identity,
    compared: {
      packageRef: identity.packageRef,
      packageVersion: identity.packageVersion,
      actionId: action.actionId,
      targetRef: action.targetRef,
      expectedVersion: action.expectedVersion,
      sideEffectClass: action.sideEffectClass,
      confirmationRequired: action.confirmationRequired,
      idempotencyRequired: action.idempotencyRequired,
      gateReceipts: comparedGates,
      receiptRefs: identity.receiptRefs,
      ...(identity.reconcileRef === undefined ? {} : { reconcileRef: identity.reconcileRef }),
    },
  }
}
