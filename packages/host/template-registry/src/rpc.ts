/**
 * Typed catalog RPCs over the connected stdio MCP seam (task 2.2):
 * list / search / inspect / preview.
 *
 * Every tool answers with the unified owner envelope (spec_version 1.0,
 * status success|partial|failed, facts, error{code,retryable}) carried as a
 * JSON text block inside the MCP `tools/call` result. The frozen
 * `RegistryEnvelopeSchema` validates the envelope; the owner's richer `data`
 * block (browse records, inspect contract, session views) is read through
 * unknown-safe extractors so no unvalidated field ever reaches a projection.
 *
 * Rights policy (fail-closed, from the frozen 1.2 model):
 * - `deny`/`blocked` contract permissions or a `blocked`/`prohibited`
 *   solution rights level deny everything;
 * - preview additionally requires the `preview` contract permission, export
 *   the `export` permission;
 * - unknown or missing values always collapse to "no permission".
 *
 * @module @yeisme/dsh-template-registry/rpc
 */

import {
  REGISTRY_RETRYABLE_ERROR_CODES,
  RegistryEnvelopeSchema,
  TemplateContractSchema,
  TemplateSchema,
  SessionIssueSchema,
  type RegistryEnvelope,
  type Template,
  type TemplateContract,
} from './contracts.js'
import { TEMPLATE_REGISTRY_DISCONNECTED, type TemplateRegistryMcpConnection } from './transport.js'

// ---------------------------------------------------------------------------
// Envelope extraction
// ---------------------------------------------------------------------------

/** Parsed owner answer: the frozen envelope plus the raw `data` block. */
export interface RegistryToolCall {
  readonly envelope: RegistryEnvelope
  readonly data: unknown
}

/**
 * Extract the owner envelope from one MCP `tools/call` result. Returns
 * undefined when the wire shape drifts (contract mismatch — never guessed).
 */
export function parseRegistryToolCallResult(result: unknown): RegistryToolCall | undefined {
  if (typeof result !== 'object' || result === null) return undefined
  const content = (result as { content?: unknown }).content
  if (!Array.isArray(content)) return undefined
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    const typed = block as { type?: unknown; text?: unknown }
    if (typed.type !== 'text' || typeof typed.text !== 'string') continue
    let parsed: unknown
    try { parsed = JSON.parse(typed.text) } catch { return undefined }
    const envelope = RegistryEnvelopeSchema.safeParse(parsed)
    if (!envelope.success) return undefined
    const data = (parsed as { data?: unknown }).data
    return { envelope: envelope.data, data }
  }
  return undefined
}

/** Typed failure taxonomy crossing the RPC seam (no raw text rides along). */
export type TemplateRegistryCallFailure =
  | { readonly kind: 'disconnected' }
  | { readonly kind: 'registry_error'; readonly code: string; readonly retryable: boolean }
  | { readonly kind: 'contract_mismatch' }

export type TemplateRegistryCallOutcome =
  | { readonly ok: true; readonly call: RegistryToolCall }
  | { readonly ok: false; readonly failure: TemplateRegistryCallFailure }

/** Normalize a transport rejection into the failure taxonomy. */
export function templateRegistryCallFailure(error: unknown): TemplateRegistryCallFailure {
  if (error instanceof Error && error.message === TEMPLATE_REGISTRY_DISCONNECTED) return { kind: 'disconnected' }
  if (error && typeof error === 'object' && 'data' in error) {
    const code = (error as { data?: { code?: unknown } }).data?.code
    const text = typeof code === 'string' ? code : 'template_registry_call_failed'
    return { kind: 'registry_error', code: text, retryable: REGISTRY_RETRYABLE_ERROR_CODES.has(text) }
  }
  return { kind: 'disconnected' }
}

/**
 * One typed `tools/call` against the owner. Envelope status `failed` maps to
 * a registry_error carrying the owner's stable error code.
 */
