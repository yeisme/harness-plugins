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
  presentation: PanePresentationSchema.optional(),
}).strict().superRefine((value, ctx) => {
  inspectSafeJson(value, ctx)
  const keys = value.fields.map(field => field.key)
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
}).strict().superRefine((value, ctx) => {
  if (Object.keys(value.values).length > PANE_PROTOCOL_LIMITS.actionFields) {
    ctx.addIssue({ code: 'custom', path: ['values'], message: 'too many action values' })
  }
})
export type PaneActionRequestV1 = z.infer<typeof PaneActionRequestSchema>

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
