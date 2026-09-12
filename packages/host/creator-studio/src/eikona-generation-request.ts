import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PaneActionRequestSchema } from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioContextV1 } from './types.ts'

export const EIKONA_GENERATE_ACTION = 'eikona.generation.submit'
export const eikonaGenerationValuesSchema = z.object({
  preparation_ref: z.string().regex(/^egp_[a-f0-9]{64}$/u),
  preparation_digest: z.string().regex(/^[a-f0-9]{64}$/u),
  approval_ref: z.string().regex(/^ega_[a-f0-9]{64}$/u),
  prompt_version: z.string().max(300).regex(/^eikona:\/\/prompts\/[A-Za-z0-9._-]+\/versions\/[1-9][0-9]*$/u),
  model: z.literal('openai/gpt-5.4-image-2'),
}).strict()
export function eikonaGenerationDescriptorRef(values: unknown) {
  return `eikona:generation:${createHash('sha256').update(JSON.stringify(eikonaGenerationValuesSchema.parse(values))).digest('hex')}`
}
const contextFields = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const

/** Syntax and binding guard only; current descriptor and owner approval remain mandatory. */
export function parseEikonaGenerationRequest(input: unknown, context: CreatorStudioContextV1) {
  const parsed = PaneActionRequestSchema.safeParse(input)
  if (!parsed.success) return undefined
  const request = parsed.data, values = eikonaGenerationValuesSchema.safeParse(request.values)
  if (!values.success || request.owner !== 'eikona' || request.actionId !== EIKONA_GENERATE_ACTION || request.textBody !== undefined
    || contextFields.some(key => request.context[key] !== context[key])
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u.test(request.idempotencyKey)) return undefined
  if (request.expectedTargetRef !== values.data.preparation_ref || request.expectedTargetVersion !== values.data.preparation_digest
    || request.descriptorRef !== eikonaGenerationDescriptorRef(values.data)) return undefined
  return { request, values: values.data }
}
