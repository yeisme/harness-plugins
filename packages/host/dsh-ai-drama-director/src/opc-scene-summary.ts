/**
 * Scaena OPC scene package summary typed adapter (opc-scene 1.1).
 *
 * Consumer-side contract for `scaena.opc-scene-package-summary.v1alpha1`:
 * the DSH host validates the owner projection before any client surface
 * renders it. Validation is fail-closed: refs must be opaque safe tokens and
 * the whole payload must reject raw prompts, provider payloads, credentials,
 * signed URLs, absolute paths, and shell fragments. The adapter never
 * recomputes readiness, gates, or actions and never mutates owner state.
 *
 * @module @yeisme/dsh-ai-drama-director
 */

export const OPC_SCENE_PACKAGE_SUMMARY_SCHEMA = 'scaena.opc-scene-package-summary.v1alpha1' as const

/** Canonical redacted fixture version for cross-entry conformance work. */
export const OPC_SCENE_SUMMARY_FIXTURE_VERSION = '2026-09-02.1' as const

export type OpcSceneFreshnessV1 = 'fresh' | 'stale' | 'partial' | 'unknown' | 'offline'

export type OpcSceneGateIdV1 = 'direction_confirm' | 'visual_foundation_accept' | 'export_confirm'

export type OpcSceneGateStateV1 = 'pending' | 'accepted'

export type OpcSceneExceptionKindV1 =
  | 'rights'
  | 'cost'
  | 'stale'
  | 'unknown'
  | 'partial'
  | 'owner_offline'
  | 'originality_similarity'
  | 'plan_amendment'

export type OpcSceneSideEffectClassV1 = 'read_only' | 'owner_write' | 'billable' | 'export'

export type OpcSceneAspectV1 = '9:16' | '16:9'

export type OpcSceneDepthV1 = 'balanced' | 'cinematic'

/** Scaena server-authored action descriptor; the only action source DSH has. */
export interface OpcSceneActionDescriptorV1 {
  readonly actionId: string
  readonly label: string
  readonly targetRef: string
  readonly expectedVersion: string
  readonly sideEffectClass: OpcSceneSideEffectClassV1
  readonly requiresConfirmation: boolean
  readonly idempotencyKey: string
  /** Owner-authored copyable CLI/API detail; printable safe text only. */
  readonly cliDetail?: string
  readonly apiDetail?: string
}

/** Triggered finding; only rendered when present, never pre-computed. */
export interface OpcSceneExceptionFindingV1 {
  readonly kind: OpcSceneExceptionKindV1
  readonly affectedRef: string
  readonly reasonCode: string
  readonly evidenceRefs: readonly string[]
  readonly recoveryAction?: OpcSceneActionDescriptorV1
  readonly reconcileRef?: string
}

export interface OpcSceneGateV1 {
  readonly id: OpcSceneGateIdV1
  readonly state: OpcSceneGateStateV1
}

/** Secondary aspect or depth variant; never replaces the primary aspect. */
export interface OpcSceneReframeVariantV1 {
  readonly aspect: OpcSceneAspectV1
  readonly depth: OpcSceneDepthV1
  readonly status: 'recommended' | 'confirmed'
  readonly reason: string
  readonly impact: string
  readonly costEnvelope: string
  /** Owner-authored variant/review action; DSH never synthesizes one. */
  readonly action?: OpcSceneActionDescriptorV1
}

/** Role-first Skill summary: the label is the primary surface. */
export interface OpcSceneSkillRoleV1 {
  readonly role: 'director' | 'continuity' | 'producer' | 'edit' | 'sound'
  /** Detail-only identity fields; never rendered in the primary list. */
  readonly name?: string
  readonly version?: string
  readonly digest?: string
}

export interface OpcSceneEvidenceBlockV1 {
  readonly refs: readonly string[]
  readonly digest: string
  readonly counts: Readonly<Record<string, number>>
  readonly reasonCodes: readonly string[]
}

export interface OpcSceneReceiptRefV1 {
  readonly receiptRef: string
  readonly reconcileRef?: string
  readonly outcome: 'succeeded' | 'conflict' | 'timeout' | 'unknown'
}

