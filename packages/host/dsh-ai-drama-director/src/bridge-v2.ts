/**
 * DSH → Workbench AI drama bridge V2 contract.
 *
 * Directional, closed-schema, refs-only envelope for handing drama creation
 * context from DSH to the Workbench `/agent` Spatial Creative Runtime. The
 * digest is a canonical serialization check for transport corruption only —
 * it grants no permission and proves no identity. Owner reauthorization and
 * refetch always happen server-side in Workbench.
 */

export const BRIDGE_V2_CONTRACT = 'dsh.workbench_ai_drama_bridge.v2' as const
export const BRIDGE_V2_DIRECTION = 'dsh_to_workbench' as const
export const WORKBENCH_AGENT_SPATIAL_SURFACE = 'workbench.agent.spatial' as const
export const WORKBENCH_TARGET_APPLICATION = 'yeisme-workbench' as const

export const BRIDGE_V2_INTENTS = [
  'open_show',
  'open_episode',
  'open_artifact',
  'open_review',
  'open_evidence',
] as const

export type BridgeV2Intent = (typeof BRIDGE_V2_INTENTS)[number]

/** Closed intent → Workbench `/agent` lens mapping; never route-guessed. */
export const BRIDGE_V2_LENS_MAP: Readonly<Record<BridgeV2Intent, {
  readonly lens: 'creative_production' | 'review' | 'evidence'
  readonly focus: string
  readonly label: string
}>> = {
  open_show: { lens: 'creative_production', focus: 'show_overview', label: 'Creative Production' },
  open_episode: { lens: 'creative_production', focus: 'episode_timeline', label: 'Creative Production' },
  open_artifact: { lens: 'creative_production', focus: 'referenced_artifact', label: 'Creative Production' },
  open_review: { lens: 'review', focus: 'review_context', label: 'Review' },
  open_evidence: { lens: 'evidence', focus: 'evidence_context', label: 'Evidence' },
}

/**
 * Stable validation and launch reason codes. `legacy_bridge` marks an
 * explicit fallback to a supported legacy contract — it is a mode label,
 * never a V2 consumption result.
 */
export const BRIDGE_V2_REASON_CODES = [
  'malformed',
  'expired',
  'denied',
  'stale',
  'replay_conflict',
  'already_consumed',
  'target_unavailable',
  'legacy_bridge',
  'contract_mismatch',
  'reconcile_required',
  'unknown',
  'partial',
] as const

export type BridgeV2ReasonCode = (typeof BRIDGE_V2_REASON_CODES)[number]

export interface WorkbenchAiDramaBridgeV2 {
  readonly contractVersion: typeof BRIDGE_V2_CONTRACT
  readonly direction: typeof BRIDGE_V2_DIRECTION
  readonly sourceSurfaceId: string
  readonly targetSurfaceId: typeof WORKBENCH_AGENT_SPATIAL_SURFACE
  readonly workspaceRef: string
  readonly projectRef: string
  readonly showRef: string
  readonly episodeRef?: string
  readonly resourceRef: string
  readonly resourceVersion?: string
  readonly contextRevision: number
  readonly presentationIntent: BridgeV2Intent
  readonly artifactRef?: string
  readonly receiptRef?: string
  readonly expiresAtUnixMs: number
  readonly nonce: string
  readonly contractDigest: string
}

/** Schema-ordered canonical field order; `contractDigest` is always excluded. */
export const BRIDGE_V2_CANONICAL_FIELD_ORDER: readonly string[] = [
  'contractVersion',
  'direction',
  'sourceSurfaceId',
  'targetSurfaceId',
  'workspaceRef',
  'projectRef',
  'showRef',
  'episodeRef',
  'resourceRef',
  'resourceVersion',
  'contextRevision',
  'presentationIntent',
  'artifactRef',
  'receiptRef',
  'expiresAtUnixMs',
  'nonce',
]

