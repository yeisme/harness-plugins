import { z } from 'zod'
import { ArtifactRefSchema } from '@yeisme/dsh-pane-protocol'
import type { CreatorArtifactImageV1 } from './types.ts'

export const CREATOR_ARTIFACT_IMAGE_MAX_BYTES = 16 * 1024 * 1024

const imageSchema = z.object({
  artifact: ArtifactRefSchema,
  contentRevision: z.string().min(1).max(256).refine(value => !/[\u0000-\u001f\u007f]/u.test(value)),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  bytes: z.instanceof(Uint8Array).refine(bytes => bytes.buffer instanceof ArrayBuffer
    && bytes.byteLength > 0 && bytes.byteLength <= CREATOR_ARTIFACT_IMAGE_MAX_BYTES),
}).strict()

/** Detach owner memory before any subsequent await or attachment admission. */
export function validateCreatorArtifactImage(input: unknown): CreatorArtifactImageV1 | undefined {
  const result = imageSchema.safeParse(input)
  if (!result.success || result.data.artifact.mediaType !== result.data.mediaType) return undefined
  return { ...result.data, bytes: new Uint8Array(result.data.bytes) }
}
