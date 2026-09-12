import { z } from 'zod'

export const PANE_PLUGIN_SCHEMA = 'pane.plugin.v1alpha1' as const
export const PANE_EVENT_SCHEMA = 'pane.event.v1alpha1' as const
export const PANE_PROJECTION_SCHEMA = 'pane.projection.v1alpha1' as const
export const PANE_ARTIFACT_SCHEMA = 'pane.artifact.v1alpha1' as const
export const PANE_INTENT_SCHEMA = 'pane.intent.v1alpha1' as const
export const PANE_ACTION_DESCRIPTOR_SCHEMA = 'pane.action-descriptor.v1alpha1' as const
export const PANE_ACTION_REQUEST_SCHEMA = 'pane.action-request.v1alpha1' as const

export const PANE_PROTOCOL_LIMITS = Object.freeze({
  artifactSummaryChars: 2_048,
  eventPayloadBytes: 64 * 1_024,
  labelChars: 160,
  refChars: 512,
  timelineItems: 1_000,
  entities: 5_000,
  receipts: 100,
  actionFields: 32,
  actionValueChars: 16_384,
})

export const PANE_TEXT_BODY_BYTES = 2 * 1024 * 1024
const TextBodySchema = z.object({ field: z.string().min(1).max(120), content: z.string().max(PANE_TEXT_BODY_BYTES) }).strict().superRefine((body, ctx) => {
  const bytes = new TextEncoder().encode(body.content)
  if (bytes.byteLength > PANE_TEXT_BODY_BYTES || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== body.content) {
    ctx.addIssue({ code: 'custom', path: ['content'], message: 'text body must be valid UTF-8 within the byte limit' })
  }
})

const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9._:/-]*$/i
const PACKAGE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/
const UNC_PATH = /^\\\\/
const UNSAFE_PROTOCOL = /^(?:https?|file|javascript|data):/i
const UNSAFE_KEYS = new Set([
  'absolutepath',
  'authorization',
  'cookie',
  'credential',
  'privatearguments',
  'providerpayload',
  'rawprompt',
  'secret',
  'token',
])

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.null(),
  z.boolean(),
  z.number().finite(),
  z.string(),
  z.array(JsonValueSchema),
  z.record(z.string(), JsonValueSchema),
]))

const IdentifierSchema = z.string().min(1).max(120).regex(SAFE_IDENTIFIER)
const LabelSchema = z.string().min(1).max(PANE_PROTOCOL_LIMITS.labelChars)

/**
 * Optional read-only dsh session share URL on artifact descriptors
 * (dsh-url-session-v1 §6.3). Strictly `http(s)://host[:port]` + one session
 * route form (`/s/<id>` or `/?s=<id>`): no userinfo, no fragment, no query
 * beyond the single `s` alias. Carries no authority — the artifact's
 * capabilities still govern every mutation; old consumers without the field
 * keep parsing unchanged.
 */
const SAFE_SESSION_URL = /^https?:\/\/[^\s@/:]+(?::\d+)?(?:\/s\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}|\/\?s=[A-Za-z0-9][A-Za-z0-9._-]{0,127})$/
const SessionUrlSchema = z.string().max(512).superRefine((value, ctx) => {
  if (!SAFE_SESSION_URL.test(value)) {
    ctx.addIssue({ code: 'custom', message: 'sessionUrl must be an http(s) session share URL without userinfo, fragments, or extra query' })
  }
})
const SummarySchema = z.string().max(PANE_PROTOCOL_LIMITS.artifactSummaryChars)
const OpaqueRefSchema = z.string().min(1).max(PANE_PROTOCOL_LIMITS.refChars).superRefine((value, ctx) => {
  if (value.startsWith('/') || WINDOWS_ABSOLUTE_PATH.test(value) || UNC_PATH.test(value)) {
    ctx.addIssue({ code: 'custom', message: 'absolute paths are not allowed' })
  }
  if (UNSAFE_PROTOCOL.test(value)) {
    ctx.addIssue({ code: 'custom', message: 'raw or executable URLs are not allowed' })
  }
})

function jsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

/** Rejects secrets, private host paths, executable URLs, and oversized generic payloads. */
function inspectSafeJson(value: unknown, ctx: z.RefinementCtx, path: PropertyKey[] = []): void {
  if (typeof value === 'string' && path.at(-1) === 'sessionUrl' && SAFE_SESSION_URL.test(value)) {
    // §6.3 read-only session share URL: shape-validated at the field schema,
    // so the blanket raw-URL rejection below does not re-flag it.
    return
  }
  if (typeof value === 'string') {
    if (value.startsWith('/') || WINDOWS_ABSOLUTE_PATH.test(value) || UNC_PATH.test(value)) {
      ctx.addIssue({ code: 'custom', path, message: 'absolute paths are not allowed' })
    }
    if (UNSAFE_PROTOCOL.test(value)) {
      ctx.addIssue({ code: 'custom', path, message: 'raw or executable URLs are not allowed' })
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectSafeJson(item, ctx, [...path, index]))
    return
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (UNSAFE_KEYS.has(key.toLowerCase())) {
        ctx.addIssue({ code: 'custom', path: [...path, key], message: `unsafe field ${key}` })
      }
      inspectSafeJson(child, ctx, [...path, key])
    }
  }
}

export const PaneStatusSchema = z.enum([
  'ready',
  'running',
  'partial',
  'attention_required',
  'approval_required',
  'stale',
  'offline',
  'permission_denied',
  'contract_mismatch',
  'unknown',
  'cancel_unknown',
  'reconcile_required',
])
export type PaneStatus = z.infer<typeof PaneStatusSchema>

export const PaneContextSchema = z.object({
  tenantRef: OpaqueRefSchema.optional(),
  workspaceRef: OpaqueRefSchema,
  projectRef: OpaqueRefSchema.optional(),
  sessionRef: OpaqueRefSchema.optional(),
  principalRef: OpaqueRefSchema.optional(),
  revision: z.string().min(1).max(160),
  membershipRevision: z.string().min(1).max(160).optional(),
  installationRef: OpaqueRefSchema.optional(),
  pluginDigest: z.string().min(1).max(160).optional(),
  policyRevision: z.string().min(1).max(160).optional(),
  runtimeGeneration: OpaqueRefSchema.optional(),
}).strict()
export type PaneContextV1 = z.infer<typeof PaneContextSchema>

