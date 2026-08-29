/**
 * Interaction space contracts (P0). Headless, dependency-light (zod only):
 * agent→space typed directives, per-format proposals, bounded budgets and
 * fail-closed validation. Unknown kinds, dangling anchor references and
 * oversized payloads are rejected with a typed reason — never rendered.
 *
 * @module @yeisme/dsh-client-ui-interaction-space
 */

import { z } from 'zod'

export const SPACE_PROTOCOL_LIMITS = Object.freeze({
  anchorsPerSpace: 200,
  timelineEntries: 200,
  activeProposals: 16,
  diffPayloadBytes: 256 * 1024,
  promptChars: 512,
  optionChars: 120,
  optionsPerRequest: 6,
  hunksPerProposal: 16,
  cellsPerProposal: 256,
  fragmentChars: 64 * 1024,
  cellChars: 2 * 1024,
  hunkChars: 4 * 1024,
  stageChars: 64,
  directiveMergeWindowMs: 1_000,
})

const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,511}$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

const OpaqueRefSchema = z.string().regex(OPAQUE_REF)
const IsoSchema = z.string().regex(ISO_TIMESTAMP)
const DirectiveIdSchema = z.string().min(1).max(128)

// ---------------------------------------------------------------------------
// Proposals (per-format diff payloads)
// ---------------------------------------------------------------------------

export const SPACE_PROPOSAL_FORMATS = ['text-hunk', 'table-cells', 'image-pair', 'docx-fragment'] as const
export type SpaceProposalFormat = (typeof SPACE_PROPOSAL_FORMATS)[number]

const TextHunkSchema = z.strictObject({
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  before: z.string().max(SPACE_PROTOCOL_LIMITS.hunkChars),
  after: z.string().max(SPACE_PROTOCOL_LIMITS.hunkChars),
}).refine(hunk => hunk.endLine >= hunk.startLine, { message: 'endLine must be >= startLine' })

const TableCellSchema = z.strictObject({
  row: z.number().int().min(1),
  col: z.number().int().min(1),
  before: z.string().max(SPACE_PROTOCOL_LIMITS.cellChars),
  after: z.string().max(SPACE_PROTOCOL_LIMITS.cellChars),
})

const TextHunkPayloadSchema = z.strictObject({
  format: z.literal('text-hunk'),
  hunks: z.array(TextHunkSchema).min(1).max(SPACE_PROTOCOL_LIMITS.hunksPerProposal),
})

const TableCellsPayloadSchema = z.strictObject({
  format: z.literal('table-cells'),
  sheetId: z.string().min(1).max(128),
  cells: z.array(TableCellSchema).min(1).max(SPACE_PROTOCOL_LIMITS.cellsPerProposal),
})

/** Image pairs carry opaque refs; a host resolver turns them into short-lived URLs. */
const ImagePairPayloadSchema = z.strictObject({
  format: z.literal('image-pair'),
  beforeRef: OpaqueRefSchema,
  afterRef: OpaqueRefSchema,
})

/** Docx fragments are rendered as escaped text first; HTML diff is retain-next. */
const DocxFragmentPayloadSchema = z.strictObject({
  format: z.literal('docx-fragment'),
  beforeText: z.string().max(SPACE_PROTOCOL_LIMITS.fragmentChars),
  afterText: z.string().max(SPACE_PROTOCOL_LIMITS.fragmentChars),
})

export const SpaceProposalPayloadSchema = z.discriminatedUnion('format', [
  TextHunkPayloadSchema,
  TableCellsPayloadSchema,
  ImagePairPayloadSchema,
  DocxFragmentPayloadSchema,
])
export type SpaceProposalPayloadV1 = z.infer<typeof SpaceProposalPayloadSchema>

export const SpaceProposalSchema = z.strictObject({
  proposalId: z.string().min(1).max(128),
  anchorIds: z.array(z.string().min(1)).max(16),
  baseVersion: z.string().min(1).max(64),
  safeSummary: z.string().min(1).max(280),
  payload: SpaceProposalPayloadSchema,
})
export type SpaceProposalV1 = z.infer<typeof SpaceProposalSchema>

// ---------------------------------------------------------------------------
// Directives (agent → space)
// ---------------------------------------------------------------------------

export const SPACE_DIRECTIVE_KINDS = ['focus', 'highlight', 'propose', 'request-input', 'progress'] as const
export type SpaceDirectiveKind = (typeof SPACE_DIRECTIVE_KINDS)[number]

const FocusDirectiveSchema = z.strictObject({
  directiveId: DirectiveIdSchema,
  kind: z.literal('focus'),
  resourceKey: OpaqueRefSchema,
  createdAt: IsoSchema,
})

const HighlightDirectiveSchema = z.strictObject({
  directiveId: DirectiveIdSchema,
  kind: z.literal('highlight'),
  anchorIds: z.array(z.string().min(1)).min(1).max(64),
  createdAt: IsoSchema,
})

const ProposeDirectiveSchema = z.strictObject({
  directiveId: DirectiveIdSchema,
  kind: z.literal('propose'),
  proposal: SpaceProposalSchema,
  createdAt: IsoSchema,
})

