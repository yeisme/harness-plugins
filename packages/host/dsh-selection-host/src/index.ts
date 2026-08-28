/**
 * @yeisme/dsh-selection-host.
 *
 * Selection & Annotation Agent Interaction V1 contracts. This package owns the
 * anchor protocol (file range / markdown range / dom region / image point /
 * image region), annotation batches, multi-position proposals, per-hunk
 * approval semantics, version-fenced apply and layered capture contracts.
 *
 * It never owns filesystem state, conversation runtime state or screenshot
 * bytes; browser callers only see safe projections and opaque refs, and apply
 * actions never accept raw patch strings.
 *
 * @module @yeisme/dsh-selection-host
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Capability ids
// ---------------------------------------------------------------------------

export const SELECTION_ANNOTATION_CAPABILITY = 'SelectionAnnotationCapabilityV1'
export const SELECTION_PROPOSAL_CAPABILITY = 'SelectionProposalCapabilityV1'
export const WEB_CAPTURE_CAPABILITY = 'WebCaptureCapabilityV1'
export const DESKTOP_CAPTURE_CAPABILITY = 'DesktopCaptureCapabilityV1'

// ---------------------------------------------------------------------------
// Bounded contract limits
// ---------------------------------------------------------------------------

export const SELECTION_PROTOCOL_LIMITS = Object.freeze({
  quotePreviewChars: 512,
  markerMinPerScreenshot: 20,
  markerMaxPerScreenshot: 200,
  batchTitleChars: 160,
  safeSummaryChars: 280,
  markerDigits: 3,
  dependenciesPerHunk: 16,
})

const SHA256_HEX = /^[0-9a-f]{64}$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/
const MARKER_LABEL = /^#\d{1,3}$/

/** Keys that must never appear inside persisted anchors, batches or receipts. */
export const UNSAFE_FIELD_KEYS: ReadonlySet<string> = new Set([
  'absolutepath',
  'authorization',
  'cookie',
  'credential',
  'password',
  'privatearguments',
  'providerpayload',
  'rawprompt',
  'secret',
  'token',
])

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

export type AnchorKind = 'file-range' | 'markdown-range' | 'dom-region' | 'image-point' | 'image-region'
export type AnchorFreshness = 'fresh' | 'stale' | 'unmapped' | 'revoked'
export type ComposerIntent = 'ask' | 'comment' | 'edit'
export type ApprovalPolicy = 'preview-first' | 'auto-apply'