export async function callTemplateRegistryTool(
  connection: TemplateRegistryMcpConnection,
  tool: string,
  args: Record<string, unknown>,
  options?: { signal?: AbortSignal },
): Promise<TemplateRegistryCallOutcome> {
  let result: unknown
  try {
    result = await connection.request('tools/call', { name: tool, arguments: args }, options)
  } catch (error) {
    return { ok: false, failure: templateRegistryCallFailure(error) }
  }
  const call = parseRegistryToolCallResult(result)
  if (call === undefined) return { ok: false, failure: { kind: 'contract_mismatch' } }
  if (call.envelope.status === 'failed') {
    const code = call.envelope.error?.code ?? 'template_registry_failed'
    return { ok: false, failure: { kind: 'registry_error', code, retryable: REGISTRY_RETRYABLE_ERROR_CODES.has(code) || call.envelope.error?.retryable === true } }
  }
  return { ok: true, call }
}

// ---------------------------------------------------------------------------
// Rights derivation (fail-closed)
// ---------------------------------------------------------------------------

/** Rights levels that may hold any permission at all. */
const PERMISSIBLE_RIGHTS_LEVELS = new Set(['internal', 'free-evaluation', 'external-attributed'])

/**
 * Derive the safe `{preview, export}` booleans from the two-layer rights
 * model. Fail-closed on every axis: explicit deny/blocked permissions win,
 * unknown or missing rights levels deny, and each boolean additionally
 * requires its own contract permission.
 */
export function deriveTemplateRights(input: { rightsLevel?: string | undefined; permissions?: readonly string[] | undefined }): { preview: boolean; export: boolean } {
  const permissions = input.permissions ?? []
  if (permissions.includes('deny') || permissions.includes('blocked')) return { preview: false, export: false }
  const level = input.rightsLevel
  if (level === undefined || !PERMISSIBLE_RIGHTS_LEVELS.has(level)) return { preview: false, export: false }
  return { preview: permissions.includes('preview'), export: permissions.includes('export') }
}

// ---------------------------------------------------------------------------
// Unknown-safe extractors over the owner `data` block
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function asString(value: unknown, max = 600): string | undefined {
  return typeof value === 'string' && value !== '' ? value.slice(0, max) : undefined
}

function asStringArray(value: unknown, max = 16): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string').slice(0, max)
}

function normalizeMaturityString(value: unknown): 'exploratory' | 'first-support' | 'mature' {
  return value === 'first-support' || value === 'mature' ? value : 'exploratory'
}

function normalizeRightsLevel(value: unknown): 'internal' | 'free-evaluation' | 'external-attributed' | 'blocked' | 'prohibited' | undefined {
  return value === 'internal' || value === 'free-evaluation' || value === 'external-attributed' || value === 'blocked' || value === 'prohibited' ? value : undefined
}

/**
 * Fold one browse record (the 20-field list/search row) into a Template.
 * Browse rows carry no contract permissions, so rights stay fail-closed
 * until an inspect upgrades them.
 */
export function templateFromBrowseRecord(record: unknown): Template | undefined {
  const row = asRecord(record)
  if (row === undefined) return undefined
  const ref = asString(row.ref, 400)
  const digest = asString(row.digest, 160)
  if (ref === undefined || digest === undefined) return undefined
  const rightsLevel = normalizeRightsLevel(row.rights)
  const compilerStatus = asString(row.compiler_status, 48)
  const version = asString(row.version, 64)
  return TemplateSchema.parse({
    ref, digest,
    title: asString(row.title, 200) ?? asString(row.solution_title, 200) ?? ref,
    summary: asString(row.summary, 600) ?? asString(row.solution_summary, 600) ?? '',
    tags: asStringArray(row.tags),
    capabilities: asStringArray(row.capabilities),
    maturity: normalizeMaturityString(row.maturity),
    rights: deriveTemplateRights({ rightsLevel }),
    source: 'local',
    ...(rightsLevel === undefined ? {} : { rightsLevel }),
    ...(compilerStatus === undefined ? {} : { compilerStatus }),
    ...(version === undefined ? {} : { version }),
  })
}

