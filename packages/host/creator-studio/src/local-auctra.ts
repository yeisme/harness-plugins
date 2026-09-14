import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import {
  AUCTRA_CANDIDATE_CONTENT_SCHEMA_DIGEST,
  AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST,
  AUCTRA_WORKING_COPY_SCHEMA_DIGEST,
  AuctraWorkingCopyClient,
  type AuctraWorkingCopyConnection,
} from './auctra-working-copy-client.ts'
import { AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST } from './auctra-editor-recovery.ts'
import { auctraWorkingCopyOpenRefSchema } from './auctra-working-copy.ts'
import { createAuctraWorkingCopyAdapter, type AuctraWorkingCopySelection } from './auctra-working-copy-adapter.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'

/** The `auctra serve` connection file the CLI authors with 0600 permissions. */
const connectionFileSchema = z.object({
  schema_version: z.literal('auctra.service.connection.v1'),
  base_url: z.string().url(),
  token: z.string().min(1),
  project_ref: z.string().min(1),
}).strict()

export const localAuctraConfigSchema = z.object({
  connectionFile: z.string().min(1).optional(),
  baseURL: z.string().url().optional(),
  token: z.string().min(1).optional(),
  ownerProjectRef: z.string().min(1).optional(),
  unit: auctraWorkingCopyOpenRefSchema,
  write: z.boolean().optional(),
}).strict().refine(value => value.connectionFile !== undefined
  || (value.baseURL !== undefined && value.token !== undefined && value.ownerProjectRef !== undefined),
{ message: 'auctra needs a connectionFile or baseURL, token, and ownerProjectRef' })
export type LocalAuctraConfig = z.infer<typeof localAuctraConfigSchema>

/**
 * Local Auctra owner wiring over the approved loopback Service API. The unit
 * selection is an explicit user configuration, never inferred from list order;
 * `write` defaults to read-only so saving and candidates stay opt-in.
 */
export function createLocalAuctraAdapter(config: LocalAuctraConfig, fetcher: typeof fetch = fetch): CreatorOwnerAdapterV1 {
  const readConnectionFile = async (): Promise<z.infer<typeof connectionFileSchema> | undefined> => {
    if (config.connectionFile === undefined) return undefined
    try {
      return connectionFileSchema.parse(JSON.parse(await readFile(config.connectionFile, 'utf8')))
    } catch { /* An unreadable or rotated connection file stays honestly unavailable. */ }
    return undefined
  }
  const resolve = async (scope: CreatorStudioContextV1): Promise<AuctraWorkingCopyConnection | undefined> => {
    const file = await readConnectionFile()
    const baseURL = config.baseURL ?? file?.base_url
    const token = config.token ?? file?.token
    const ownerProjectRef = config.ownerProjectRef ?? file?.project_ref
    if (baseURL === undefined || token === undefined || ownerProjectRef === undefined) return undefined
    return { context: { ...scope }, baseURL, headers: { Authorization: `Bearer ${token}` }, ownerProjectRef,
      admission: { consumer: 'dsh', schemaDigest: AUCTRA_WORKING_COPY_SCHEMA_DIGEST, approved: true,
        ...(config.write === true ? { writeApproved: true } : {}),
        candidateContentDigest: AUCTRA_CANDIDATE_CONTENT_SCHEMA_DIGEST,
        candidateListDigest: AUCTRA_CANDIDATE_LIST_SCHEMA_DIGEST,
        candidateRequestRecovery: 'v1alpha1', editorRecoveryDigest: AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST } }
  }
  const client = new AuctraWorkingCopyClient(resolve, fetcher)
  const selected = async (scope: CreatorStudioContextV1): Promise<AuctraWorkingCopySelection | undefined> => {
    const opened = await client.open(scope, config.unit)
    if (opened.status !== 'ready') return undefined
    return { unitRef: config.unit, artifact: opened.value.artifact, canSave: config.write === true }
  }
  const keyOf = (artifactRef: string) => artifactRef.match(/^auctra:(?:working-copy|candidate):[a-f0-9]{32}:(.+)$/u)?.[1]
  const resolveOriginal = async (artifactRef: string, scope: CreatorStudioContextV1): Promise<AuctraWorkingCopySelection | undefined> => {
    const key = keyOf(artifactRef)
    if (key === undefined) return undefined
    const current = await selected(scope)
    return current !== undefined && keyOf(current.artifact.ref) === key ? current : undefined
  }
  return createAuctraWorkingCopyAdapter(client, selected, resolveOriginal)
}