/** Normalized image coordinates live in 0..1 so markers survive rescale and DPI. */
export interface ImageRegionV1 {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ReanchorEvidenceV1 {
  readonly method: 'source-line-hints' | 'quote-digest-match' | 'artifact-version' | 'none'
  readonly matched: boolean
  readonly detail?: string
}

export interface AnchorBaseV1 {
  readonly anchorId: string
  readonly artifactRef: string
  readonly artifactVersion: string
  readonly kind: AnchorKind
  readonly quotePreview: string
  readonly quoteDigest: string
  readonly createdAt: string
  readonly freshness: AnchorFreshness
  readonly reanchorEvidence?: ReanchorEvidenceV1
  /** 1-based marker inside the owning batch; referenced as `#N` in agent replies. */
  readonly marker?: number
}

export interface FileRangeAnchorV1 extends AnchorBaseV1 {
  readonly kind: 'file-range'
  readonly startLine: number
  readonly endLine: number
  readonly startColumn: number
  readonly endColumn: number
}

export interface MarkdownRangeAnchorV1 extends AnchorBaseV1 {
  readonly kind: 'markdown-range'
  readonly sourceArtifactRef: string
  readonly sourceStartLine: number
  readonly sourceEndLine: number
}

export interface DomRegionAnchorV1 extends AnchorBaseV1 {
  readonly kind: 'dom-region'
  /** Digest of a stable selector description; raw selectors may leak paths. */
  readonly selectorDigest: string
  /** `false` for rendered-only selections with no source mapping (never fake line numbers). */
  readonly sourceMapped: false
  readonly unmappedReason?: string
}

export interface ImagePointAnchorV1 extends AnchorBaseV1 {
  readonly kind: 'image-point'
  readonly x: number
  readonly y: number
  readonly domMapped?: boolean
}

export interface ImageRegionAnchorV1 extends AnchorBaseV1 {
  readonly kind: 'image-region'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly domMapped?: boolean
}

export type SelectionAnchorV1 =
  | FileRangeAnchorV1
  | MarkdownRangeAnchorV1
  | DomRegionAnchorV1
  | ImagePointAnchorV1
  | ImageRegionAnchorV1

// ---------------------------------------------------------------------------
// Annotation batch
// ---------------------------------------------------------------------------

export type AnnotationBatchStatus = 'draft' | 'submitted' | 'resolved'

export interface AnnotationBatchV1 {
  readonly batchId: string
  readonly title: string
  readonly anchors: readonly SelectionAnchorV1[]
  readonly conversationRef?: string
  readonly status: AnnotationBatchStatus
  readonly createdAt: string
  readonly submittedAt?: string
}

/** Safe projection handed to the agent: numbered anchors only, untrusted context. */
export interface AgentBatchRequestV1 {
  readonly batchId: string
  readonly title: string
  readonly markers: readonly {
    readonly marker: number
    readonly label: string
    readonly kind: AnchorKind
    readonly quotePreview: string
    readonly freshness: AnchorFreshness
  }[]
  /** Page/file/screenshot content is untrusted material, never instructions. */
  readonly untrustedContext: true
  readonly replyContract: 'reply-must-reference-markers'
}

// ---------------------------------------------------------------------------
// Proposal & approval
// ---------------------------------------------------------------------------

export type HunkDecision = 'pending' | 'approved' | 'rejected' | 'revision_requested' | 'deferred'
export type HunkStatus = HunkDecision | 'stale' | 'applying' | 'applied' | 'failed' | 'reconcile_required'

export interface ProposalHunkV1 {
  readonly hunkId: string
  readonly anchorId: string
  readonly owner: string
  readonly baseVersion: string
  readonly safeSummary: string
  /** Owner-side patch handle. Browsers never see or submit patch text. */
  readonly patchRef: string
  readonly dependencies: readonly string[]
  /**
   * Single state field per the spec state model: decision values
   * (pending/approved/rejected/revision_requested/deferred) plus lifecycle
   * values (stale/applying/applied/failed/reconcile_required).
   */
  readonly decision: HunkStatus
}

export interface ProposalV1 {
  readonly proposalId: string
  readonly batchId?: string
  readonly title: string
  readonly hunks: readonly ProposalHunkV1[]
  readonly createdAt: string
}

export type ReceiptAction = 'approve' | 'reject' | 'revision' | 'defer' | 'apply' | 'reconcile' | 'stale'
export type ReceiptStatus = 'ok' | 'conflict' | 'blocked' | 'failed'

export interface ApplyReceiptV1 {
  readonly receiptId: string
  readonly proposalId: string
  readonly hunkId: string
  readonly anchorId: string
  readonly action: ReceiptAction
  readonly status: ReceiptStatus
  readonly artifactRef?: string
  readonly baseVersion?: string
  readonly resultingVersion?: string
  readonly reason?: string
  readonly decidedAt: string
}

// ---------------------------------------------------------------------------
// Version-fenced apply contract
// ---------------------------------------------------------------------------

export interface VersionedFileStoreV1 {
  currentVersion(artifactRef: string): string | undefined
  readLines(artifactRef: string): readonly string[] | undefined
  writeLines(
    artifactRef: string,
    lines: readonly string[],
    expectedVersion: string,
  ): { status: 'ok'; version: string } | { status: 'conflict' }
}

export interface ApplyPlanBlocker {
  readonly hunkId: string
  readonly dependsOn: string
  readonly reason: 'dependency-rejected' | 'dependency-revision-requested' | 'dependency-awaiting-decision' | 'dependency-missing'
}

export interface ApplyPlanConflict {
  readonly hunkId: string
  readonly artifactRef: string
  readonly expected: string
  readonly actual: string
}

export interface ApplyPlanV1 {
  readonly appliable: readonly string[]
  readonly blocked: readonly ApplyPlanBlocker[]
  readonly conflicts: readonly ApplyPlanConflict[]
  readonly rejected: readonly string[]
}

// ---------------------------------------------------------------------------
// Capture contracts (layered by owner)
// ---------------------------------------------------------------------------

export type WebCaptureKind = 'viewport' | 'full-page'
export type DesktopCaptureKind = 'window' | 'full-desktop'
export type CaptureKind = WebCaptureKind | DesktopCaptureKind

export interface CaptureRedactionPolicyV1 {
  readonly maskPasswordInputs: true
  readonly privateRegionCount: number
}

export interface CaptureScopePreviewV1 {
  readonly kind: CaptureKind
  readonly redaction: CaptureRedactionPolicyV1
  /** Users see the scope before the frozen canvas is produced. */
  readonly requiresConfirmation: true
}

/** Screenshot bytes stay owner-side; the browser only receives this ref card. */
export interface ScreenshotArtifactV1 {
  readonly artifactRef: string
  readonly width: number
  readonly height: number
  readonly createdAt: string
  readonly retentionDays: number
  readonly redactedRegions: readonly ImageRegionV1[]
  readonly digest: string
  readonly deletedAt?: string
}

export interface WebCaptureAdapterV1 {
  readonly capability: typeof WEB_CAPTURE_CAPABILITY
  previewScope(kind: WebCaptureKind): CaptureScopePreviewV1
  capture(kind: WebCaptureKind): Promise<ScreenshotArtifactV1>
  deleteArtifact(artifactRef: string): Promise<void>
}

export interface DesktopCaptureAdapterV1 {
  readonly capability: typeof DESKTOP_CAPTURE_CAPABILITY
  previewScope(kind: DesktopCaptureKind): CaptureScopePreviewV1
  capture(kind: DesktopCaptureKind): Promise<ScreenshotArtifactV1>
  deleteArtifact(artifactRef: string): Promise<void>
}

export interface CapabilityProbe {
  readonly available: boolean
  readonly missingCapability?: string
  readonly reason: string
}

/** Web can never obtain system screen permission; desktop stays a Desktop Client owner. */
export function probeDesktopCaptureOnWeb(): CapabilityProbe {
  return {
    available: false,
    missingCapability: DESKTOP_CAPTURE_CAPABILITY,
    reason: 'system window / full desktop capture requires the Desktop Client owner; web cannot obtain screen permission',
  }
}

export function probeWebCapture(adapter: WebCaptureAdapterV1 | undefined): CapabilityProbe {
  if (adapter === undefined) {
    return { available: false, missingCapability: WEB_CAPTURE_CAPABILITY, reason: 'web capture adapter is not mounted' }
  }
  return { available: true, reason: 'web capture adapter mounted' }
}

// ---------------------------------------------------------------------------
// Digest helpers
// ---------------------------------------------------------------------------

export function isQuoteDigest(value: string): boolean {
  return SHA256_HEX.test(value)
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function computeQuoteDigest(text: string): Promise<string> {
  return sha256Hex(text)
}

export function markerLabel(marker: number): string {
  return `#${marker}`
}

export function isMarkerLabel(value: string): boolean {
  return MARKER_LABEL.test(value)
}

/** Strip unsafe keys from arbitrary records before they reach logs or evidence. */
export function redactUnsafeFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => redactUnsafeFields(item)) as unknown as T
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (UNSAFE_FIELD_KEYS.has(key.toLowerCase())) {
        out[key] = '[REDACTED]'
      } else {
        out[key] = redactUnsafeFields(inner)
      }
    }
    return out as unknown as T
  }
  return value
}

