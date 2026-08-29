/** Self-mount descriptor for the out-of-tree `sessionOrganization` namespace. */

import type { SessionOrganizationRemoteFace } from './organization-wire.ts'
import { sessionTagsRemoteContribution } from './remote-contribution.ts'

interface MinimalSchema<T> { parse(value: unknown): T }
interface StrictCodec { readonly mode: 'strict'; readonly typeSymbol: string; readonly schema: MinimalSchema<unknown> }

export interface SessionOrganizationInvocationDescriptor {
  readonly id: string
  readonly service: 'sessionOrganization'
  readonly namespace: 'sessionOrganization'
  readonly method: keyof SessionOrganizationRemoteFace
  readonly invocation: { readonly kind: 'direct' }
  readonly parameters: readonly { readonly name: string; readonly wire: string; readonly source: 'json'; readonly codec: StrictCodec }[]
  readonly result: StrictCodec
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new TypeError(`${label}: record required`)
  return value as Record<string, unknown>
}

const inputSchema: MinimalSchema<Record<string, unknown>> = { parse: value => record(value, 'sessionOrganization input') }
const answerSchema: MinimalSchema<Record<string, unknown>> = {
  parse(value) {
    const result = record(value, 'sessionOrganization answer')
    if (typeof result.ok !== 'boolean') throw new TypeError('sessionOrganization answer: ok discriminator required')
    return result
  },
}
const inputCodec: StrictCodec = { mode: 'strict', typeSymbol: 'SessionOrganizationInputV1', schema: inputSchema }
const resultCodec: StrictCodec = { mode: 'strict', typeSymbol: 'SessionOrganizationAnswerV1', schema: answerSchema }

const METHODS = [
  'snapshot', 'setAssignment', 'putFunctionType', 'putTagCatalog', 'putRule',
  'classify', 'planBatch', 'unlockAdmin', 'executeBatch', 'undoBatch',
] as const satisfies readonly (keyof SessionOrganizationRemoteFace)[]

export const sessionOrganizationRemoteContribution = {
  package: '@yeisme/dsh-session-tags-host' as const,
  descriptors: METHODS.map(method => ({
    id: `@yeisme/dsh-session-tags-host/sessionOrganization.${method}@1`,
    service: 'sessionOrganization' as const,
    namespace: 'sessionOrganization' as const,
    method,
    invocation: { kind: 'direct' as const },
    parameters: method === 'snapshot' || method === 'unlockAdmin'
      ? []
      : [{ name: 'input', wire: 'input', source: 'json' as const, codec: inputCodec }],
    result: resultCodec,
  })) satisfies readonly SessionOrganizationInvocationDescriptor[],
}

/** One mount keeps the legacy tags namespace and additive organization namespace together. */
export const sessionManagementRemoteContribution = {
  package: '@yeisme/dsh-session-tags-host' as const,
  descriptors: [...sessionTagsRemoteContribution.descriptors, ...sessionOrganizationRemoteContribution.descriptors],
}