const BRIDGE_V2_REQUIRED_KEYS: ReadonlySet<string> = new Set([
  'contractVersion',
  'direction',
  'sourceSurfaceId',
  'targetSurfaceId',
  'workspaceRef',
  'projectRef',
  'showRef',
  'resourceRef',
  'contextRevision',
  'presentationIntent',
  'expiresAtUnixMs',
  'nonce',
  'contractDigest',
])

const BRIDGE_V2_OPTIONAL_KEYS: ReadonlySet<string> = new Set([
  'episodeRef',
  'resourceVersion',
  'artifactRef',
  'receiptRef',
])

export const BRIDGE_V2_NONCE_PATTERN = /^[0-9a-f]{32}$/
export const BRIDGE_V2_DIGEST_PATTERN = /^[0-9a-f]{64}$/

export const BRIDGE_V2_MIN_TTL_MS = 30_000
export const BRIDGE_V2_MAX_TTL_MS = 900_000
export const BRIDGE_V2_DEFAULT_TTL_MS = 300_000

const SAFE_REF = /^[A-Za-z0-9._~:-]{1,160}$/
const UNSAFE_CONTENT = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|token|secret|password|-----BEGIN|\s--|https?:\/\//i

function isSafeRef(value: string): boolean {
  return SAFE_REF.test(value) && !UNSAFE_CONTENT.test(value) && !value.startsWith('/')
}

function isUnsafeBlob(value: unknown): boolean {
  return UNSAFE_CONTENT.test(JSON.stringify(value))
}

/* ------------------------------------------------------------------ *
 * Canonical SHA-256 (isomorphic, dependency-free, synchronous).
 * ------------------------------------------------------------------ */

const SHA256_K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const bitLength = bytes.length * 8
  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 4, bitLength >>> 0)
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000))

  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const w = new Int32Array(64)

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) w[index] = view.getInt32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) {
      const s0 = ((w[index - 15] >>> 7) | (w[index - 15] << 25)) ^ ((w[index - 15] >>> 18) | (w[index - 15] << 14)) ^ (w[index - 15] >>> 3)
      const s1 = ((w[index - 2] >>> 17) | (w[index - 2] << 15)) ^ ((w[index - 2] >>> 19) | (w[index - 2] << 13)) ^ (w[index - 2] >>> 10)
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let index = 0; index < 64; index += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + s1 + ch + SHA256_K[index] + w[index]) | 0
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) | 0
      hh = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }
    h[0] = (h[0] + a) | 0
    h[1] = (h[1] + b) | 0
    h[2] = (h[2] + c) | 0
    h[3] = (h[3] + d) | 0
    h[4] = (h[4] + e) | 0
    h[5] = (h[5] + f) | 0
    h[6] = (h[6] + g) | 0
    h[7] = (h[7] + hh) | 0
  }

  return h.map(word => (word >>> 0).toString(16).padStart(8, '0')).join('')
}

/** Schema-ordered canonical serialization; absent optional fields are skipped. */
export function canonicalizeBridgeV2(
  envelope: Omit<WorkbenchAiDramaBridgeV2, 'contractDigest'>,
): string {
  const parts: string[] = []
  for (const field of BRIDGE_V2_CANONICAL_FIELD_ORDER) {
    const value = (envelope as Record<string, unknown>)[field]
    if (value === undefined) continue
    parts.push(`${field}=${typeof value === 'number' ? String(value) : String(value)}`)
  }
  return parts.join('\n')
}

/** SHA-256 of the canonical form; excludes `contractDigest` itself. */
export function digestBridgeV2(envelope: Omit<WorkbenchAiDramaBridgeV2, 'contractDigest'>): string {
  return sha256Hex(canonicalizeBridgeV2(envelope))
}