export interface OpcSceneDeliveryV1 {
  readonly packaging: 'formal' | 'partial'
  readonly productionReady: boolean
  readonly manifestRef?: string
  readonly checksumStatus: 'verified' | 'mismatch' | 'unknown'
  readonly exportReceiptRef?: string
  readonly grant?: {
    readonly status: 'valid' | 'expired'
    readonly expiresAt: number
  }
}

export interface OpcScenePackageSummaryV1alpha1 {
  readonly schema: typeof OPC_SCENE_PACKAGE_SUMMARY_SCHEMA
  readonly summaryVersion: string
  readonly observedAt: number
  readonly showRef: string
  readonly episodeRef: string
  readonly sceneRef: string
  readonly packageRef: string
  readonly packageVersion: string
  readonly freshness: OpcSceneFreshnessV1
  readonly stage: string
  readonly readiness: 'clear' | 'blocked'
  readonly gates: readonly OpcSceneGateV1[]
  readonly exceptions: readonly OpcSceneExceptionFindingV1[]
  readonly primaryAction?: OpcSceneActionDescriptorV1
  readonly primaryAspect: OpcSceneAspectV1
  readonly reframes: readonly OpcSceneReframeVariantV1[]
  readonly roles: readonly OpcSceneSkillRoleV1[]
  readonly evidence: OpcSceneEvidenceBlockV1
  readonly delivery: OpcSceneDeliveryV1
  readonly receipts: readonly OpcSceneReceiptRefV1[]
  readonly workbenchDeepLink: string
}

const OPAQUE = /^[A-Za-z0-9._~:-]{1,160}$/
const SAFE_TEXT = /^[A-Za-z0-9 .,:+_~()/-]{1,200}$/
// Copyable CLI/API details may carry owner-authored `--flags`, so they get
// their own charset (must start with a letter; no shell metacharacters, no
// space-slash path arguments) instead of the blob-wide `\s--` rule.
const COPYABLE = /^[A-Za-z][A-Za-z0-9 .,:=@_/-]{0,199}$/
const UNSAFE =
  /(?:^|[:/\\])(?:etc|home|usr|var|tmp)|file:\/\/|authorization|cookie|secret|password|-----BEGIN|\s--|https?:\/\/|signature|x-amz-|x-goog-|sig=|hmac|bearer\s|api[_-]?key|private[_-]?key|chain[-_]?of[-_]?thought/i

const GATE_IDS: readonly OpcSceneGateIdV1[] = ['direction_confirm', 'visual_foundation_accept', 'export_confirm']
const EXCEPTION_KINDS: readonly OpcSceneExceptionKindV1[] = [
  'rights',
  'cost',
  'stale',
  'unknown',
  'partial',
  'owner_offline',
  'originality_similarity',
  'plan_amendment',
]

export function isSafeOpcSceneRef(value: string): boolean {
  return OPAQUE.test(value) && !UNSAFE.test(value) && !value.startsWith('/')
}

function isSafeText(value: string): boolean {
  return SAFE_TEXT.test(value) && !UNSAFE.test(value) && !value.startsWith('/')
}

const COPYABLE_UNSAFE = /secret|password|token|cookie|authorization|signature|api[_-]?key|private[_-]?key|-----BEGIN/i

function isCopyableDetail(value: string): boolean {
  return COPYABLE.test(value) && !COPYABLE_UNSAFE.test(value) && !/\s\//.test(value) && !/\/\//.test(value)
}

/** Copyable details are validated by COPYABLE; excluded from the blob scan. */
const COPYABLE_KEYS = new Set(['cliDetail', 'apiDetail'])

function stripCopyable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCopyable)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (!COPYABLE_KEYS.has(key)) out[key] = stripCopyable(item)
    }
    return out
  }
  return value
}

function blobUnsafe(value: unknown): boolean {
  return UNSAFE.test(JSON.stringify(stripCopyable(value)))
}