/** Bounded templates array from the list/search `data.solutions[].templates[]` shape. */
export function templatesFromBrowseData(data: unknown, limit = 256): Template[] {
  const root = asRecord(data)
  const solutions = root?.solutions
  if (!Array.isArray(solutions)) return []
  const templates: Template[] = []
  for (const solution of solutions) {
    const row = asRecord(solution)
    const entries = row?.templates
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      const template = templateFromBrowseRecord(entry)
      if (template !== undefined) templates.push(template)
      if (templates.length >= limit) return templates
    }
  }
  return templates
}

/** Inspect answer: the safe template row plus its contract (form source of truth). */
export interface TemplateInspection {
  readonly template: Template
  readonly contract: TemplateContract
  readonly usage?: string | undefined
  readonly ready: boolean
  readonly issues: readonly { code: string; field?: string; step?: string }[]
}

/**
 * Fold the inspect `data` block (verified live: identity, rights, trust,
 * inputs with i18n definitions, contract{digest,inputs,license,permissions}).
 */
export function templateInspectionFromInspectData(data: unknown): TemplateInspection | undefined {
  const root = asRecord(data)
  if (root === undefined) return undefined
  const ref = asString(root.ref, 400)
  const digest = asString(root.digest, 160)
  if (ref === undefined || digest === undefined) return undefined
  const contractRaw = asRecord(root.contract)
  const contractParsed = contractRaw === undefined ? undefined : TemplateContractSchema.safeParse({
    digest: contractRaw.digest,
    inputs: Array.isArray(contractRaw.inputs) ? contractRaw.inputs : [],
    license: contractRaw.license ?? 'internal',
    permissions: Array.isArray(contractRaw.permissions) ? contractRaw.permissions : [],
  })
  if (contractParsed === undefined || !contractParsed.success) return undefined
  const contract = contractParsed.data
  const rightsLevel = normalizeRightsLevel(root.rights)
  const compilerStatus = asString(root.compiler_status, 48)
  const version = asString(root.version, 64)
  const template = TemplateSchema.parse({
    ref, digest,
    title: asString(root.title, 200) ?? ref,
    summary: asString(root.summary, 600) ?? '',
    tags: asStringArray(root.tags),
    capabilities: asStringArray(root.capabilities),
    maturity: normalizeMaturityString(root.maturity),
    // Inspect knows the contract permissions: derive the safe booleans here.
    rights: deriveTemplateRights({ rightsLevel, permissions: contract.permissions }),
    source: 'local',
    ...(rightsLevel === undefined ? {} : { rightsLevel }),
    ...(compilerStatus === undefined ? {} : { compilerStatus }),
    ...(version === undefined ? {} : { version }),
    permissions: contract.permissions,
  })
  const issuesRaw = Array.isArray(root.issues) ? root.issues : []
  const issues = issuesRaw
    .map(issue => SessionIssueSchema.safeParse(issue))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data as { code: string; field?: string; step?: string })
    .slice(0, 32)
  const usage = asString(root.usage, 1200)
  return {
    template,
    contract,
    ...(usage === undefined ? {} : { usage }),
    ready: root.ready === true,
    issues,
  }
}

// ---------------------------------------------------------------------------
// Preview (derived — the registry has no standalone preview tool)
// ---------------------------------------------------------------------------

/** Why a preview is disabled; every value is a stable reason code, never prose. */
export type TemplatePreviewDenyReason = 'not_found' | 'permission_denied' | 'rights_denied' | 'degraded' | 'contract_unavailable'

export type TemplatePreview =
  | {
    readonly ref: string
    readonly allowed: true
    readonly digest: string
    readonly title: string
    readonly summary: string
    readonly usage?: string | undefined
    readonly contractDigest?: string | undefined
  }
  | { readonly ref: string; readonly allowed: false; readonly reason: TemplatePreviewDenyReason }

/**
 * Build the bounded preview DTO from an inspection. The registry exposes no
 * preview tool (baseline gap 4): preview is the owner-approved derived view
 * (title/summary/usage + contract digest) and is denied fail-closed with a
 * reason code whenever the two-layer rights model does not clearly allow it.
 */