const PaneFaceSchema = z.object({
  provided: z.boolean(),
  capabilities: z.array(IdentifierSchema).max(64),
}).strict()

export const PanePresentationSchema = z.object({
  icon: IdentifierSchema.optional(),
  group: IdentifierSchema.optional(),
  task: IdentifierSchema.optional(),
  owner: IdentifierSchema.optional(),
  description: SummarySchema.optional(),
  keywords: z.array(z.string().min(1).max(80)).max(24).optional(),
  order: z.number().int().min(-10_000).max(10_000).optional(),
  launcher: z.boolean().optional(),
}).strict()
export type PanePresentationV1 = z.infer<typeof PanePresentationSchema>

export const PaneViewDescriptorSchema = z.object({
  kind: IdentifierSchema,
  label: LabelSchema,
  componentKey: IdentifierSchema,
  role: z.enum(['navigator', 'content', 'utility', 'inspector', 'general']),
  preferredRegion: z.enum(['right', 'bottom', 'either']),
  retention: z.enum(['keep-alive', 'snapshot', 'recreate']),
  singleton: z.boolean(),
  presentation: PanePresentationSchema.optional(),
}).strict()
export type PaneViewDescriptorV1 = z.infer<typeof PaneViewDescriptorSchema>

const SLASH_NAME = /^[a-z][a-z0-9-]{1,31}$/

export const PaneCommandSlashSchema = z.object({
  name: z.string().regex(SLASH_NAME),
  aliases: z.array(z.string().regex(SLASH_NAME)).max(4).optional(),
  hint: z.string().min(1).max(80).optional(),
  category: z.enum(['discovery', 'session', 'model', 'work', 'lifecycle', 'pane']).optional(),
}).strict()
export type PaneCommandSlashV1 = z.infer<typeof PaneCommandSlashSchema>

export const PaneCommandDescriptorSchema = z.object({
  id: IdentifierSchema,
  label: LabelSchema,
  permission: IdentifierSchema.optional(),
  presentation: PanePresentationSchema.optional(),
  slash: PaneCommandSlashSchema.optional(),
}).strict()
export type PaneCommandDescriptorV1 = z.infer<typeof PaneCommandDescriptorSchema>

export const PanePluginDefinitionSchema = z.object({
  schema: z.literal(PANE_PLUGIN_SCHEMA),
  id: IdentifierSchema,
  version: z.string().regex(PACKAGE_VERSION),
  owner: z.object({ id: IdentifierSchema, label: LabelSchema.optional() }).strict(),
  faces: z.object({
    host: PaneFaceSchema,
    client: PaneFaceSchema,
    composition: PaneFaceSchema,
    observation: PaneFaceSchema,
  }).strict(),
  capabilities: z.object({
    required: z.array(IdentifierSchema).max(64),
    optional: z.array(IdentifierSchema).max(64),
  }).strict(),
  permissions: z.array(IdentifierSchema).max(64),
  views: z.array(PaneViewDescriptorSchema).max(32),
  commands: z.array(PaneCommandDescriptorSchema).max(64),
  artifactKinds: z.array(IdentifierSchema).max(64),
  compatibility: z.object({
    dshApiRange: z.string().min(1).max(80),
    experimental: z.literal(true),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  if (value.views.length > 0 && !value.faces.client.provided) {
    ctx.addIssue({ code: 'custom', path: ['faces', 'client'], message: 'views require the client face' })
  }
  if (value.artifactKinds.length > 0 && !value.faces.composition.provided) {
    ctx.addIssue({ code: 'custom', path: ['faces', 'composition'], message: 'artifact kinds require the composition face' })
  }
})
export type PanePluginDefinitionV1 = z.infer<typeof PanePluginDefinitionSchema>

export const ArtifactRefSchema = z.object({
  schema: z.literal(PANE_ARTIFACT_SCHEMA),
  owner: IdentifierSchema,
  kind: IdentifierSchema,
  ref: OpaqueRefSchema,
  version: z.string().min(1).max(160),
  mediaType: z.string().min(1).max(160),
  title: LabelSchema,
  summary: SummarySchema.optional(),
  evidenceRefs: z.array(OpaqueRefSchema).max(64),
  capabilities: z.array(IdentifierSchema).max(64),
  sessionUrl: SessionUrlSchema.optional(),
}).strict().superRefine((value, ctx) => inspectSafeJson(value, ctx))
export type ArtifactRefV1 = z.infer<typeof ArtifactRefSchema>

export const ArtifactIntentSchema = z.object({
  schema: z.literal(PANE_INTENT_SCHEMA),
  intent: z.enum(['open', 'compare', 'attach_context', 'transform', 'handoff', 'link']),
  source: ArtifactRefSchema,
  targetOwner: IdentifierSchema.optional(),
  targetPaneKind: IdentifierSchema.optional(),
  context: PaneContextSchema,
  idempotencyKey: z.string().min(8).max(160),
}).strict().superRefine((value, ctx) => {
  if (['attach_context', 'transform', 'handoff', 'link'].includes(value.intent) && value.targetOwner === undefined) {
    ctx.addIssue({ code: 'custom', path: ['targetOwner'], message: `${value.intent} requires targetOwner` })
  }
})
export type ArtifactIntentV1 = z.infer<typeof ArtifactIntentSchema>

export const PaneActionFieldOptionSchema = z.object({
  value: z.string().min(1).max(160),
  label: LabelSchema,
}).strict()
export type PaneActionFieldOptionV1 = z.infer<typeof PaneActionFieldOptionSchema>

export const PaneActionFieldDescriptorSchema = z.object({
  key: IdentifierSchema,
  label: LabelSchema,
  kind: z.enum(['text', 'textarea', 'number', 'select', 'multiselect', 'boolean', 'artifact_ref']),
  required: z.boolean(),
  placeholder: z.string().max(240).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  minLength: z.number().int().nonnegative().max(PANE_PROTOCOL_LIMITS.actionValueChars).optional(),
  maxLength: z.number().int().positive().max(PANE_PROTOCOL_LIMITS.actionValueChars).optional(),
  options: z.array(PaneActionFieldOptionSchema).max(128).optional(),
  artifactKinds: z.array(IdentifierSchema).max(32).optional(),
}).strict().superRefine((field, ctx) => {
  if ((field.kind === 'select' || field.kind === 'multiselect') && (field.options?.length ?? 0) === 0) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: `${field.kind} fields require options` })
  }
  if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
    ctx.addIssue({ code: 'custom', path: ['min'], message: 'min must not exceed max' })
  }
  if (field.minLength !== undefined && field.maxLength !== undefined && field.minLength > field.maxLength) {
    ctx.addIssue({ code: 'custom', path: ['minLength'], message: 'minLength must not exceed maxLength' })
  }
})
export type PaneActionFieldDescriptorV1 = z.infer<typeof PaneActionFieldDescriptorSchema>