function validateActionDescriptor(input: unknown): input is OpcSceneActionDescriptorV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<OpcSceneActionDescriptorV1>
  if (typeof value.actionId !== 'string' || !isSafeOpcSceneRef(value.actionId)) return false
  if (typeof value.label !== 'string' || !isSafeText(value.label)) return false
  if (typeof value.targetRef !== 'string' || !isSafeOpcSceneRef(value.targetRef)) return false
  if (typeof value.expectedVersion !== 'string' || !isSafeOpcSceneRef(value.expectedVersion)) return false
  if (value.sideEffectClass !== 'read_only' && value.sideEffectClass !== 'owner_write' && value.sideEffectClass !== 'billable' && value.sideEffectClass !== 'export') return false
  if (typeof value.requiresConfirmation !== 'boolean') return false
  if (typeof value.idempotencyKey !== 'string' || !isSafeOpcSceneRef(value.idempotencyKey)) return false
  if (value.cliDetail !== undefined && (typeof value.cliDetail !== 'string' || !isCopyableDetail(value.cliDetail))) return false
  if (value.apiDetail !== undefined && (typeof value.apiDetail !== 'string' || !isCopyableDetail(value.apiDetail))) return false
  return !blobUnsafe(input)
}

function validateExceptionFinding(input: unknown): input is OpcSceneExceptionFindingV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<OpcSceneExceptionFindingV1>
  if (typeof value.kind !== 'string' || !EXCEPTION_KINDS.includes(value.kind as OpcSceneExceptionKindV1)) return false
  if (typeof value.affectedRef !== 'string' || !isSafeOpcSceneRef(value.affectedRef)) return false
  if (typeof value.reasonCode !== 'string' || !isSafeText(value.reasonCode)) return false
  if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.some(ref => typeof ref !== 'string' || !isSafeOpcSceneRef(ref))) return false
  if (value.recoveryAction !== undefined && !validateActionDescriptor(value.recoveryAction)) return false
  if (value.reconcileRef !== undefined && (typeof value.reconcileRef !== 'string' || !isSafeOpcSceneRef(value.reconcileRef))) return false
  return !blobUnsafe(input)
}

function validateReframe(input: unknown): input is OpcSceneReframeVariantV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<OpcSceneReframeVariantV1>
  if (value.aspect !== '9:16' && value.aspect !== '16:9') return false
  if (value.depth !== 'balanced' && value.depth !== 'cinematic') return false
  if (value.status !== 'recommended' && value.status !== 'confirmed') return false
  for (const field of ['reason', 'impact', 'costEnvelope'] as const) {
    const text = value[field]
    if (typeof text !== 'string' || !isSafeText(text)) return false
  }
  if (value.action !== undefined && !validateActionDescriptor(value.action)) return false
  return !blobUnsafe(input)
}

/**
 * Fail-closed validator for the Scaena OPC scene package summary. Returns
 * true only for a structurally complete, redaction-safe projection: the
 * three normal gates, a typed freshness, bounded safe text, and no raw
 * prompt, provider payload, credential, signed URL, or absolute path.
 */
