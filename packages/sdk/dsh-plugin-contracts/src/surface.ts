import type { BoundedSummary, ProjectionFreshness } from './projection.js'
import type { ProbeResult } from './probe.js'

export const DSH_PLUGIN_SURFACE_CONTRACT_V1 = 'dsh.plugin.surface.v1' as const

export type DshPluginSurfaceContractVersionV1 = typeof DSH_PLUGIN_SURFACE_CONTRACT_V1
export type DshPluginSurfaceTargetV1 = 'web' | 'tui'
export type DshPluginViewKindV1 = 'status' | 'list' | 'table' | 'detail' | 'timeline' | 'diff'
export type DshPluginActionEffectV1 = 'read' | 'mutation' | 'external_write' | 'danger'
export type DshPluginActionRiskV1 = 'low' | 'medium' | 'high' | 'critical'
export type DshPluginPreviewPolicyV1 = 'none' | 'owner_preview_required'
export type DshPluginContributionStatusV1 = 'available' | 'degraded' | 'disabled'
export type DshPluginActionReceiptStatusV1 = 'applied' | 'cancelled' | 'stale' | 'conflict' | 'failed' | 'unknown'
export type DshPluginSafeScalarV1 = string | number | boolean | null

export interface DshPluginProjectionRowV1 {
  readonly id: string
  readonly ref?: string
  readonly summary?: BoundedSummary
  readonly scalars?: Readonly<Record<string, DshPluginSafeScalarV1>>
}

/**
 * 宿主渲染的安全投影。这里只允许固定元数据、有界摘要、标量和有界行；
 * HTML、React/DOM、ANSI、回调和任意 renderer 不属于合同。
 */
export interface DshPluginSafeProjectionV1 {
  readonly revision: string
  readonly freshness: ProjectionFreshness
  readonly ref?: string
  readonly evidence_ref?: string
  readonly summary?: BoundedSummary
  readonly scalars?: Readonly<Record<string, DshPluginSafeScalarV1>>
  readonly rows?: readonly DshPluginProjectionRowV1[]
}

export interface DshPluginCommandContributionV1 {
  readonly id: string
  readonly canonical_name: string
  readonly aliases: readonly string[]
  readonly owner: string
  readonly action_kind: string
  readonly available: boolean
  readonly disabled_reason_code?: string
}

export interface DshPluginViewContributionV1 {
  readonly id: string
  readonly owner: string
  readonly kind: DshPluginViewKindV1
  readonly title: string
  readonly projection: DshPluginSafeProjectionV1
}

export interface DshPluginActionContributionV1 {
  readonly id: string
  readonly owner: string
  readonly label: string
  readonly effect: DshPluginActionEffectV1
  readonly risk: DshPluginActionRiskV1
  readonly preview_policy: DshPluginPreviewPolicyV1
  readonly action_ref: string
  readonly expected_revision: string
  readonly available: boolean
  readonly disabled_reason_code?: string
}

export interface DshPluginContributionHealthV1 {
  readonly status: DshPluginContributionStatusV1
  readonly stage: string
  readonly code: string
  readonly reason: string
  readonly fix: string
  readonly last_checked: string
  readonly receipt_ref?: string
}

export interface DshPluginActionReceiptV1 {
  readonly contract_version: DshPluginSurfaceContractVersionV1
  readonly action_id: string
  readonly action_ref: string
  readonly owner: string
  readonly status: DshPluginActionReceiptStatusV1
  readonly revision: string
  readonly receipt_ref: string
  readonly reason_code?: string
  readonly evidence_ref?: string
}

export interface DshPluginSurfaceContributionV1 {
  readonly contract_version: DshPluginSurfaceContractVersionV1
  readonly id: string
  readonly owner: string
  readonly generation: number
  readonly surfaces: readonly DshPluginSurfaceTargetV1[]
  readonly commands: readonly DshPluginCommandContributionV1[]
  readonly views: readonly DshPluginViewContributionV1[]
  readonly actions: readonly DshPluginActionContributionV1[]
  readonly health: DshPluginContributionHealthV1
  readonly dispose_ref: string
}