export const PaneActionDescriptorSchema = z.object({
  schema: z.literal(PANE_ACTION_DESCRIPTOR_SCHEMA),
  descriptorRef: OpaqueRefSchema,
  owner: IdentifierSchema,
  actionId: IdentifierSchema,
  label: LabelSchema,
  targetRef: OpaqueRefSchema,
  targetVersion: z.string().min(1).max(160),
  context: PaneContextSchema,
  risk: z.enum(['low', 'medium', 'high']),
  confirmation: z.enum(['none', 'confirm', 'approval']),
  expiresAt: z.string().min(1).max(80).refine(value => Number.isFinite(Date.parse(value)), 'expiresAt must be an ISO timestamp'),
  preview: z.object({
    summary: SummarySchema,
    cost: z.object({ currency: z.string().min(1).max(16), amount: z.number().finite().nonnegative(), estimate: z.boolean() }).strict().optional(),
    rights: z.object({ status: z.enum(['clear', 'review_required', 'blocked', 'unknown']), summary: SummarySchema }).strict().optional(),
    evidenceRefs: z.array(OpaqueRefSchema).max(64).optional(),
  }).strict(),
  fields: z.array(PaneActionFieldDescriptorSchema).max(PANE_PROTOCOL_LIMITS.actionFields),
  textBody: z.object({ field: IdentifierSchema, maxBytes: z.number().int().positive().max(PANE_TEXT_BODY_BYTES) }).strict().optional(),
  presentation: PanePresentationSchema.optional(),
}).strict().superRefine((value, ctx) => {
  inspectSafeJson(value, ctx)
  const keys = value.fields.map(field => field.key)
  if (value.textBody && !value.fields.some(field => field.key === value.textBody?.field && field.kind === 'textarea')) ctx.addIssue({ code: 'custom', path: ['textBody'], message: 'text body must bind an existing textarea' })
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['fields'], message: 'action field keys must be unique' })
})
export type PaneActionDescriptorV1 = z.infer<typeof PaneActionDescriptorSchema>

export const PaneActionValueSchema = z.union([
  z.string().max(PANE_PROTOCOL_LIMITS.actionValueChars),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(512)).max(64),
  ArtifactRefSchema,
])
export type PaneActionValueV1 = z.infer<typeof PaneActionValueSchema>

export const PaneActionRequestSchema = z.object({
  schema: z.literal(PANE_ACTION_REQUEST_SCHEMA),
  descriptorRef: OpaqueRefSchema,
  owner: IdentifierSchema,
  actionId: IdentifierSchema,
  expectedTargetRef: OpaqueRefSchema,
  expectedTargetVersion: z.string().min(1).max(160),
  context: PaneContextSchema,
  idempotencyKey: z.string().min(8).max(160),
  values: z.record(IdentifierSchema, PaneActionValueSchema),
  textBody: TextBodySchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.textBody && Object.hasOwn(value.values, value.textBody.field)) ctx.addIssue({ code: 'custom', path: ['textBody'], message: 'text body must not duplicate an action value' })
  if (Object.keys(value.values).length + (value.textBody ? 1 : 0) > PANE_PROTOCOL_LIMITS.actionFields) {
    ctx.addIssue({ code: 'custom', path: ['values'], message: 'too many action values' })
  }
})
export type PaneActionRequestV1 = z.infer<typeof PaneActionRequestSchema>

/** Keeps legacy requests unchanged; only advertised text bodies use the bounded side channel. */
export function encodePaneActionValues(descriptor: PaneActionDescriptorV1, values: Readonly<Record<string, PaneActionValueV1>>): Pick<PaneActionRequestV1, 'values' | 'textBody'> {
  const binding = descriptor.textBody
  const content = binding && values[binding.field]
  if (!binding || typeof content !== 'string' || content.length <= PANE_PROTOCOL_LIMITS.actionValueChars) return { values: { ...values } }
  const remaining = { ...values }
  delete remaining[binding.field]
  return { values: remaining, textBody: { field: binding.field, content } }
}

export function decodePaneActionValues(request: PaneActionRequestV1): Record<string, PaneActionValueV1> {
  return request.textBody ? { ...request.values, [request.textBody.field]: request.textBody.content } : request.values
}

/** Additive lookup contract: never carries values or authorizes a new execution. */
export const PaneActionReconcileRequestSchema = z.object({
  schema: z.literal('pane.action-reconcile-request.v1alpha1'),
  owner: IdentifierSchema, actionId: IdentifierSchema, expectedTargetRef: OpaqueRefSchema,
  context: PaneContextSchema, idempotencyKey: PaneActionRequestSchema.shape.idempotencyKey,
}).strict()
export type PaneActionReconcileRequestV1 = z.infer<typeof PaneActionReconcileRequestSchema>


export const PaneProjectionEntitySchema = z.object({
  ref: OpaqueRefSchema,
  version: z.number().int().nonnegative(),
  value: JsonValueSchema,
}).strict()
export type PaneProjectionEntityV1 = z.infer<typeof PaneProjectionEntitySchema>

export const PaneActionReceiptSchema = z.object({
  status: z.enum([
    'pending',
    'accepted',
    'completed',
    'partial',
    'failed',
    'approval_required',
    'rejected',
    'unknown',
    'reconcile_required',
  ]),
  receiptRef: OpaqueRefSchema,
  actionId: IdentifierSchema.optional(),
  owner: IdentifierSchema.optional(),
  summary: SummarySchema.optional(),
  outputArtifacts: z.array(ArtifactRefSchema).max(64).optional(),
  evidenceRefs: z.array(OpaqueRefSchema).max(64).optional(),
  reconcileReason: SummarySchema.optional(),
}).strict().superRefine((value, ctx) => inspectSafeJson(value, ctx))
export type PaneActionReceiptV1 = z.infer<typeof PaneActionReceiptSchema>