/** Cryptographically random 32-lowercase-hex nonce; undefined without entropy. */
export function generateBridgeV2Nonce(): string | undefined {
  const source = (globalThis as { readonly crypto?: { getRandomValues?: (buffer: Uint8Array) => Uint8Array } }).crypto
  if (source?.getRandomValues === undefined) return undefined
  const bytes = new Uint8Array(16)
  source.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/* ------------------------------------------------------------------ *
 * Closed-schema validation.
 * ------------------------------------------------------------------ */

export type BridgeV2Validation =
  | { readonly ok: true; readonly envelope: WorkbenchAiDramaBridgeV2 }
  | { readonly ok: false; readonly reason: BridgeV2ReasonCode; readonly detail: string }

/**
 * Validates a V2 envelope against the closed schema. Details are fixed
 * strings — the rejected value is never echoed back (it may carry secrets).
 *
 * Reason mapping: wrong contract identity, direction, target surface, intent,
 * or nonce format → `contract_mismatch`; structural/type/unsafe-content or
 * digest damage → `malformed`; past expiry → `expired`.
 */
export function validateWorkbenchAiDramaBridgeV2(
  input: unknown,
  now: () => number = Date.now,
): BridgeV2Validation {
  const malformed = (detail: string): BridgeV2Validation => ({ ok: false, reason: 'malformed', detail })
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return malformed('envelope is not an object')
  }
  const value = input as Record<string, unknown>

  for (const key of Object.keys(value)) {
    if (!BRIDGE_V2_REQUIRED_KEYS.has(key) && !BRIDGE_V2_OPTIONAL_KEYS.has(key)) {
      return malformed('envelope carries a key outside the closed schema')
    }
  }
  if (value.contractVersion !== BRIDGE_V2_CONTRACT) {
    return { ok: false, reason: 'contract_mismatch', detail: 'envelope declares a different contract version' }
  }
  if (value.direction !== BRIDGE_V2_DIRECTION) {
    return { ok: false, reason: 'contract_mismatch', detail: 'envelope declares an unsupported direction' }
  }
  if (value.targetSurfaceId !== WORKBENCH_AGENT_SPATIAL_SURFACE) {
    return { ok: false, reason: 'contract_mismatch', detail: 'envelope targets an unsupported surface' }
  }
  if (typeof value.presentationIntent !== 'string' || !BRIDGE_V2_INTENTS.includes(value.presentationIntent as BridgeV2Intent)) {
    return { ok: false, reason: 'contract_mismatch', detail: 'presentation intent is outside the closed enum' }
  }

  const refFields: readonly string[] = [
    'sourceSurfaceId',
    'workspaceRef',
    'projectRef',
    'showRef',
    'resourceRef',
    ...(value.episodeRef === undefined ? [] : ['episodeRef']),
    ...(value.resourceVersion === undefined ? [] : ['resourceVersion']),
    ...(value.artifactRef === undefined ? [] : ['artifactRef']),
    ...(value.receiptRef === undefined ? [] : ['receiptRef']),
  ]
  for (const field of refFields) {
    const ref = value[field]
    if (typeof ref !== 'string' || !isSafeRef(ref)) {
      return malformed('a ref field failed the bounded opaque safety check')
    }
  }
  if (typeof value.contextRevision !== 'number' || !Number.isSafeInteger(value.contextRevision) || value.contextRevision < 0) {
    return malformed('context revision is not a non-negative integer')
  }
  if (typeof value.expiresAtUnixMs !== 'number' || !Number.isSafeInteger(value.expiresAtUnixMs)) {
    return malformed('expiry is not an epoch-millisecond integer')
  }
  if (typeof value.nonce !== 'string' || !BRIDGE_V2_NONCE_PATTERN.test(value.nonce)) {
    // Spec scenario: a nonce that does not match the required format is a
    // contract mismatch, not generic corruption.
    return { ok: false, reason: 'contract_mismatch', detail: 'nonce does not match the required 32 lowercase hex format' }
  }
  if (typeof value.contractDigest !== 'string' || !BRIDGE_V2_DIGEST_PATTERN.test(value.contractDigest)) {
    return malformed('contract digest is not a 64 lowercase hex string')
  }
  if (isUnsafeBlob(value)) {
    return malformed('envelope carries unsafe content')
  }

  const { contractDigest, ...body } = value as unknown as WorkbenchAiDramaBridgeV2
  if (digestBridgeV2(body as Omit<WorkbenchAiDramaBridgeV2, 'contractDigest'>) !== contractDigest) {
    return malformed('contract digest does not match the canonical serialization')
  }
  if (value.expiresAtUnixMs <= now()) {
    return { ok: false, reason: 'expired', detail: 'handoff expiry is in the past' }
  }
  return { ok: true, envelope: value as unknown as WorkbenchAiDramaBridgeV2 }
}