export type DshPluginSurfaceDecodeErrorCodeV1 =
  | 'surface.invalid_shape'
  | 'surface.unknown_version'
  | 'surface.unknown_view_kind'
  | 'surface.unknown_enum'
  | 'surface.out_of_bounds'
  | 'surface.sensitive_field'
  | 'surface.private_path'
  | 'surface.renderer_forbidden'

export type DshPluginSurfaceDecodeResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: DshPluginSurfaceDecodeErrorCodeV1; readonly reason: string }

const VIEW_KINDS = new Set<DshPluginViewKindV1>(['status', 'list', 'table', 'detail', 'timeline', 'diff'])
const TARGETS = new Set<DshPluginSurfaceTargetV1>(['web', 'tui'])
const EFFECTS = new Set<DshPluginActionEffectV1>(['read', 'mutation', 'external_write', 'danger'])
const RISKS = new Set<DshPluginActionRiskV1>(['low', 'medium', 'high', 'critical'])
const PREVIEW_POLICIES = new Set<DshPluginPreviewPolicyV1>(['none', 'owner_preview_required'])
const HEALTH_STATUSES = new Set<DshPluginContributionStatusV1>(['available', 'degraded', 'disabled'])
const RECEIPT_STATUSES = new Set<DshPluginActionReceiptStatusV1>(['applied', 'cancelled', 'stale', 'conflict', 'failed', 'unknown'])
const FRESHNESS = new Set<ProjectionFreshness>(['fresh', 'stale', 'unknown'])
const SENSITIVE_KEY = /(?:authorization|cookie|credential|password|provider_payload|raw_argv|raw_prompt|secret|system_prompt|token)/i
const FORBIDDEN_RENDERER_KEY = /(?:ansi|callback|component|dom|html|react|renderer|render_fn)/i
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|root|private|var|workspaces)(?:\/|$))/
const MAX_ID = 160
const MAX_TEXT = 4096
const MAX_COLLECTION = 128
const MAX_SCALARS = 64

class SurfaceDecodeFailure extends Error {
  constructor(readonly code: DshPluginSurfaceDecodeErrorCodeV1, message: string) {
    super(message)
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('surface.invalid_shape', `${path} must be an object`)
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (SENSITIVE_KEY.test(key)) fail('surface.sensitive_field', `${path}.${key} is sensitive`)
    if (FORBIDDEN_RENDERER_KEY.test(key)) fail('surface.renderer_forbidden', `${path}.${key} is a renderer field`)
    if (!allowedSet.has(key)) fail('surface.invalid_shape', `${path}.${key} is not allowed`)
  }
}

function string(value: unknown, path: string, max = MAX_TEXT): string {
  if (typeof value !== 'string' || value.length === 0) fail('surface.invalid_shape', `${path} must be a non-empty string`)
  if (value.length > max) fail('surface.out_of_bounds', `${path} exceeds ${max} characters`)
  if (ABSOLUTE_PATH.test(value)) fail('surface.private_path', `${path} contains a private absolute path`)
  return value
}

function optionalString(value: unknown, path: string, max = MAX_TEXT): string | undefined {
  return value === undefined ? undefined : string(value, path, max)
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail('surface.invalid_shape', `${path} must be boolean`)
  return value
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail('surface.invalid_shape', `${path} must be a non-negative integer`)
  return value
}

function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail('surface.invalid_shape', `${path} must be an array`)
  if (value.length > MAX_COLLECTION) fail('surface.out_of_bounds', `${path} exceeds ${MAX_COLLECTION} items`)
  return value
}

function enumValue<T extends string>(value: unknown, values: ReadonlySet<T>, path: string, code: DshPluginSurfaceDecodeErrorCodeV1 = 'surface.unknown_enum'): T {
  if (typeof value !== 'string' || !values.has(value as T)) fail(code, `${path} is not supported`)
  return value as T
}