const EventCommonSchema = z.object({
  schema: z.literal(PANE_EVENT_SCHEMA),
  stream: IdentifierSchema,
  cursor: z.string().min(1).max(256),
  sequence: z.number().int().min(-1),
  context: PaneContextSchema,
  occurredAt: z.string().min(1).max(80),
  observedAt: z.string().min(1).max(80),
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  status: PaneStatusSchema.optional(),
  traceRef: OpaqueRefSchema.optional(),
  receiptRef: OpaqueRefSchema.optional(),
})

const SnapshotEventSchema = EventCommonSchema.extend({
  op: z.literal('snapshot'),
  payload: z.object({
    entities: z.array(PaneProjectionEntitySchema).max(PANE_PROTOCOL_LIMITS.entities),
    timeline: z.array(JsonValueSchema).max(PANE_PROTOCOL_LIMITS.timelineItems).optional(),
    receipts: z.array(PaneActionReceiptSchema).max(PANE_PROTOCOL_LIMITS.receipts).optional(),
  }).strict(),
}).strict()

const EntityEventFields = {
  entityRef: OpaqueRefSchema,
  entityVersion: z.number().int().nonnegative(),
}

const UpsertEventSchema = EventCommonSchema.extend({
  op: z.literal('upsert'),
  ...EntityEventFields,
  payload: z.object({ value: JsonValueSchema }).strict(),
}).strict()

const RemoveEventSchema = EventCommonSchema.extend({
  op: z.literal('remove'),
  ...EntityEventFields,
  payload: z.object({ reason: SummarySchema.optional() }).strict(),
}).strict()

const AppendEventSchema = EventCommonSchema.extend({
  op: z.literal('append'),
  entityRef: OpaqueRefSchema.optional(),
  entityVersion: z.number().int().nonnegative().optional(),
  payload: z.object({ value: JsonValueSchema }).strict(),
}).strict()

const InvalidateEventSchema = EventCommonSchema.extend({
  op: z.literal('invalidate'),
  payload: z.object({ reason: SummarySchema }).strict(),
}).strict()

const ActionReceiptEventSchema = EventCommonSchema.extend({
  op: z.literal('action_receipt'),
  payload: PaneActionReceiptSchema,
}).strict()

const ResetEventSchema = EventCommonSchema.extend({
  op: z.literal('reset'),
  payload: z.object({ reason: SummarySchema }).strict(),
}).strict()

export const PaneEventEnvelopeSchema = z.discriminatedUnion('op', [
  SnapshotEventSchema,
  UpsertEventSchema,
  RemoveEventSchema,
  AppendEventSchema,
  InvalidateEventSchema,
  ActionReceiptEventSchema,
  ResetEventSchema,
]).superRefine((value, ctx) => {
  inspectSafeJson(value.payload, ctx, ['payload'])
  if (jsonBytes(value.payload) > PANE_PROTOCOL_LIMITS.eventPayloadBytes) {
    ctx.addIssue({ code: 'custom', path: ['payload'], message: 'event payload exceeds the byte budget' })
  }
})
export type PaneEventEnvelopeV1 = z.infer<typeof PaneEventEnvelopeSchema>

export interface PaneProjectionStateV1 {
  readonly schema: typeof PANE_PROJECTION_SCHEMA
  readonly generation: number
  readonly status: PaneStatus
  readonly stream?: string
  readonly context?: PaneContextV1
  readonly cursor?: string
  readonly sequence?: number
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly entities: Readonly<Record<string, PaneProjectionEntityV1>>
  readonly timeline: readonly JsonValue[]
  readonly receipts: readonly PaneActionReceiptV1[]
  readonly reconcileReason?: string
}

export function parsePanePluginDefinition(input: unknown): PanePluginDefinitionV1 {
  return PanePluginDefinitionSchema.parse(input)
}

export function parsePaneEventEnvelope(input: unknown): PaneEventEnvelopeV1 {
  return PaneEventEnvelopeSchema.parse(input)
}

export function parseArtifactRef(input: unknown): ArtifactRefV1 {
  return ArtifactRefSchema.parse(input)
}

export function parseArtifactIntent(input: unknown): ArtifactIntentV1 {
  return ArtifactIntentSchema.parse(input)
}

export function parsePaneActionDescriptor(input: unknown): PaneActionDescriptorV1 {
  return PaneActionDescriptorSchema.parse(input)
}

export function parsePaneActionRequest(input: unknown): PaneActionRequestV1 {
  return PaneActionRequestSchema.parse(input)
}

export function parsePaneActionReceipt(input: unknown): PaneActionReceiptV1 {
  return PaneActionReceiptSchema.parse(input)
}

/** Additive, pre-release document contract. This stores drafts, never execution state. */
export const PROJECT_CANVAS_SCHEMA = 'dsh.project-canvas.v1alpha1' as const
const CanvasPointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()
export const ProjectCanvasScopeSchema = z.object({ workspaceRef: OpaqueRefSchema, projectRef: OpaqueRefSchema }).strict()
const CanvasNodeBase = {
  id: IdentifierSchema,
  title: LabelSchema,
  position: CanvasPointSchema,
  size: z.object({ width: z.number().finite().positive(), height: z.number().finite().positive() }).strict(),
  groupId: IdentifierSchema.optional(),
}
const CanvasControlsSchema = z.record(IdentifierSchema, z.union([z.string().max(16_384), z.number().finite(), z.boolean(), z.null()]))
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 64) ctx.addIssue({ code: 'custom', message: 'too many draft controls' })
    inspectSafeJson(value, ctx)
  })