// ---------------------------------------------------------------------------
// Zod contracts (fail-closed, strict objects = field allowlist)
// ---------------------------------------------------------------------------

const DigestSchema = z.string().regex(SHA256_HEX)
const OpaqueRefSchema = z.string().regex(OPAQUE_REF)
const IsoSchema = z.string().regex(ISO_TIMESTAMP)
const PositiveLineSchema = z.number().int().min(1)
const NonNegativeColumnSchema = z.number().int().min(0)
const UnitIntervalSchema = z.number().finite().min(0).max(1)
const MarkerSchema = z.number().int().min(1).max(SELECTION_PROTOCOL_LIMITS.markerMaxPerScreenshot)

const AnchorBaseSchema = z.strictObject({
  anchorId: z.string().min(1),
  artifactRef: OpaqueRefSchema,
  artifactVersion: z.string().min(1),
  kind: z.enum(['file-range', 'markdown-range', 'dom-region', 'image-point', 'image-region']),
  quotePreview: z.string().max(SELECTION_PROTOCOL_LIMITS.quotePreviewChars),
  quoteDigest: DigestSchema,
  createdAt: IsoSchema,
  freshness: z.enum(['fresh', 'stale', 'unmapped', 'revoked']),
  reanchorEvidence: z.strictObject({
    method: z.enum(['source-line-hints', 'quote-digest-match', 'artifact-version', 'none']),
    matched: z.boolean(),
    detail: z.string().max(280).optional(),
  }).optional(),
  marker: MarkerSchema.optional(),
})

