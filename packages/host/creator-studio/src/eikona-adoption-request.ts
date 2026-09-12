import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PaneActionRequestSchema } from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioContextV1 } from './types.ts'

export const EIKONA_ADOPT_ACTION = 'candidate.adopt'
export const eikonaAdoptionValuesSchema = z.object({
  run_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  candidate_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  content_digest: z.string().regex(/^[a-f0-9]{64}$/u),
  decision_version: z.number().int().min(0).max(999999999999999),
}).strict()
const contextFields = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
export function eikonaAdoptionDescriptorRef(artifactRef: string, contentDigest: string, decisionVersion: number) {
  return `eikona:adopt:${createHash('sha256').update(JSON.stringify([artifactRef, contentDigest, decisionVersion])).digest('hex')}`
}

/** Accept only the original bounded Pane request; no owner identity is inferred from labels. */
export function parseEikonaAdoptionRequest(input: unknown, context: CreatorStudioContextV1) {
  const parsed = PaneActionRequestSchema.safeParse(input)
  if (!parsed.success) return undefined
  const request = parsed.data, values = eikonaAdoptionValuesSchema.safeParse(request.values)
  if (!values.success || request.owner !== 'eikona' || request.actionId !== EIKONA_ADOPT_ACTION
    || contextFields.some(key => request.context[key] !== context[key])
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u.test(request.idempotencyKey)) return undefined
  const value = values.data
  const artifactRef = `eikona://artifacts/${value.run_id}/${value.candidate_id}`
  if (request.expectedTargetRef !== artifactRef || request.expectedTargetVersion !== value.content_digest
    || request.descriptorRef !== eikonaAdoptionDescriptorRef(artifactRef, value.content_digest, value.decision_version)) return undefined
  return { request, values: value, artifactRef }
}