export function validateOpcScenePackageSummary(input: unknown): input is OpcScenePackageSummaryV1alpha1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<OpcScenePackageSummaryV1alpha1>
  if (value.schema !== OPC_SCENE_PACKAGE_SUMMARY_SCHEMA) return false
  if (typeof value.summaryVersion !== 'string' || !isSafeOpcSceneRef(value.summaryVersion)) return false
  if (typeof value.observedAt !== 'number' || !Number.isSafeInteger(value.observedAt) || value.observedAt <= 0) return false
  for (const field of ['showRef', 'episodeRef', 'sceneRef', 'packageRef', 'packageVersion', 'stage', 'workbenchDeepLink'] as const) {
    const ref = value[field]
    if (typeof ref !== 'string' || !isSafeOpcSceneRef(ref)) return false
  }
  if (value.freshness !== 'fresh' && value.freshness !== 'stale' && value.freshness !== 'partial' && value.freshness !== 'unknown' && value.freshness !== 'offline') return false
  if (value.readiness !== 'clear' && value.readiness !== 'blocked') return false
  if (value.primaryAspect !== '9:16' && value.primaryAspect !== '16:9') return false
  if (!Array.isArray(value.gates) || value.gates.length !== GATE_IDS.length) return false
  const gateIds = new Set(value.gates.map(gate => (gate as Partial<OpcSceneGateV1>)?.id))
  if (GATE_IDS.some(id => !gateIds.has(id))) return false
  if (value.gates.some(gate => {
    const g = gate as Partial<OpcSceneGateV1>
    return g?.state !== 'pending' && g?.state !== 'accepted'
  })) return false
  if (!Array.isArray(value.exceptions) || value.exceptions.some(finding => !validateExceptionFinding(finding))) return false
  if (value.primaryAction !== undefined && !validateActionDescriptor(value.primaryAction)) return false
  if (!Array.isArray(value.reframes) || value.reframes.some(reframe => !validateReframe(reframe))) return false
  if (!Array.isArray(value.roles)) return false
  if (value.roles.some(role => {
    const r = role as Partial<OpcSceneSkillRoleV1>
    if (r === null || typeof r !== 'object') return true
    if (!['director', 'continuity', 'producer', 'edit', 'sound'].includes(r.role as string)) return true
    if (r.name !== undefined && (typeof r.name !== 'string' || !isSafeText(r.name))) return true
    if (r.version !== undefined && (typeof r.version !== 'string' || !isSafeOpcSceneRef(r.version))) return true
    if (r.digest !== undefined && (typeof r.digest !== 'string' || !isSafeOpcSceneRef(r.digest))) return true
    return false
  })) return false
  const evidence = value.evidence as Partial<OpcSceneEvidenceBlockV1> | undefined
  if (evidence === undefined || typeof evidence !== 'object') return false
  if (!Array.isArray(evidence.refs) || evidence.refs.some(ref => typeof ref !== 'string' || !isSafeOpcSceneRef(ref))) return false
  if (typeof evidence.digest !== 'string' || !isSafeOpcSceneRef(evidence.digest)) return false
  if (typeof evidence.counts !== 'object' || evidence.counts === null || Object.values(evidence.counts).some(count => typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)) return false
  if (!Array.isArray(evidence.reasonCodes) || evidence.reasonCodes.some(code => typeof code !== 'string' || !isSafeText(code))) return false
  const delivery = value.delivery as Partial<OpcSceneDeliveryV1> | undefined
  if (delivery === undefined || typeof delivery !== 'object') return false
  if (delivery.packaging !== 'formal' && delivery.packaging !== 'partial') return false
  if (typeof delivery.productionReady !== 'boolean') return false
  if (delivery.manifestRef !== undefined && (typeof delivery.manifestRef !== 'string' || !isSafeOpcSceneRef(delivery.manifestRef))) return false
  if (delivery.checksumStatus !== 'verified' && delivery.checksumStatus !== 'mismatch' && delivery.checksumStatus !== 'unknown') return false
  if (delivery.exportReceiptRef !== undefined && (typeof delivery.exportReceiptRef !== 'string' || !isSafeOpcSceneRef(delivery.exportReceiptRef))) return false
  if (delivery.grant !== undefined) {
    const grant = delivery.grant as Partial<NonNullable<OpcSceneDeliveryV1['grant']>>
    if (grant?.status !== 'valid' && grant?.status !== 'expired') return false
    if (typeof grant?.expiresAt !== 'number' || !Number.isSafeInteger(grant.expiresAt)) return false
  }
  if (!Array.isArray(value.receipts) || value.receipts.some(receipt => {
    const r = receipt as Partial<OpcSceneReceiptRefV1>
    if (r === null || typeof r !== 'object') return true
    if (typeof r.receiptRef !== 'string' || !isSafeOpcSceneRef(r.receiptRef)) return true
    if (r.reconcileRef !== undefined && (typeof r.reconcileRef !== 'string' || !isSafeOpcSceneRef(r.reconcileRef))) return true
    return r.outcome !== 'succeeded' && r.outcome !== 'conflict' && r.outcome !== 'timeout' && r.outcome !== 'unknown'
  })) return false
  return !blobUnsafe(input)
}