const ReanchorEvidenceSchema = AnchorBaseSchema.shape.reanchorEvidence

export const FileRangeAnchorSchema = AnchorBaseSchema.extend({
  kind: z.literal('file-range'),
  startLine: PositiveLineSchema,
  endLine: PositiveLineSchema,
  startColumn: NonNegativeColumnSchema,
  endColumn: NonNegativeColumnSchema,
}).refine(anchor => anchor.endLine >= anchor.startLine, { message: 'endLine must be >= startLine' })
  .refine(anchor => anchor.endLine !== anchor.startLine || anchor.endColumn >= anchor.startColumn, {
    message: 'endColumn must be >= startColumn on a single line',
  })

export const MarkdownRangeAnchorSchema = AnchorBaseSchema.extend({
  kind: z.literal('markdown-range'),
  sourceArtifactRef: OpaqueRefSchema,
  sourceStartLine: PositiveLineSchema,
  sourceEndLine: PositiveLineSchema,
}).refine(anchor => anchor.sourceEndLine >= anchor.sourceStartLine, {
  message: 'sourceEndLine must be >= sourceStartLine',
})

export const DomRegionAnchorSchema = AnchorBaseSchema.extend({
  kind: z.literal('dom-region'),
  selectorDigest: DigestSchema,
  sourceMapped: z.literal(false),
  unmappedReason: z.string().max(160).optional(),
})

export const ImagePointAnchorSchema = AnchorBaseSchema.extend({
  kind: z.literal('image-point'),
  x: UnitIntervalSchema,
  y: UnitIntervalSchema,
  domMapped: z.boolean().optional(),
})

export const ImageRegionAnchorSchema = AnchorBaseSchema.extend({
  kind: z.literal('image-region'),
  x: UnitIntervalSchema,
  y: UnitIntervalSchema,
  width: UnitIntervalSchema,
  height: UnitIntervalSchema,
}).refine(anchor => anchor.x + anchor.width <= 1 + Number.EPSILON, { message: 'region exceeds image width' })
  .refine(anchor => anchor.y + anchor.height <= 1 + Number.EPSILON, { message: 'region exceeds image height' })

export const SelectionAnchorSchema = z.discriminatedUnion('kind', [
  FileRangeAnchorSchema,
  MarkdownRangeAnchorSchema,
  DomRegionAnchorSchema,
  ImagePointAnchorSchema,
  ImageRegionAnchorSchema,
])

export const AnnotationBatchSchema = z.strictObject({
  batchId: z.string().min(1),
  title: z.string().min(1).max(SELECTION_PROTOCOL_LIMITS.batchTitleChars),
  anchors: z.array(SelectionAnchorSchema).min(1),
  conversationRef: OpaqueRefSchema.optional(),
  status: z.enum(['draft', 'submitted', 'resolved']),
  createdAt: IsoSchema,
  submittedAt: IsoSchema.optional(),
}).refine(batch => new Set(batch.anchors.map(anchor => anchor.anchorId)).size === batch.anchors.length, {
  message: 'anchor ids must be unique inside a batch',
})