function scalar(value: unknown, path: string): DshPluginSafeScalarV1 {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return string(value, path)
  fail('surface.invalid_shape', `${path} must be a safe scalar`)
}

function scalars(value: unknown, path: string): Readonly<Record<string, DshPluginSafeScalarV1>> | undefined {
  if (value === undefined) return undefined
  const input = record(value, path)
  if (Object.keys(input).length > MAX_SCALARS) fail('surface.out_of_bounds', `${path} exceeds ${MAX_SCALARS} fields`)
  const output: Record<string, DshPluginSafeScalarV1> = {}
  for (const [key, item] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key)) fail('surface.sensitive_field', `${path}.${key} is sensitive`)
    if (FORBIDDEN_RENDERER_KEY.test(key)) fail('surface.renderer_forbidden', `${path}.${key} is a renderer field`)
    output[string(key, `${path} key`, MAX_ID)] = scalar(item, `${path}.${key}`)
  }
  return output
}

function summary(value: unknown, path: string): BoundedSummary | undefined {
  if (value === undefined) return undefined
  const input = record(value, path)
  exactKeys(input, ['text', 'truncated'], path)
  return { text: string(input.text, `${path}.text`), truncated: boolean(input.truncated, `${path}.truncated`) }
}

function row(value: unknown, path: string): DshPluginProjectionRowV1 {
  const input = record(value, path)
  exactKeys(input, ['id', 'ref', 'summary', 'scalars'], path)
  const ref = optionalString(input.ref, `${path}.ref`, MAX_ID)
  const rowSummary = summary(input.summary, `${path}.summary`)
  const rowScalars = scalars(input.scalars, `${path}.scalars`)
  return {
    id: string(input.id, `${path}.id`, MAX_ID),
    ...(ref !== undefined ? { ref } : {}),
    ...(rowSummary !== undefined ? { summary: rowSummary } : {}),
    ...(rowScalars !== undefined ? { scalars: rowScalars } : {}),
  }
}

function projection(value: unknown, path: string): DshPluginSafeProjectionV1 {
  const input = record(value, path)
  exactKeys(input, ['revision', 'freshness', 'ref', 'evidence_ref', 'summary', 'scalars', 'rows'], path)
  const ref = optionalString(input.ref, `${path}.ref`, MAX_ID)
  const evidenceRef = optionalString(input.evidence_ref, `${path}.evidence_ref`, MAX_ID)
  const projectionSummary = summary(input.summary, `${path}.summary`)
  const projectionScalars = scalars(input.scalars, `${path}.scalars`)
  const rows = input.rows === undefined ? undefined : array(input.rows, `${path}.rows`).map((item, index) => row(item, `${path}.rows[${index}]`))
  return {
    revision: string(input.revision, `${path}.revision`, MAX_ID),
    freshness: enumValue(input.freshness, FRESHNESS, `${path}.freshness`),
    ...(ref !== undefined ? { ref } : {}),
    ...(evidenceRef !== undefined ? { evidence_ref: evidenceRef } : {}),
    ...(projectionSummary !== undefined ? { summary: projectionSummary } : {}),
    ...(projectionScalars !== undefined ? { scalars: projectionScalars } : {}),
    ...(rows !== undefined ? { rows } : {}),
  }
}

function health(value: unknown, path: string): DshPluginContributionHealthV1 {
  const input = record(value, path)
  exactKeys(input, ['status', 'stage', 'code', 'reason', 'fix', 'last_checked', 'receipt_ref'], path)
  const receiptRef = optionalString(input.receipt_ref, `${path}.receipt_ref`, MAX_ID)
  return {
    status: enumValue(input.status, HEALTH_STATUSES, `${path}.status`),
    stage: string(input.stage, `${path}.stage`, MAX_ID),
    code: string(input.code, `${path}.code`, MAX_ID),
    reason: redactDshPluginSurfaceText(string(input.reason, `${path}.reason`)),
    fix: redactDshPluginSurfaceText(string(input.fix, `${path}.fix`)),
    last_checked: string(input.last_checked, `${path}.last_checked`, MAX_ID),
    ...(receiptRef !== undefined ? { receipt_ref: receiptRef } : {}),
  }
}

