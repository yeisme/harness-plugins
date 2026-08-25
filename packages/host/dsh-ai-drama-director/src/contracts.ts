/**
 * AI Drama Director Pack contracts.
 *
 * Host-owned types for current context, typed /drama requests, and Workbench
 * handoff. The plugin must not carry argv, shell, raw prompt, provider
 * payload, credential, or absolute path.
 */

export const DRAMA_CONTEXT_SCHEMA = 'drama.context.v1' as const
export const DRAMA_COMMAND_REQUEST_SCHEMA = 'drama.command-request.v1' as const
export const DRAMA_WORKBENCH_HANDOFF_SCHEMA = 'drama.workbench-handoff.v1' as const

export const DRAMA_COMMANDS = [
  'drama',
  'new',
  'open',
  'plan',
  'generate',
  'review',
  'repair',
  'evidence',
  'handoff',
] as const

export type DramaCommandIdV1 = (typeof DRAMA_COMMANDS)[number]

export type DramaFreshnessV1 = 'fresh' | 'stale' | 'offline' | 'gap'

export interface DramaContextV1 {
  readonly schema: typeof DRAMA_CONTEXT_SCHEMA
  readonly workspaceRef: string
  readonly projectRef: string
  readonly showRef: string
  readonly episodeRef?: string
  readonly sceneRef?: string
  readonly shotRef?: string
  readonly ownerVersions: Readonly<Record<string, string>>
  readonly contextRevision: string
  readonly freshness: DramaFreshnessV1
}

export interface DramaCommandRequestV1 {
  readonly schema: typeof DRAMA_COMMAND_REQUEST_SCHEMA
  readonly command: DramaCommandIdV1
  readonly selector: string
  readonly contextRevision: string
  readonly presentationIntent?: string
}

export interface WorkbenchHandoffV1 {
  readonly schema: typeof DRAMA_WORKBENCH_HANDOFF_SCHEMA
  readonly contextRef: string
  readonly artifactRef?: string
  readonly receiptRef?: string
  readonly targetSurface: string
  readonly presentationIntent: string
  readonly expiresAt: number
  readonly nonce: string
}

export type DramaCommandResultKind =
  | 'opened'
  | 'proposal_created'
  | 'submitted'
  | 'unknown'
  | 'reconcile_required'
  | 'needs_contract'
  | 'disabled'

export interface DramaCapabilityProbeV1 {
  readonly available: boolean
  readonly reason: string
  readonly disabled: boolean
}

const OPAQUE = /^[A-Za-z0-9._~:-]{1,160}$/
const UNSAFE = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|token|secret|password|-----BEGIN|\s--|https?:\/\//i

export function isSafeDramaRef(value: string): boolean {
  return OPAQUE.test(value) && !UNSAFE.test(value) && !value.startsWith('/')
}

function blobUnsafe(value: unknown): boolean {
  return UNSAFE.test(JSON.stringify(value))
}

export function validateDramaContext(input: unknown): input is DramaContextV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<DramaContextV1>
  if (value.schema !== DRAMA_CONTEXT_SCHEMA) return false
  if (typeof value.workspaceRef !== 'string' || !isSafeDramaRef(value.workspaceRef)) return false
  if (typeof value.projectRef !== 'string' || !isSafeDramaRef(value.projectRef)) return false
  if (typeof value.showRef !== 'string' || !isSafeDramaRef(value.showRef)) return false
  if (typeof value.contextRevision !== 'string' || !isSafeDramaRef(value.contextRevision)) return false
  if (value.freshness !== 'fresh' && value.freshness !== 'stale' && value.freshness !== 'offline' && value.freshness !== 'gap') return false
  return !blobUnsafe(input)
}

export function validateDramaCommandRequest(input: unknown): input is DramaCommandRequestV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<DramaCommandRequestV1>
  if (value.schema !== DRAMA_COMMAND_REQUEST_SCHEMA) return false
  if (typeof value.command !== 'string' || !DRAMA_COMMANDS.includes(value.command as DramaCommandIdV1)) return false
  if (typeof value.selector !== 'string' || !isSafeDramaRef(value.selector)) return false
  if (typeof value.contextRevision !== 'string' || !isSafeDramaRef(value.contextRevision)) return false
  return !blobUnsafe(input)
}

export function validateWorkbenchHandoff(input: unknown): input is WorkbenchHandoffV1 {
  if (input === null || typeof input !== 'object') return false
  const value = input as Partial<WorkbenchHandoffV1>
  if (value.schema !== DRAMA_WORKBENCH_HANDOFF_SCHEMA) return false
  if (typeof value.contextRef !== 'string' || !isSafeDramaRef(value.contextRef)) return false
  if (typeof value.targetSurface !== 'string' || !isSafeDramaRef(value.targetSurface)) return false
  if (typeof value.presentationIntent !== 'string' || !isSafeDramaRef(value.presentationIntent)) return false
  if (typeof value.nonce !== 'string' || !isSafeDramaRef(value.nonce)) return false
  if (typeof value.expiresAt !== 'number' || !Number.isSafeInteger(value.expiresAt)) return false
  return !blobUnsafe(input)
}

export function probeDramaCapability(available: boolean, reason: string): DramaCapabilityProbeV1 {
  return {
    available,
    reason,
    disabled: !available,
  }
}

export function shouldRetryUnknownDramaResult(): false {
  return false
}