/** Canonical redacted cross-entry fixture (same package revision for DSH and Workbench). */
export const OPC_SCENE_SUMMARY_FIXTURE: OpcScenePackageSummaryV1alpha1 = {
  schema: OPC_SCENE_PACKAGE_SUMMARY_SCHEMA,
  summaryVersion: OPC_SCENE_SUMMARY_FIXTURE_VERSION,
  observedAt: 1_800_000_000_000,
  showRef: 'show:101',
  episodeRef: 'ep:5',
  sceneRef: 'scene:12',
  packageRef: 'pkg:scene-12-r42',
  packageVersion: 'r42',
  freshness: 'fresh',
  stage: 'direction',
  readiness: 'blocked',
  gates: [
    { id: 'direction_confirm', state: 'pending' },
    { id: 'visual_foundation_accept', state: 'accepted' },
    { id: 'export_confirm', state: 'pending' },
  ],
  exceptions: [
    {
      kind: 'rights',
      affectedRef: 'scene:12',
      reasonCode: 'rights_review_pending',
      evidenceRefs: ['ev:rights-scan-7'],
      recoveryAction: {
        actionId: 'act:approve-rights',
        label: 'Approve rights review',
        targetRef: 'pkg:scene-12-r42',
        expectedVersion: 'r42',
        sideEffectClass: 'owner_write',
        requiresConfirmation: true,
        idempotencyKey: 'idem:approve-rights-r42',
        cliDetail: 'scaena opc scene approve-rights --scene scene:12 --expected-version r42',
        apiDetail: 'POST scaena.opc.v1alpha1.SceneService/ApproveRights expected_version=r42',
      },
      reconcileRef: 'recon:rights-r42',
    },
  ],
  primaryAction: {
    actionId: 'act:confirm-direction',
    label: 'Confirm direction',
    targetRef: 'pkg:scene-12-r42',
    expectedVersion: 'r42',
    sideEffectClass: 'owner_write',
    requiresConfirmation: true,
    idempotencyKey: 'idem:confirm-direction-r42',
    cliDetail: 'scaena opc scene confirm-direction --scene scene:12 --expected-version r42',
    apiDetail: 'POST scaena.opc.v1alpha1.SceneService/ConfirmDirection expected_version=r42',
  },
  primaryAspect: '9:16',
  reframes: [
    {
      aspect: '16:9',
      depth: 'cinematic',
      status: 'recommended',
      reason: 'wide establishing shot recommended for opening scene',
      impact: 'adds 2 additional boards',
      costEnvelope: 'fixed: +1 generation pass',
      action: {
        actionId: 'act:review-reframe-16x9',
        label: 'Review 16:9 reframe',
        targetRef: 'pkg:scene-12-r42',
        expectedVersion: 'r42',
        sideEffectClass: 'billable',
        requiresConfirmation: true,
        idempotencyKey: 'idem:reframe-16x9-r42',
      },
    },
  ],
  roles: [
    { role: 'director' },
    { role: 'continuity', name: 'continuity-check', version: 'v3', digest: 'sha1:9f2a' },
    { role: 'producer' },
    { role: 'edit' },
    { role: 'sound' },
  ],
  evidence: {
    refs: ['ev:rights-scan-7', 'ev:direction-review-3'],
    digest: 'sha1:4d31c0',
    counts: { runs: 7, receipts: 5, verifications: 2 },
    reasonCodes: ['rights_review_pending'],
  },
  delivery: {
    packaging: 'partial',
    productionReady: false,
    manifestRef: 'manifest:scene-12-r42',
    checksumStatus: 'verified',
    exportReceiptRef: 'rcpt:export-91',
    grant: { status: 'valid', expiresAt: 1_800_000_300_000 },
  },
  receipts: [
    { receiptRef: 'rcpt:action-77', reconcileRef: 'recon:action-77', outcome: 'succeeded' },
    { receiptRef: 'rcpt:action-78', outcome: 'unknown' },
  ],
  workbenchDeepLink: 'workbench:open-scene:scene:12:r42',
}