// Creative pipeline node kinds (dsh-creative-pipeline-visual-workbench-v1 §Canvas
// projection). The domain vocabulary asset|character|scene|shot|candidate layers
// on the generic material|draft|operation|result|group primitives: asset refines
// material, candidate refines result, character/scene/shot are bounded domain
// drafts. Both vocabularies stay valid; nodes still carry only safe refs,
// bounded summaries, versions and layout — never text bodies, credentials,
// provider payloads, absolute paths or full run state.
const CreativeDomainNodeBase = {
  ...CanvasNodeBase,
  domainRef: OpaqueRefSchema,
  version: z.string().min(1).max(160),
  summary: SummarySchema.optional(),
}
export const ProjectCanvasNodeSchema = z.discriminatedUnion('kind', [
  z.object({ ...CanvasNodeBase, kind: z.literal('material'), artifact: ArtifactRefSchema }).strict(),
  z.object({ ...CanvasNodeBase, kind: z.literal('draft'), text: z.string().max(32_768) }).strict(),
  z.object({ ...CanvasNodeBase, kind: z.literal('operation'), owner: IdentifierSchema, actionRef: OpaqueRefSchema,
    controls: CanvasControlsSchema, selectedArtifact: ArtifactRefSchema.optional(), inputReviewRequired: z.literal(true).optional() }).strict(),
  z.object({ ...CanvasNodeBase, kind: z.literal('result'), artifact: ArtifactRefSchema }).strict(),
  z.object({ ...CanvasNodeBase, kind: z.literal('group'), collapsed: z.boolean() }).strict(),
  z.object({ ...CreativeDomainNodeBase, kind: z.literal('asset'), artifact: ArtifactRefSchema }).strict(),
  z.object({ ...CreativeDomainNodeBase, kind: z.literal('character') }).strict(),
  z.object({ ...CreativeDomainNodeBase, kind: z.literal('scene') }).strict(),
  z.object({ ...CreativeDomainNodeBase, kind: z.literal('shot') }).strict(),
  z.object({ ...CreativeDomainNodeBase, kind: z.literal('candidate'), artifact: ArtifactRefSchema,
    operationId: IdentifierSchema.optional() }).strict(),
])
export const ProjectCanvasEdgeSchema = z.discriminatedUnion('kind', [
  z.object({ id: IdentifierSchema, kind: z.literal('reference'), source: IdentifierSchema, target: IdentifierSchema,
    label: LabelSchema.optional() }).strict(),
  z.object({ id: IdentifierSchema, kind: z.literal('execution'), source: IdentifierSchema, target: IdentifierSchema,
    output: IdentifierSchema, input: IdentifierSchema, purpose: IdentifierSchema }).strict(),
])
export const ProjectCanvasDocumentSchema = z.object({
  schema: z.literal(PROJECT_CANVAS_SCHEMA),
  scope: ProjectCanvasScopeSchema,
  id: IdentifierSchema,
  revision: z.number().int().nonnegative().safe(),
  camera: z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().finite().positive() }).strict(),
  nodes: z.array(ProjectCanvasNodeSchema).max(5_000),
  edges: z.array(ProjectCanvasEdgeSchema).max(20_000),
}).strict().superRefine((document, ctx) => {
  const nodes = new Map(document.nodes.map(node => [node.id, node]))
  if (nodes.size !== document.nodes.length) ctx.addIssue({ code: 'custom', message: 'duplicate node id' })
  if (new Set(document.edges.map(edge => edge.id)).size !== document.edges.length) {
    ctx.addIssue({ code: 'custom', message: 'duplicate edge id' })
  }
  for (const node of document.nodes) {
    const seen = new Set([node.id])
    let parent = node.groupId
    while (parent !== undefined) {
      if (seen.has(parent) || nodes.get(parent)?.kind !== 'group') {
        ctx.addIssue({ code: 'custom', message: 'invalid or cyclic group membership' })
        break
      }
      seen.add(parent)
      parent = nodes.get(parent)?.groupId
    }
  }
  for (const edge of document.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) ctx.addIssue({ code: 'custom', message: 'edge endpoint missing' })
    if (edge.kind === 'execution' && nodes.get(edge.target)?.kind !== 'operation') {
      ctx.addIssue({ code: 'custom', message: 'execution input must target an operation' })
    }
  }
  // Execution cycles remain editable drafts. The workflow planner must reject them before execution.
})
export type ProjectCanvasScope = z.infer<typeof ProjectCanvasScopeSchema>
export type ProjectCanvasNode = z.infer<typeof ProjectCanvasNodeSchema>
export type ProjectCanvasEdge = z.infer<typeof ProjectCanvasEdgeSchema>
export type ProjectCanvasDocument = z.infer<typeof ProjectCanvasDocumentSchema>

export const ProjectCanvasReadRequestSchema = z.object({ scope: ProjectCanvasScopeSchema, documentId: IdentifierSchema }).strict()
export const ProjectCanvasSaveRequestSchema = z.object({ requestId: IdentifierSchema, document: ProjectCanvasDocumentSchema }).strict()
export const ProjectCanvasReconcileRequestSchema = ProjectCanvasReadRequestSchema.extend({ requestId: IdentifierSchema }).strict()
/** Journaled save intent whose commit never settled; lets a later session reconcile instead of guessing. */
export const ProjectCanvasDraftSchema = z.object({
  requestId: IdentifierSchema,
  baseRevision: z.number().int().nonnegative().safe(),
  document: ProjectCanvasDocumentSchema,
}).strict()
export const ProjectCanvasReadResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), document: ProjectCanvasDocumentSchema, draft: ProjectCanvasDraftSchema.optional() }).strict(),
  z.object({ status: z.literal('missing'), draft: ProjectCanvasDraftSchema.optional() }).strict(),
  z.object({ status: z.enum(['unavailable', 'forbidden', 'invalid', 'error']) }).strict(),
])
export const ProjectCanvasSaveResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), requestId: IdentifierSchema, revision: z.number().int().positive().safe() }).strict(),
  z.object({ status: z.literal('conflict'), revision: z.number().int().nonnegative().safe() }).strict(),
  z.object({ status: z.literal('not_applied'), requestId: IdentifierSchema }).strict(),
  z.object({ status: z.enum(['unavailable', 'forbidden', 'invalid', 'unknown']) }).strict(),
])
export type ProjectCanvasReadRequest = z.infer<typeof ProjectCanvasReadRequestSchema>
export type ProjectCanvasSaveRequest = z.infer<typeof ProjectCanvasSaveRequestSchema>
export type ProjectCanvasDraft = z.infer<typeof ProjectCanvasDraftSchema>
export type ProjectCanvasReadResult = z.infer<typeof ProjectCanvasReadResultSchema>
export type ProjectCanvasSaveResult = z.infer<typeof ProjectCanvasSaveResultSchema>

/**
 * Additive, pre-release owner run projection on a canvas execution edge
 * (dsh-creative-pipeline-visual-workbench-v1). Read-only: it observes an
 * owner-owned run and never dispatches, retries, rolls back or replaces a
 * writer. Non-active statuses must carry a bounded blocker or reason so the
 * page never fabricates success; unknown/stale requires the owner to reconcile.
 */