export interface BridgeV2IssueInput {
  readonly sourceSurfaceId: string
  readonly workspaceRef: string
  readonly projectRef: string
  readonly showRef: string
  readonly episodeRef?: string
  readonly resourceRef: string
  readonly resourceVersion?: string
  readonly contextRevision: number
  readonly presentationIntent: BridgeV2Intent
  readonly artifactRef?: string
  readonly receiptRef?: string
  readonly nonce?: string
  readonly ttlMs?: number
  readonly now?: () => number
}

export type BridgeV2IssueResult =
  | { readonly ok: true; readonly envelope: WorkbenchAiDramaBridgeV2 }
  | { readonly ok: false; readonly reason: BridgeV2ReasonCode; readonly detail: string }

/**
 * Builds and validates one V2 envelope with a bounded TTL. A caller-supplied
 * nonce must already match the 32-lowercase-hex format; otherwise a fresh
 * cryptographically random nonce is minted (issuance fails honestly when no
 * entropy source exists).
 */
export function createWorkbenchAiDramaBridgeV2(input: BridgeV2IssueInput): BridgeV2IssueResult {
  const nonce = input.nonce ?? generateBridgeV2Nonce()
  if (nonce === undefined) {
    return { ok: false, reason: 'unknown', detail: 'no cryptographic entropy source is available to mint a nonce' }
  }
  const now = input.now?.() ?? Date.now()
  const ttl = Math.min(Math.max(input.ttlMs ?? BRIDGE_V2_DEFAULT_TTL_MS, BRIDGE_V2_MIN_TTL_MS), BRIDGE_V2_MAX_TTL_MS)
  const expiresAtUnixMs = now + ttl

  const body: Omit<WorkbenchAiDramaBridgeV2, 'contractDigest'> = {
    contractVersion: BRIDGE_V2_CONTRACT,
    direction: BRIDGE_V2_DIRECTION,
    sourceSurfaceId: input.sourceSurfaceId,
    targetSurfaceId: WORKBENCH_AGENT_SPATIAL_SURFACE,
    workspaceRef: input.workspaceRef,
    projectRef: input.projectRef,
    showRef: input.showRef,
    ...(input.episodeRef === undefined ? {} : { episodeRef: input.episodeRef }),
    resourceRef: input.resourceRef,
    ...(input.resourceVersion === undefined ? {} : { resourceVersion: input.resourceVersion }),
    contextRevision: input.contextRevision,
    presentationIntent: input.presentationIntent,
    ...(input.artifactRef === undefined ? {} : { artifactRef: input.artifactRef }),
    ...(input.receiptRef === undefined ? {} : { receiptRef: input.receiptRef }),
    expiresAtUnixMs,
    nonce,
  }
  const envelope: WorkbenchAiDramaBridgeV2 = { ...body, contractDigest: digestBridgeV2(body) }
  const validated = validateWorkbenchAiDramaBridgeV2(envelope, input.now ?? Date.now)
  if (!validated.ok) {
    return { ok: false, reason: validated.reason, detail: validated.detail }
  }
  return { ok: true, envelope }
}