const RequestInputDirectiveSchema = z.strictObject({
  directiveId: DirectiveIdSchema,
  kind: z.literal('request-input'),
  prompt: z.string().min(1).max(SPACE_PROTOCOL_LIMITS.promptChars),
  options: z.array(z.string().min(1).max(SPACE_PROTOCOL_LIMITS.optionChars)).max(SPACE_PROTOCOL_LIMITS.optionsPerRequest).optional(),
  createdAt: IsoSchema,
})

const ProgressDirectiveSchema = z.strictObject({
  directiveId: DirectiveIdSchema,
  kind: z.literal('progress'),
  runRef: OpaqueRefSchema,
  stage: z.string().min(1).max(SPACE_PROTOCOL_LIMITS.stageChars),
  percent: z.number().finite().min(0).max(100).optional(),
  createdAt: IsoSchema,
})

export const SpaceDirectiveSchema = z.discriminatedUnion('kind', [
  FocusDirectiveSchema,
  HighlightDirectiveSchema,
  ProposeDirectiveSchema,
  RequestInputDirectiveSchema,
  ProgressDirectiveSchema,
])
export type SpaceDirectiveV1 = z.infer<typeof SpaceDirectiveSchema>

export type DirectiveRejectionCode =
  | 'invalid_shape'
  | 'unknown_anchor'
  | 'diff_payload_too_large'
  | 'proposal_budget'
  | 'duplicate_directive'

export interface DirectiveRejection {
  readonly code: DirectiveRejectionCode
  readonly detail: string
}

export type DirectiveIngestResult =
  | { readonly ok: true; readonly directive: SpaceDirectiveV1 }
  | { readonly ok: false; readonly rejection: DirectiveRejection }

/** Approximate wire size of a proposal payload for the diff byte budget. */
export function proposalPayloadBytes(proposal: SpaceProposalV1): number {
  const text = JSON.stringify(proposal.payload)
  return text === undefined ? 0 : text.length
}

export interface DirectiveIngestContext {
  /** Anchor ids currently known to the space; dangling references reject. */
  readonly knownAnchorIds: ReadonlySet<string>
  /** Already-active proposal ids (excluding this one). */
  readonly activeProposalIds: ReadonlySet<string>
  /** Ids of directives already ingested (dedupe by directiveId). */
  readonly seenDirectiveIds: ReadonlySet<string>
}

/**
 * Validate one raw directive against the contract, the space's live anchor
 * table and the budgets. Pure: callers apply state changes after `ok`.
 */
export function ingestSpaceDirective(input: unknown, context: DirectiveIngestContext): DirectiveIngestResult {
  const parsed = SpaceDirectiveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, rejection: { code: 'invalid_shape', detail: parsed.error.issues[0]?.message ?? 'directive failed schema validation' } }
  }
  const directive = parsed.data
  if (context.seenDirectiveIds.has(directive.directiveId)) {
    return { ok: false, rejection: { code: 'duplicate_directive', detail: 'directiveId was already ingested' } }
  }
  if (directive.kind === 'highlight' || directive.kind === 'propose') {
    const referenced = directive.kind === 'highlight' ? directive.anchorIds : directive.proposal.anchorIds
    for (const anchorId of referenced) {
      if (!context.knownAnchorIds.has(anchorId)) {
        return { ok: false, rejection: { code: 'unknown_anchor', detail: `directive references unknown anchor ${anchorId}` } }
      }
    }
  }
  if (directive.kind === 'propose') {
    if (proposalPayloadBytes(directive.proposal) > SPACE_PROTOCOL_LIMITS.diffPayloadBytes) {
      return { ok: false, rejection: { code: 'diff_payload_too_large', detail: 'proposal payload exceeds the diff byte budget' } }
    }
    if (context.activeProposalIds.has(directive.proposal.proposalId)) {
      return { ok: false, rejection: { code: 'proposal_budget', detail: 'proposalId already active' } }
    }
    if (context.activeProposalIds.size >= SPACE_PROTOCOL_LIMITS.activeProposals) {
      return { ok: false, rejection: { code: 'proposal_budget', detail: 'active proposal budget reached' } }
    }
  }
  return { ok: true, directive }
}

/** Build a table-range anchor draft from grid data coordinates. */
export function tableRangeAnchorDraft(input: {
  anchorId: string
  artifactRef: string
  artifactVersion: string
  sheetId: string
  rowFrom: number
  rowTo: number
  colFrom: number
  colTo: number
  quotePreview: string
  quoteDigest: string
  createdAt: string
}): {
  kind: 'table-range'
  sheetId: string
  rowFrom: number
  rowTo: number
  colFrom: number
  colTo: number
  anchorId: string
  artifactRef: string
  artifactVersion: string
  quotePreview: string
  quoteDigest: string
  createdAt: string
  freshness: 'fresh'
} {
  const normalized = {
    rowFrom: Math.min(input.rowFrom, input.rowTo),
    rowTo: Math.max(input.rowFrom, input.rowTo),
    colFrom: Math.min(input.colFrom, input.colTo),
    colTo: Math.max(input.colFrom, input.colTo),
  }
  return {
    kind: 'table-range',
    anchorId: input.anchorId,
    artifactRef: input.artifactRef,
    artifactVersion: input.artifactVersion,
    sheetId: input.sheetId,
    ...normalized,
    quotePreview: input.quotePreview.slice(0, 512),
    quoteDigest: input.quoteDigest,
    createdAt: input.createdAt,
    freshness: 'fresh',
  }
}