export const PIPELINE_RUN_SCHEMA = 'dsh.pipeline-run.v1alpha1' as const
export const PipelineRunStatusSchema = z.enum([
  'running',
  'paused',
  'blocked',
  'stale',
  'unknown',
  'needs_contract',
  'partial',
])
export type PipelineRunStatus = z.infer<typeof PipelineRunStatusSchema>

const PIPELINE_RUN_INACTIVE_STATUSES: readonly PipelineRunStatus[] = ['blocked', 'stale', 'unknown', 'needs_contract', 'partial']

export const PipelineRunActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'reconcile']),
  enabled: z.boolean(),
  disabledReason: SummarySchema.optional(),
}).strict().superRefine((entry, ctx) => {
  if (!entry.enabled && entry.disabledReason === undefined) {
    ctx.addIssue({ code: 'custom', path: ['disabledReason'], message: 'a disabled run action must explain why' })
  }
})
export type PipelineRunActionV1 = z.infer<typeof PipelineRunActionSchema>

export const PipelineRunProjectionSchema = z.object({
  schema: z.literal(PIPELINE_RUN_SCHEMA),
  runRef: OpaqueRefSchema,
  executionEdgeRef: OpaqueRefSchema,
  status: PipelineRunStatusSchema,
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  blocker: z.object({ code: IdentifierSchema, reason: SummarySchema }).strict().optional(),
  reason: SummarySchema.optional(),
  actions: z.array(PipelineRunActionSchema).max(8),
  evidenceRefs: z.array(OpaqueRefSchema).max(64),
  version: z.string().min(1).max(160),
  cursor: z.string().min(1).max(256).optional(),
}).strict().superRefine((value, ctx) => {
  inspectSafeJson(value, ctx)
  const actions = value.actions.map(entry => entry.action)
  if (new Set(actions).size !== actions.length) {
    ctx.addIssue({ code: 'custom', path: ['actions'], message: 'run action entries must be unique' })
  }
  if (PIPELINE_RUN_INACTIVE_STATUSES.includes(value.status) && value.blocker === undefined && value.reason === undefined) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: `${value.status} runs must carry a bounded blocker or reason` })
  }
})
export type PipelineRunProjectionV1 = z.infer<typeof PipelineRunProjectionSchema>

export function parsePipelineRunProjection(input: unknown): PipelineRunProjectionV1 {
  return PipelineRunProjectionSchema.parse(input)
}

export function parseProjectCanvasDocument(input: unknown): ProjectCanvasDocument {
  return ProjectCanvasDocumentSchema.parse(input)
}

/**
 * Additive, pre-release 3D Director scene graph contract
 * (dsh-3d-director-gltf-workbench-v1). The workbench owns versioned scene
 * graph drafts only; domain assets, generation runs, approvals and delivery
 * facts stay with their owners and enter here as opaque refs, bounded
 * summaries and safe artifact refs. Revision conflicts reuse the project
 * canvas conflict + draft preservation pattern: a failed save never
 * overwrites, retries, or replaces the owner writer.
 */
export const SCENE_3D_SCHEMA = 'dsh.scene-3d.v1alpha1' as const

const GLTF_EXTENSION_NAME = /^(?:KHR|EXT|[A-Z][A-Z0-9]{1,15})_[A-Za-z0-9_]+$/
export const GltfExtensionNameSchema = z.string().min(3).max(80).regex(GLTF_EXTENSION_NAME)

/**
 * Official glTF 2.0 extension registry snapshot for v1alpha1: every ratified
 * Khronos extension (including the archived pbrSpecularGlossiness) plus the
 * multi-vendor EXT set. Capability levels are per-report data, not hardcoded
 * here; vendor extensions outside this list remain representable through the
 * same capability entry shape.
 */
export const GLTF_2_0_OFFICIAL_EXTENSIONS: readonly string[] = Object.freeze([
  'KHR_animation_pointer',
  'KHR_draco_mesh_compression',
  'KHR_gaussian_splatting',
  'KHR_interactivity',
  'KHR_lights_punctual',
  'KHR_materials_anisotropy',
  'KHR_materials_clearcoat',
  'KHR_materials_diffuse_transmission',
  'KHR_materials_dispersion',
  'KHR_materials_emissive_strength',
  'KHR_materials_ior',
  'KHR_materials_iridescence',
  'KHR_materials_pbrSpecularGlossiness',
  'KHR_materials_sheen',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_unlit',
  'KHR_materials_variants',
  'KHR_materials_volume',
  'KHR_materials_volume_scatter',
  'KHR_mesh_quantization',
  'KHR_texture_basisu',
  'KHR_texture_transform',
  'KHR_xmp_json_ld',
  'EXT_lights_ies',
  'EXT_mesh_gpu_instancing',
  'EXT_meshopt_compression',
  'EXT_texture_avif',
  'EXT_texture_webp',
])
const OFFICIAL_GLTF_EXTENSIONS = new Set(GLTF_2_0_OFFICIAL_EXTENSIONS)
export function isOfficialGltfExtension(name: string): boolean {
  return OFFICIAL_GLTF_EXTENSIONS.has(name)
}

/** opaque-preserved marks payloads kept verbatim for round-trip without edit support. */
export const GltfExtensionCapabilitySchema = z.object({
  name: GltfExtensionNameSchema,
  readable: z.boolean(),
  editable: z.boolean(),
  exportable: z.boolean(),
  opaquePreserved: z.boolean(),
  note: SummarySchema.optional(),
}).strict().superRefine((entry, ctx) => {
  if (entry.editable && !entry.readable) {
    ctx.addIssue({ code: 'custom', path: ['editable'], message: 'editable extensions must be readable' })
  }
  if (entry.exportable && !entry.readable) {
    ctx.addIssue({ code: 'custom', path: ['exportable'], message: 'exportable extensions must be readable' })
  }
})
export type GltfExtensionCapabilityV1 = z.infer<typeof GltfExtensionCapabilitySchema>

export const GltfCapabilityGapSchema = z.object({
  extension: GltfExtensionNameSchema.optional(),
  resourceRef: OpaqueRefSchema.optional(),
  reason: SummarySchema,
}).strict().superRefine((gap, ctx) => {
  if (gap.extension === undefined && gap.resourceRef === undefined) {
    ctx.addIssue({ code: 'custom', message: 'a capability gap must name an extension or a resource' })
  }
})
export type GltfCapabilityGapV1 = z.infer<typeof GltfCapabilityGapSchema>