function command(value: unknown, path: string): DshPluginCommandContributionV1 {
  const input = record(value, path)
  exactKeys(input, ['id', 'canonical_name', 'aliases', 'owner', 'action_kind', 'available', 'disabled_reason_code'], path)
  const disabledReasonCode = optionalString(input.disabled_reason_code, `${path}.disabled_reason_code`, MAX_ID)
  return {
    id: string(input.id, `${path}.id`, MAX_ID),
    canonical_name: string(input.canonical_name, `${path}.canonical_name`, MAX_ID),
    aliases: array(input.aliases, `${path}.aliases`).map((item, index) => string(item, `${path}.aliases[${index}]`, MAX_ID)),
    owner: string(input.owner, `${path}.owner`, MAX_ID),
    action_kind: string(input.action_kind, `${path}.action_kind`, MAX_ID),
    available: boolean(input.available, `${path}.available`),
    ...(disabledReasonCode !== undefined ? { disabled_reason_code: disabledReasonCode } : {}),
  }
}

function view(value: unknown, path: string): DshPluginViewContributionV1 {
  const input = record(value, path)
  exactKeys(input, ['id', 'owner', 'kind', 'title', 'projection'], path)
  return {
    id: string(input.id, `${path}.id`, MAX_ID),
    owner: string(input.owner, `${path}.owner`, MAX_ID),
    kind: enumValue(input.kind, VIEW_KINDS, `${path}.kind`, 'surface.unknown_view_kind'),
    title: string(input.title, `${path}.title`, MAX_ID),
    projection: projection(input.projection, `${path}.projection`),
  }
}

function action(value: unknown, path: string): DshPluginActionContributionV1 {
  const input = record(value, path)
  exactKeys(input, ['id', 'owner', 'label', 'effect', 'risk', 'preview_policy', 'action_ref', 'expected_revision', 'available', 'disabled_reason_code'], path)
  const effect = enumValue(input.effect, EFFECTS, `${path}.effect`)
  const previewPolicy = enumValue(input.preview_policy, PREVIEW_POLICIES, `${path}.preview_policy`)
  if (effect !== 'read' && previewPolicy !== 'owner_preview_required') fail('surface.invalid_shape', `${path}.preview_policy must require owner preview for mutations`)
  const disabledReasonCode = optionalString(input.disabled_reason_code, `${path}.disabled_reason_code`, MAX_ID)
  return {
    id: string(input.id, `${path}.id`, MAX_ID),
    owner: string(input.owner, `${path}.owner`, MAX_ID),
    label: string(input.label, `${path}.label`, MAX_ID),
    effect,
    risk: enumValue(input.risk, RISKS, `${path}.risk`),
    preview_policy: previewPolicy,
    action_ref: string(input.action_ref, `${path}.action_ref`, MAX_ID),
    expected_revision: string(input.expected_revision, `${path}.expected_revision`, MAX_ID),
    available: boolean(input.available, `${path}.available`),
    ...(disabledReasonCode !== undefined ? { disabled_reason_code: disabledReasonCode } : {}),
  }
}

function decodeContribution(input: unknown): DshPluginSurfaceContributionV1 {
  const value = record(input, 'contribution')
  exactKeys(value, ['contract_version', 'id', 'owner', 'generation', 'surfaces', 'commands', 'views', 'actions', 'health', 'dispose_ref'], 'contribution')
  if (value.contract_version !== DSH_PLUGIN_SURFACE_CONTRACT_V1) fail('surface.unknown_version', 'contribution.contract_version is not supported')
  const surfaces = array(value.surfaces, 'contribution.surfaces').map((item, index) => enumValue(item, TARGETS, `contribution.surfaces[${index}]`))
  return {
    contract_version: DSH_PLUGIN_SURFACE_CONTRACT_V1,
    id: string(value.id, 'contribution.id', MAX_ID),
    owner: string(value.owner, 'contribution.owner', MAX_ID),
    generation: nonNegativeInteger(value.generation, 'contribution.generation'),
    surfaces,
    commands: array(value.commands, 'contribution.commands').map((item, index) => command(item, `contribution.commands[${index}]`)),
    views: array(value.views, 'contribution.views').map((item, index) => view(item, `contribution.views[${index}]`)),
    actions: array(value.actions, 'contribution.actions').map((item, index) => action(item, `contribution.actions[${index}]`)),
    health: health(value.health, 'contribution.health'),
    dispose_ref: string(value.dispose_ref, 'contribution.dispose_ref', MAX_ID),
  }
}