export function templatePreviewFromInspection(inspection: TemplateInspection): TemplatePreview {
  const { template, contract } = inspection
  if (template.rightsLevel === 'blocked' || template.rightsLevel === 'prohibited') {
    return { ref: template.ref, allowed: false, reason: 'rights_denied' }
  }
  if (!contract.permissions.includes('preview')) {
    return { ref: template.ref, allowed: false, reason: 'permission_denied' }
  }
  return {
    ref: template.ref,
    allowed: true,
    digest: template.digest,
    title: template.title,
    summary: template.summary,
    ...(inspection.usage === undefined ? {} : { usage: inspection.usage }),
    ...(contract.digest === undefined ? {} : { contractDigest: contract.digest }),
  }
}

// ---------------------------------------------------------------------------
// Typed RPC calls (2.2)
// ---------------------------------------------------------------------------

/** Shared browse dimensions for the list tool (a bounded subset of the 28). */
export interface TemplateBrowseInput {
  readonly query?: string
  readonly category?: string
  readonly tag?: string
  readonly capability?: string
  readonly locale?: string
  readonly limit?: number
  readonly offset?: number
}

function browseArguments(input: TemplateBrowseInput): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  if (input.query !== undefined) args.query = input.query
  if (input.category !== undefined) args.categories = [input.category]
  if (input.tag !== undefined) args.tags = [input.tag]
  if (input.capability !== undefined) args.capabilities = [input.capability]
  if (input.locale !== undefined) args.template_locales = [input.locale]
  if (input.limit !== undefined) args.limit = input.limit
  if (input.offset !== undefined) args.offset = input.offset
  return args
}

export type TemplateBrowseRpcOutcome =
  | { readonly ok: true; readonly templates: readonly Template[] }
  | { readonly ok: false; readonly failure: TemplateRegistryCallFailure }

/** `template_registry_list` — the catalog pane's primary data source. */
export async function rpcListTemplates(connection: TemplateRegistryMcpConnection, input: TemplateBrowseInput = {}, options?: { signal?: AbortSignal }): Promise<TemplateBrowseRpcOutcome> {
  const outcome = await callTemplateRegistryTool(connection, 'template_registry_list', browseArguments(input), options)
  if (!outcome.ok) return outcome
  return { ok: true, templates: templatesFromBrowseData(outcome.call.data) }
}

/**
 * `template_registry_search` — strict owner schema: only `query` (required)
 * plus the documented optional filters; extra BrowseRequest fields are
 * rejected by the owner (INPUT_INVALID observed live).
 */
export async function rpcSearchTemplates(connection: TemplateRegistryMcpConnection, query: string, options?: { signal?: AbortSignal; locale?: string }): Promise<TemplateBrowseRpcOutcome> {
  const args: Record<string, unknown> = { query }
  if (options?.locale !== undefined) args.locale = options.locale
  const outcome = await callTemplateRegistryTool(connection, 'template_registry_search', args, options)
  if (!outcome.ok) return outcome
  return { ok: true, templates: templatesFromBrowseData(outcome.call.data) }
}

export type TemplateInspectRpcOutcome =
  | { readonly ok: true; readonly inspection: TemplateInspection }
  | { readonly ok: false; readonly failure: TemplateRegistryCallFailure | { readonly kind: 'not_found' } }

/** `template_registry_inspect` — detail view + guided-form contract source. */
export async function rpcInspectTemplate(connection: TemplateRegistryMcpConnection, ref: string, options?: { signal?: AbortSignal }): Promise<TemplateInspectRpcOutcome> {
  const outcome = await callTemplateRegistryTool(connection, 'template_registry_inspect', { ref }, options)
  if (!outcome.ok) {
    // TEMPLATE_UNAVAILABLE is the owner's stable missing/unusable code for
    // a ref the registry cannot serve (other codes surface verbatim).
    if (outcome.failure.kind === 'registry_error' && outcome.failure.code === 'TEMPLATE_UNAVAILABLE') {
      return { ok: false, failure: { kind: 'not_found' } }
    }
    return outcome
  }
  const inspection = templateInspectionFromInspectData(outcome.call.data)
  if (inspection === undefined) return { ok: false, failure: { kind: 'contract_mismatch' } }
  return { ok: true, inspection }
}