/**
 * An export that cannot preserve a resource or extension is blocked and must
 * carry a concrete gap; nothing is silently discarded.
 */
export const GltfCapabilityReportSchema = z.object({
  gltfVersion: z.literal('2.0'),
  extensions: z.array(GltfExtensionCapabilitySchema).max(256),
  export: z.object({
    ready: z.boolean(),
    gaps: z.array(GltfCapabilityGapSchema).max(256),
  }).strict(),
}).strict().superRefine((report, ctx) => {
  const names = report.extensions.map(entry => entry.name)
  if (new Set(names).size !== names.length) {
    ctx.addIssue({ code: 'custom', path: ['extensions'], message: 'extension capability entries must be unique' })
  }
  const lossy = report.extensions.filter(entry => !entry.exportable && !entry.opaquePreserved)
  const gapExtensions = new Set(report.export.gaps.map(gap => gap.extension))
  if (lossy.length > 0) {
    if (report.export.ready) {
      ctx.addIssue({ code: 'custom', path: ['export', 'ready'], message: 'export must be blocked while an extension can neither be exported nor opaque-preserved' })
    }
    for (const entry of lossy) {
      if (!gapExtensions.has(entry.name)) {
        ctx.addIssue({ code: 'custom', path: ['export', 'gaps'], message: `extension ${entry.name} would lose data and must carry a capability gap` })
      }
    }
  }
  if (!report.export.ready && report.export.gaps.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['export', 'gaps'], message: 'a blocked export must list at least one capability gap' })
  }
})
export type GltfCapabilityReportV1 = z.infer<typeof GltfCapabilityReportSchema>

const Finite3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
const Scene3DTransformSchema = z.object({
  translate: Finite3,
  rotate: z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]),
  scale: Finite3,
}).strict()

const Scene3DNodeSchema = z.object({
  id: IdentifierSchema,
  label: LabelSchema,
  kind: z.enum(['mesh', 'camera', 'light', 'character', 'prop', 'environment', 'group']),
  parentId: IdentifierSchema.optional(),
  transform: Scene3DTransformSchema,
  visible: z.boolean(),
  resourceRef: OpaqueRefSchema.optional(),
  canvasNodeRef: OpaqueRefSchema.optional(),
}).strict()

const Scene3DSceneSchema = z.object({
  id: IdentifierSchema,
  label: LabelSchema,
  rootNodeIds: z.array(IdentifierSchema).max(1_000),
  default: z.boolean().optional(),
}).strict()

export const SceneDocumentSchema = z.object({
  schema: z.literal(SCENE_3D_SCHEMA),
  scope: ProjectCanvasScopeSchema,
  id: IdentifierSchema,
  /** Workbench scene graph revision; conflicts are detected against it. */
  version: z.number().int().nonnegative().safe(),
  scenes: z.array(Scene3DSceneSchema).max(256),
  nodes: z.array(Scene3DNodeSchema).max(10_000),
  resources: z.array(ArtifactRefSchema).max(1_000),
  extensions: z.object({
    used: z.array(GltfExtensionNameSchema).max(256),
    required: z.array(GltfExtensionNameSchema).max(256),
  }).strict(),
  capabilityReport: GltfCapabilityReportSchema,
}).strict().superRefine((document, ctx) => {
  inspectSafeJson(document, ctx)
  const nodes = new Map(document.nodes.map(node => [node.id, node]))
  if (nodes.size !== document.nodes.length) {
    ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'duplicate node id' })
  }
  for (const scene of document.scenes) {
    for (const root of scene.rootNodeIds) {
      if (!nodes.has(root)) ctx.addIssue({ code: 'custom', path: ['scenes'], message: `scene ${scene.id} root node missing` })
    }
  }
  if (document.scenes.filter(scene => scene.default === true).length > 1) {
    ctx.addIssue({ code: 'custom', path: ['scenes'], message: 'at most one default scene' })
  }
  for (const node of document.nodes) {
    const seen = new Set([node.id])
    let parent = node.parentId
    while (parent !== undefined) {
      if (seen.has(parent) || !nodes.has(parent)) {
        ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'invalid or cyclic node parent' })
        break
      }
      seen.add(parent)
      parent = nodes.get(parent)?.parentId
    }
  }
  const used = new Set(document.extensions.used)
  for (const required of document.extensions.required) {
    if (!used.has(required)) ctx.addIssue({ code: 'custom', path: ['extensions', 'required'], message: 'required extensions must also be listed as used' })
  }
  const capabilities = new Map(document.capabilityReport.extensions.map(entry => [entry.name, entry]))
  for (const name of document.extensions.used) {
    if (!capabilities.has(name)) {
      ctx.addIssue({ code: 'custom', path: ['capabilityReport'], message: `used extension ${name} must have a capability entry` })
    }
  }
  for (const required of document.extensions.required) {
    const capability = capabilities.get(required)
    if (capability && !capability.readable) {
      ctx.addIssue({ code: 'custom', path: ['capabilityReport'], message: `required extension ${required} is not readable` })
    }
  }
})
export type SceneDocumentV1 = z.infer<typeof SceneDocumentSchema>

const ShotKeyframeSchema = z.object({
  id: IdentifierSchema,
  frame: z.number().finite(),
  objectRef: OpaqueRefSchema,
  property: z.enum(['translate', 'rotate', 'scale', 'visibility']),
  value: z.union([Finite3, z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]), z.boolean()]),
}).strict()

const ShotDeliveryProjectionSchema = z.object({
  status: z.enum(['pending', 'ready', 'blocked', 'stale', 'unknown']),
  artifact: ArtifactRefSchema.optional(),
  summary: SummarySchema.optional(),
}).strict().superRefine((projection, ctx) => {
  if (['blocked', 'stale', 'unknown'].includes(projection.status) && projection.summary === undefined) {
    ctx.addIssue({ code: 'custom', path: ['summary'], message: `${projection.status} delivery must explain why` })
  }
})