function decodeReceipt(input: unknown): DshPluginActionReceiptV1 {
  const value = record(input, 'receipt')
  exactKeys(value, ['contract_version', 'action_id', 'action_ref', 'owner', 'status', 'revision', 'receipt_ref', 'reason_code', 'evidence_ref'], 'receipt')
  if (value.contract_version !== DSH_PLUGIN_SURFACE_CONTRACT_V1) fail('surface.unknown_version', 'receipt.contract_version is not supported')
  const reasonCode = optionalString(value.reason_code, 'receipt.reason_code', MAX_ID)
  const evidenceRef = optionalString(value.evidence_ref, 'receipt.evidence_ref', MAX_ID)
  return {
    contract_version: DSH_PLUGIN_SURFACE_CONTRACT_V1,
    action_id: string(value.action_id, 'receipt.action_id', MAX_ID),
    action_ref: string(value.action_ref, 'receipt.action_ref', MAX_ID),
    owner: string(value.owner, 'receipt.owner', MAX_ID),
    status: enumValue(value.status, RECEIPT_STATUSES, 'receipt.status'),
    revision: string(value.revision, 'receipt.revision', MAX_ID),
    receipt_ref: string(value.receipt_ref, 'receipt.receipt_ref', MAX_ID),
    ...(reasonCode !== undefined ? { reason_code: reasonCode } : {}),
    ...(evidenceRef !== undefined ? { evidence_ref: evidenceRef } : {}),
  }
}

function fail(code: DshPluginSurfaceDecodeErrorCodeV1, message: string): never {
  throw new SurfaceDecodeFailure(code, message)
}

function decode<T>(fn: () => T): DshPluginSurfaceDecodeResultV1<T> {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    if (error instanceof SurfaceDecodeFailure) return { ok: false, code: error.code, reason: error.message }
    return { ok: false, code: 'surface.invalid_shape', reason: 'surface decoding failed' }
  }
}

export function decodeDshPluginSurfaceContributionV1(input: unknown): DshPluginSurfaceDecodeResultV1<DshPluginSurfaceContributionV1> {
  return decode(() => decodeContribution(input))
}

export function decodeDshPluginActionReceiptV1(input: unknown): DshPluginSurfaceDecodeResultV1<DshPluginActionReceiptV1> {
  return decode(() => decodeReceipt(input))
}

export function probeDshPluginSurfaceContributionV1(acquire: () => unknown): ProbeResult<DshPluginSurfaceContributionV1> {
  try {
    const raw = acquire()
    if (raw === undefined) return { status: 'needs_contract' }
    const decoded = decodeDshPluginSurfaceContributionV1(raw)
    if (!decoded.ok) return { status: 'unavailable', reason: `${decoded.code}: ${decoded.reason}` }
    return { status: 'available', capability: decoded.value }
  } catch (error) {
    return { status: 'unavailable', reason: redactDshPluginSurfaceText(error instanceof Error ? error.message : String(error)) }
  }
}

/** 输出错误原因前移除凭据形态、私有路径和多行 stack。 */
export function redactDshPluginSurfaceText(input: string): string {
  const firstLine = input.split(/\r?\n/, 1)[0] ?? ''
  return firstLine
    .replace(/(authorization|cookie|credential|password|secret|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/(?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|root|private|var|workspaces)\/)[^\s,;]+/g, '[PRIVATE_PATH]')
    .slice(0, MAX_TEXT)
}