export const ProposalHunkSchema = z.strictObject({
  hunkId: z.string().min(1),
  anchorId: z.string().min(1),
  owner: z.string().min(1),
  baseVersion: z.string().min(1),
  safeSummary: z.string().min(1).max(SELECTION_PROTOCOL_LIMITS.safeSummaryChars),
  patchRef: OpaqueRefSchema,
  dependencies: z.array(z.string().min(1)).max(SELECTION_PROTOCOL_LIMITS.dependenciesPerHunk),
  decision: z.enum([
    'pending',
    'approved',
    'rejected',
    'revision_requested',
    'deferred',
    'stale',
    'applying',
    'applied',
    'failed',
    'reconcile_required',
  ]),
})

export const ProposalSchema = z.strictObject({
  proposalId: z.string().min(1),
  batchId: OpaqueRefSchema.optional(),
  title: z.string().min(1).max(SELECTION_PROTOCOL_LIMITS.batchTitleChars),
  hunks: z.array(ProposalHunkSchema).min(1),
  createdAt: IsoSchema,
})

export const ApplyReceiptSchema = z.strictObject({
  receiptId: z.string().min(1),
  proposalId: z.string().min(1),
  hunkId: z.string().min(1),
  anchorId: z.string().min(1),
  action: z.enum(['approve', 'reject', 'revision', 'defer', 'apply', 'reconcile', 'stale']),
  status: z.enum(['ok', 'conflict', 'blocked', 'failed']),
  artifactRef: OpaqueRefSchema.optional(),
  baseVersion: z.string().min(1).optional(),
  resultingVersion: z.string().min(1).optional(),
  reason: z.string().max(280).optional(),
  decidedAt: IsoSchema,
})

export const ImageRegionSchema = z.strictObject({
  x: UnitIntervalSchema,
  y: UnitIntervalSchema,
  width: UnitIntervalSchema,
  height: UnitIntervalSchema,
})

export const ScreenshotArtifactSchema = z.strictObject({
  artifactRef: OpaqueRefSchema,
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  createdAt: IsoSchema,
  retentionDays: z.number().int().min(1).max(365),
  redactedRegions: z.array(ImageRegionSchema),
  digest: DigestSchema,
  deletedAt: IsoSchema.optional(),
})

export type SelectionAnchorInput = z.input<typeof SelectionAnchorSchema>
export type AnnotationBatchInput = z.input<typeof AnnotationBatchSchema>
export type ApplyReceiptInput = z.input<typeof ApplyReceiptSchema>

export function parseSelectionAnchor(value: unknown): SelectionAnchorV1 {
  return SelectionAnchorSchema.parse(value) as SelectionAnchorV1
}

export function safeParseSelectionAnchor(value: unknown) {
  return SelectionAnchorSchema.safeParse(value)
}

export function parseAnnotationBatch(value: unknown): AnnotationBatchV1 {
  return AnnotationBatchSchema.parse(value) as AnnotationBatchV1
}

export function parseApplyReceipt(value: unknown): ApplyReceiptV1 {
  return ApplyReceiptSchema.parse(value) as ApplyReceiptV1
}

// ---------------------------------------------------------------------------
// Hunk state machine
// ---------------------------------------------------------------------------

const ALLOWED_HUNK_TRANSITIONS: Readonly<Record<HunkStatus, readonly HunkStatus[]>> = Object.freeze({
  pending: ['approved', 'rejected', 'revision_requested', 'deferred', 'stale'],
  approved: ['applying', 'stale', 'rejected'],
  rejected: [],
  revision_requested: ['pending', 'rejected'],
  deferred: ['pending', 'rejected'],
  stale: ['pending', 'rejected'],
  applying: ['applied', 'failed', 'reconcile_required'],
  applied: [],
  failed: ['applying', 'rejected'],
  reconcile_required: ['pending', 'rejected'],
})

export function canTransitionHunk(from: HunkStatus, to: HunkStatus): boolean {
  return (ALLOWED_HUNK_TRANSITIONS[from] ?? []).includes(to)
}

export function assertHunkTransition(from: HunkStatus, to: HunkStatus): void {
  if (!canTransitionHunk(from, to)) {
    throw new Error(`invalid hunk transition ${from} -> ${to}`)
  }
}

