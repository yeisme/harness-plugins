import { z } from 'zod'
import type { SafeOrdoRef } from './parser.ts'

const safeRef = z.string().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
const safeKey = z.string().min(1).max(96).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
const safeText = z.string().min(1).max(256).refine(isSafeText, 'composition projection text is unsafe')
const digest = z.string().regex(/^[a-f0-9]{64}$/u)
const boundedCount = z.number().int().nonnegative().max(1_000_000)
const timestamp = z.string().min(1).max(64).refine(isIsoTimestamp, 'generated_at must be an ISO timestamp')

const compositionPreviewSchema = z.object({
  schema: z.literal('dsh.composition.preview.v0'),
  preset: z.object({
    id: safeRef,
    trust: z.enum(['system', 'user']),
    composition_stamp: z.object({
      mtime_ms: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
      size: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
    }).strict(),
    generation: boundedCount,
  }).strict(),
  health: z.object({
    shape_ok: z.boolean(),
    mount_ok: z.boolean(),
    provable_mount_ref: safeRef,
  }).strict(),
  drift: z.object({
    state: z.enum(['none', 'unknown', 'diverged']),
    source_id: safeRef.optional(),
    source_digest: digest.optional(),
    copy_digest: digest.optional(),
  }).strict(),
  composition: z.object({
    tools: z.array(z.object({
      name: safeKey,
      schema_digest: digest,
      source: z.enum(['global', 'preset', 'transport']),
    }).strict()).max(256),
    prompt_sections: z.array(z.object({
      id: safeRef,
      section_digest: digest,
      source: z.enum(['global', 'preset']),
    }).strict()).max(256),
    projection_units: z.array(z.object({
      key: safeKey,
      source: z.enum(['global', 'preset']),
    }).strict()).max(256),
    permissions: z.union([
      z.object({
        sandbox_mode: safeText,
        approval_policy: safeText,
        contrib_source: z.literal('host'),
      }).strict(),
      z.object({ unknown_reason: safeText }).strict(),
    ]),
  }).strict(),
  capability_digest: digest,
  generated_at: timestamp,
}).strict()

export interface SafeCompositionPreview {
  readonly presetId: string
  readonly generatedAt: string
  readonly capabilityDigest: string
  readonly shapeOk: boolean
  readonly mountOk: boolean
  readonly healthReason: string
  readonly mountRef: string
  readonly driftState: 'none' | 'unknown' | 'diverged'
  readonly toolCount: number
  readonly promptSectionCount: number
}

/**
 * 只消费独立 composition owner 的安全 envelope。这里不读取 preset 文件、browser
 * cache 或 Host path，也不从 projection 推导 maturity、risk、qualification 或 receipt。
 */
export function parseSafeCompositionPreview(value: unknown, presetId: SafeOrdoRef): SafeCompositionPreview | undefined {
  const result = compositionPreviewSchema.safeParse(value)
  if (!result.success || result.data.preset.id !== presetId) return undefined
  return {
    presetId,
    generatedAt: result.data.generated_at,
    capabilityDigest: result.data.capability_digest,
    shapeOk: result.data.health.shape_ok,
    mountOk: result.data.health.mount_ok,
    healthReason: 'none',
    mountRef: result.data.health.provable_mount_ref,
    driftState: result.data.drift.state,
    toolCount: result.data.composition.tools.length,
    promptSectionCount: result.data.composition.prompt_sections.length,
  }
}

function isIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && !/[\u0000-\u001f\u007f]/u.test(value)
}

const unsafeSchemeOrCredential = /(?:https?:\/\/|wss?:\/\/|\bBearer\b|\b(?:token|secret|credential|password|api[_-]?key)\b)/iu
const unsafePath = /(?:^|[\s:=])(?:\/|[a-z]:[\\/])/iu

function isSafeText(value: string): boolean {
  if (/[\u0000-\u001f\u007f]/u.test(value)) return false
  return !unsafeSchemeOrCredential.test(value) && !unsafePath.test(value)
}
