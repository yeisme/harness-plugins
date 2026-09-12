import { z } from 'zod'

const identifier = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)
const profile = z.object({
  provider_id: identifier,
  model_ref: z.string().max(512).regex(/^sonora:\/\/asr-model\/[A-Za-z0-9][A-Za-z0-9._-]*$/u),
  revision: identifier, readiness: identifier, fixture: z.boolean(),
  supported_locales: z.array(identifier).max(256), supported_formats: z.array(identifier).max(64),
  timestamp_modes: z.array(z.enum(['none', 'segment', 'word'])).max(3),
  supports_speaker_labels: z.boolean(), requires_network: z.boolean(), requires_credentials: z.boolean(),
  cost_model: identifier, max_duration_ms: z.number().int().nonnegative(), max_segments: z.number().int().nonnegative(),
}).strict()
const unavailable = z.object({ provider_id: identifier, code: identifier, fixture: z.boolean() }).strict()

/** Preserve the distinction between absent diagnostics and a verified empty failure list. */
export const sonoraTranscriptionCatalogSchema = z.object({
  validation_level: z.literal('capability_probe'), profiles: z.array(profile).max(64),
  diagnostics_available: z.boolean().optional(), unavailable: z.array(unavailable).max(64).optional(),
}).strict().superRefine((catalog, ctx) => {
  if ((catalog.unavailable?.length ?? 0) > 0 && catalog.diagnostics_available !== true) {
    ctx.addIssue({ code: 'custom', message: 'unavailable providers require diagnostic support' })
  }
  const ids = new Set<string>()
  for (const entry of [...catalog.profiles, ...(catalog.unavailable ?? [])]) {
    if (ids.has(entry.provider_id) || entry.fixture !== (entry.provider_id === 'fixture')) {
      ctx.addIssue({ code: 'custom', message: 'provider identity or fixture marker conflicts' })
    }
    ids.add(entry.provider_id)
  }
})

export type SonoraTranscriptionCatalog = z.infer<typeof sonoraTranscriptionCatalogSchema>

export function validateSonoraTranscriptionCatalog(value: unknown): SonoraTranscriptionCatalog | undefined {
  const parsed = sonoraTranscriptionCatalogSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