// ---------------------------------------------------------------------------
// Partial-apply planner (pure; shared by host service and client panel)
// ---------------------------------------------------------------------------

/**
 * Plan a partial apply. Only approved hunks whose dependency closure is fully
 * approved and whose baseVersion still matches the artifact version are
 * appliable. Dependent hunks are blocked (never partially applied) and drifted
 * hunks surface as conflicts that require reconcile, never silent overwrite.
 */
export function planPartialApply(
  proposal: ProposalV1,
  currentVersions: ReadonlyMap<string, string>,
  artifactRefFor: (hunk: ProposalHunkV1) => string | undefined,
): ApplyPlanV1 {
  const byId = new Map(proposal.hunks.map(hunk => [hunk.hunkId, hunk]))
  const statusOf = (hunkId: string): HunkStatus | undefined => byId.get(hunkId)?.decision
  const blocked: ApplyPlanBlocker[] = []
  const conflicts: ApplyPlanConflict[] = []
  const rejected: string[] = []
  const appliable: string[] = []

  const dependencyClosed = (hunk: ProposalHunkV1, seen: Set<string> = new Set()): boolean => {
    for (const dep of hunk.dependencies) {
      if (seen.has(dep)) return false
      seen.add(dep)
      const status = statusOf(dep)
      if (status === undefined) {
        blocked.push({ hunkId: hunk.hunkId, dependsOn: dep, reason: 'dependency-missing' })
        return false
      }
      if (status === 'rejected') {
        blocked.push({ hunkId: hunk.hunkId, dependsOn: dep, reason: 'dependency-rejected' })
        return false
      }
      if (status === 'revision_requested') {
        blocked.push({ hunkId: hunk.hunkId, dependsOn: dep, reason: 'dependency-revision-requested' })
        return false
      }
      if (status !== 'approved') {
        blocked.push({ hunkId: hunk.hunkId, dependsOn: dep, reason: 'dependency-awaiting-decision' })
        return false
      }
      const depHunk = byId.get(dep)
      if (depHunk !== undefined && !dependencyClosed(depHunk, seen)) return false
    }
    return true
  }

  for (const hunk of proposal.hunks) {
    if (hunk.decision === 'rejected') {
      rejected.push(hunk.hunkId)
      continue
    }
    if (hunk.decision !== 'approved') continue
    if (!dependencyClosed(hunk)) continue
    const artifactRef = artifactRefFor(hunk)
    if (artifactRef === undefined) {
      conflicts.push({ hunkId: hunk.hunkId, artifactRef: hunk.patchRef, expected: hunk.baseVersion, actual: 'unknown-artifact' })
      continue
    }
    const actual = currentVersions.get(artifactRef)
    if (actual === undefined || actual !== hunk.baseVersion) {
      conflicts.push({
        hunkId: hunk.hunkId,
        artifactRef,
        expected: hunk.baseVersion,
        actual: actual ?? 'missing',
      })
      continue
    }
    appliable.push(hunk.hunkId)
  }

  return { appliable, blocked, conflicts, rejected }
}

/**
 * Group appliable hunks per artifact. Hunks sharing an artifact are applied as
 * one version-fenced write; inconsistent baseVersions for the same artifact
 * surface as conflicts.
 */
export function groupHunksByArtifact(
  proposal: ProposalV1,
  hunkIds: readonly string[],
  artifactRefFor: (hunk: ProposalHunkV1) => string | undefined,
): { groups: Map<string, ProposalHunkV1[]>; conflicts: ApplyPlanConflict[] } {
  const groups = new Map<string, ProposalHunkV1[]>()
  const conflicts: ApplyPlanConflict[] = []
  for (const hunkId of hunkIds) {
    const hunk = proposal.hunks.find(candidate => candidate.hunkId === hunkId)
    if (hunk === undefined) continue
    const artifactRef = artifactRefFor(hunk)
    if (artifactRef === undefined) {
      conflicts.push({ hunkId, artifactRef: hunk.patchRef, expected: hunk.baseVersion, actual: 'unknown-artifact' })
      continue
    }
    const group = groups.get(artifactRef) ?? []
    const firstInGroup = group[0]
    if (firstInGroup !== undefined && firstInGroup.baseVersion !== hunk.baseVersion) {
      conflicts.push({
        hunkId,
        artifactRef,
        expected: hunk.baseVersion,
        actual: firstInGroup.baseVersion,
      })
      continue
    }
    group.push(hunk)
    groups.set(artifactRef, group)
  }
  return { groups, conflicts }
}