export const ShotSchema = z.object({
  shotRef: OpaqueRefSchema,
  sceneRef: OpaqueRefSchema,
  version: z.string().min(1).max(160),
  cameraRef: OpaqueRefSchema,
  frameRange: z.object({
    start: z.number().finite(),
    end: z.number().finite(),
    fps: z.number().finite().positive(),
  }).strict().superRefine((range, ctx) => {
    if (range.start > range.end) ctx.addIssue({ code: 'custom', path: ['start'], message: 'frame range start must not exceed end' })
  }),
  keyframes: z.array(ShotKeyframeSchema).max(10_000),
  objectRefs: z.array(OpaqueRefSchema).max(5_000),
  visibility: z.array(z.object({ objectRef: OpaqueRefSchema, visible: z.boolean() }).strict()).max(5_000),
  generationRefs: z.array(OpaqueRefSchema).max(256),
  deliveryProjection: ShotDeliveryProjectionSchema,
}).strict().superRefine((value, ctx) => inspectSafeJson(value, ctx))
export type ShotV1 = z.infer<typeof ShotSchema>

export const CanvasBindingSchema = z.object({
  nodeRef: OpaqueRefSchema,
  shotRef: OpaqueRefSchema,
  sceneObjectRef: OpaqueRefSchema,
  edgeKind: z.enum(['reference', 'execution']),
  layout: z.object({
    position: CanvasPointSchema,
    size: z.object({ width: z.number().finite().positive(), height: z.number().finite().positive() }).strict().optional(),
  }).strict(),
}).strict().superRefine((value, ctx) => inspectSafeJson(value, ctx))
export type CanvasBindingV1 = z.infer<typeof CanvasBindingSchema>

export const GenerationChangeSetStatusSchema = z.enum([
  'pending',
  'preview',
  'accepted',
  'rejected',
  'rolled_back',
  'failed',
  'partial',
  'stale',
  'unknown',
])
export type GenerationChangeSetStatus = z.infer<typeof GenerationChangeSetStatusSchema>

const GENERATION_CHANGE_SET_EXPLAINED_STATUSES: readonly GenerationChangeSetStatus[] = ['failed', 'partial', 'stale', 'unknown']

export const GenerationChangeSetSchema = z.object({
  changeSetRef: OpaqueRefSchema,
  sceneRef: OpaqueRefSchema,
  baseVersion: z.number().int().nonnegative().safe(),
  inputRefs: z.array(OpaqueRefSchema).max(256),
  operationSummary: z.string().min(1).max(PANE_PROTOCOL_LIMITS.artifactSummaryChars),
  artifactRef: ArtifactRefSchema.optional(),
  previewRef: OpaqueRefSchema.optional(),
  patchDigest: z.string().min(8).max(160),
  status: GenerationChangeSetStatusSchema,
  reason: SummarySchema.optional(),
  rollbackRef: OpaqueRefSchema.optional(),
}).strict().superRefine((value, ctx) => {
  inspectSafeJson(value, ctx)
  if (GENERATION_CHANGE_SET_EXPLAINED_STATUSES.includes(value.status) && value.reason === undefined) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: `${value.status} change sets must carry a bounded reason; never auto-retry` })
  }
  if (value.status === 'preview' && value.previewRef === undefined) {
    ctx.addIssue({ code: 'custom', path: ['previewRef'], message: 'a preview change set must reference its preview artifact' })
  }
  if (value.status === 'accepted' && value.artifactRef === undefined) {
    ctx.addIssue({ code: 'custom', path: ['artifactRef'], message: 'an accepted change set must reference its resulting artifact' })
  }
  if (value.status === 'rolled_back' && value.rollbackRef === undefined) {
    ctx.addIssue({ code: 'custom', path: ['rollbackRef'], message: 'a rolled back change set must reference the restored revision' })
  }
})
export type GenerationChangeSetV1 = z.infer<typeof GenerationChangeSetSchema>

export const SceneGraphReadRequestSchema = z.object({ scope: ProjectCanvasScopeSchema, documentId: IdentifierSchema }).strict()
export const SceneGraphSaveRequestSchema = z.object({ requestId: IdentifierSchema, document: SceneDocumentSchema }).strict()
export const SceneGraphReconcileRequestSchema = SceneGraphReadRequestSchema.extend({ requestId: IdentifierSchema }).strict()
/** Journaled scene graph save intent whose commit never settled; preserved across conflicts. */
export const SceneGraphDraftSchema = z.object({
  requestId: IdentifierSchema,
  baseVersion: z.number().int().nonnegative().safe(),
  document: SceneDocumentSchema,
}).strict()
export const SceneGraphReadResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), document: SceneDocumentSchema, draft: SceneGraphDraftSchema.optional() }).strict(),
  z.object({ status: z.literal('missing'), draft: SceneGraphDraftSchema.optional() }).strict(),
  z.object({ status: z.enum(['unavailable', 'forbidden', 'invalid', 'error']) }).strict(),
])
export const SceneGraphSaveResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), requestId: IdentifierSchema, version: z.number().int().positive().safe() }).strict(),
  z.object({ status: z.literal('conflict'), version: z.number().int().nonnegative().safe() }).strict(),
  z.object({ status: z.literal('not_applied'), requestId: IdentifierSchema }).strict(),
  z.object({ status: z.enum(['unavailable', 'forbidden', 'invalid', 'unknown']) }).strict(),
])
export type SceneGraphReadRequest = z.infer<typeof SceneGraphReadRequestSchema>
export type SceneGraphSaveRequest = z.infer<typeof SceneGraphSaveRequestSchema>
export type SceneGraphDraft = z.infer<typeof SceneGraphDraftSchema>
export type SceneGraphReadResult = z.infer<typeof SceneGraphReadResultSchema>
export type SceneGraphSaveResult = z.infer<typeof SceneGraphSaveResultSchema>

export function parseSceneDocument(input: unknown): SceneDocumentV1 {
  return SceneDocumentSchema.parse(input)
}

export function parseShot(input: unknown): ShotV1 {
  return ShotSchema.parse(input)
}

export function parseCanvasBinding(input: unknown): CanvasBindingV1 {
  return CanvasBindingSchema.parse(input)
}

export function parseGenerationChangeSet(input: unknown): GenerationChangeSetV1 {
  return GenerationChangeSetSchema.parse(input)
}

export function parseGltfCapabilityReport(input: unknown): GltfCapabilityReportV1 {
  return GltfCapabilityReportSchema.parse(input)
}

export function parseSceneGraphReadResult(input: unknown): SceneGraphReadResult {
  return SceneGraphReadResultSchema.parse(input)
}

export function parseSceneGraphSaveResult(input: unknown): SceneGraphSaveResult {
  return SceneGraphSaveResultSchema.parse(input)
}