// ---------------------------------------------------------------------------
// Service contract
// ---------------------------------------------------------------------------

export interface AnchorDraftV1 {
  readonly artifactRef: string
  readonly artifactVersion: string
  readonly quotePreview: string
  readonly quoteDigest: string
  readonly createdAt?: string
  readonly freshness?: AnchorFreshness
  readonly reanchorEvidence?: ReanchorEvidenceV1
}

export type FileRangeDraftV1 = AnchorDraftV1 & {
  readonly kind: 'file-range'
  readonly startLine: number
  readonly endLine: number
  readonly startColumn: number
  readonly endColumn: number
}

export type MarkdownRangeDraftV1 = AnchorDraftV1 & {
  readonly kind: 'markdown-range'
  readonly sourceArtifactRef: string
  readonly sourceStartLine: number
  readonly sourceEndLine: number
}

export type DomRegionDraftV1 = AnchorDraftV1 & {
  readonly kind: 'dom-region'
  readonly selectorDigest: string
  readonly sourceMapped: false
  readonly unmappedReason?: string
}

export type ImagePointDraftV1 = AnchorDraftV1 & {
  readonly kind: 'image-point'
  readonly x: number
  readonly y: number
  readonly domMapped?: boolean
}

export type ImageRegionDraftV1 = AnchorDraftV1 & {
  readonly kind: 'image-region'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly domMapped?: boolean
}

export type AnchorDraft =
  | FileRangeDraftV1
  | MarkdownRangeDraftV1
  | DomRegionDraftV1
  | ImagePointDraftV1
  | ImageRegionDraftV1

/** Host-side patch registration; only owner/agent adapters may call this. */
export interface PatchRangeV1 {
  readonly startLine: number
  readonly endLine: number
  readonly replacement: readonly string[]
}

export interface PatchRegistrationV1 {
  readonly artifactRef: string
  readonly baseVersion: string
  readonly ranges: readonly PatchRangeV1[]
}

export interface CreateProposalInputV1 {
  readonly title: string
  readonly batchId?: string
  readonly hunks: readonly {
    /** Caller-known alias so dependency edges can be expressed before ids exist. */
    readonly key?: string
    readonly anchorId: string
    readonly owner: string
    readonly baseVersion: string
    readonly safeSummary: string
    readonly patchRef: string
    /** References other `key`s or anchorIds inside this same proposal. */
    readonly dependencies?: readonly string[]
  }[]
}

/**
 * Owner-side selection annotation service. The browser-facing surface only
 * accepts ids and decisions; patch content lives behind `patchRef` handles
 * registered host-side.
 */
export interface SelectionAnnotationServiceV1 {
  readonly version: '0.1.0-rc.1'
  readonly capability: 'selection-annotation'
  publishAnchor(draft: AnchorDraft): SelectionAnchorV1
  getAnchor(anchorId: string): SelectionAnchorV1 | undefined
  createBatch(input: { title: string; anchorIds: readonly string[]; conversationRef?: string }): AnnotationBatchV1
  submitBatch(batchId: string): AnnotationBatchV1
  resolveBatch(batchId: string): AnnotationBatchV1
  buildAgentRequest(batchId: string): AgentBatchRequestV1
  registerPatch(registration: PatchRegistrationV1): string
  createProposal(input: CreateProposalInputV1): ProposalV1
  getProposal(proposalId: string): ProposalV1 | undefined
  decide(proposalId: string, hunkId: string, decision: Exclude<HunkDecision, 'pending'>): ApplyReceiptV1
  applyApproved(proposalId: string): readonly ApplyReceiptV1[]
  refreshStaleness(proposalId: string): readonly ApplyReceiptV1[]
  receipts(proposalId: string): readonly ApplyReceiptV1[]
}

export { ReanchorEvidenceSchema }
