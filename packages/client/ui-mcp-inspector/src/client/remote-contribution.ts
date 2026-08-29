/**
 * Browser-side `toolHub` Remote contribution for `$mount`.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client/remote-contribution
 */

import type {
  ToolHubCatalogAnswerV1,
  ToolHubSetEnabledAnswerV1,
  ToolHubSetEnabledInputV1,
} from './wire.ts'
import { TOOL_HUB_SET_FAILURE_CODES } from './wire.ts'

interface MinimalSchema<Output> {
  parse(value: unknown): Output
}

interface StrictCodec {
  readonly mode: 'strict'
  readonly typeSymbol: string
  readonly schema: MinimalSchema<unknown>
}

export interface ToolHubInvocationDescriptor {
  readonly id: string
  readonly service: 'toolHub'
  readonly namespace: 'toolHub'
  readonly method: 'list' | 'setEnabled'
  readonly invocation: { readonly kind: 'direct' }
  readonly parameters: readonly {
    readonly name: string
    readonly wire: string
    readonly source: 'json'
    readonly codec: StrictCodec
  }[]
  readonly result: StrictCodec
}

export interface ToolHubRemoteContribution {
  readonly package: '@yeisme/dsh-tool-hub-host'
  readonly descriptors: readonly ToolHubInvocationDescriptor[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const HEALTH_STATES = new Set(['connected', 'disconnected', 'syncing', 'unknown'])
const REASON_CODES = new Set(['disabled_by_user', 'not_model_invocable', 'loader_disabled'])

function validateOptionalCatalogFields(value: Record<string, unknown>): void {
  if (value.observedAt !== undefined && typeof value.observedAt !== 'number') throw new TypeError('toolHub.list answer: observedAt')
  if (value.healthAvailable !== undefined && typeof value.healthAvailable !== 'boolean') throw new TypeError('toolHub.list answer: healthAvailable')
  for (const item of value.items as unknown[]) {
    if (!isRecord(item)) throw new TypeError('toolHub.list answer: item')
    if (item.reasonCode !== undefined && !REASON_CODES.has(String(item.reasonCode))) throw new TypeError('toolHub.list answer: reasonCode')
    if (item.health === undefined) continue
    if (!isRecord(item.health) || !HEALTH_STATES.has(String(item.health.state)) || typeof item.health.observedAt !== 'number') {
      throw new TypeError('toolHub.list answer: health')
    }
  }
}

const listAnswerSchema: MinimalSchema<ToolHubCatalogAnswerV1> = {
  parse(value: unknown): ToolHubCatalogAnswerV1 {
    if (!isRecord(value) || typeof value.ok !== 'boolean') {
      throw new TypeError('toolHub.list answer: ok discriminator missing')
    }
    if (value.ok) {
      if (value.specVersion !== '1.0') throw new TypeError('toolHub.list answer: specVersion')
      if (typeof value.complete !== 'boolean') throw new TypeError('toolHub.list answer: complete')
      if (typeof value.generation !== 'number') throw new TypeError('toolHub.list answer: generation')
      if (!Array.isArray(value.items)) throw new TypeError('toolHub.list answer: items')
      validateOptionalCatalogFields(value)
    } else if (value.code !== 'catalog-unavailable' && value.code !== 'storage-unavailable') {
      throw new TypeError('toolHub.list answer: unexpected failure code')
    }
    return value as unknown as ToolHubCatalogAnswerV1
  },
}

const setInputSchema: MinimalSchema<ToolHubSetEnabledInputV1> = {
  parse(value: unknown): ToolHubSetEnabledInputV1 {
    if (!isRecord(value)) throw new TypeError('toolHub.setEnabled input: record required')
    if (typeof value.id !== 'string') throw new TypeError('toolHub.setEnabled input: id')
    if (typeof value.enabled !== 'boolean') throw new TypeError('toolHub.setEnabled input: enabled')
    if (typeof value.ifGeneration !== 'number') throw new TypeError('toolHub.setEnabled input: ifGeneration')
    return value as unknown as ToolHubSetEnabledInputV1
  },
}

const setAnswerSchema: MinimalSchema<ToolHubSetEnabledAnswerV1> = {
  parse(value: unknown): ToolHubSetEnabledAnswerV1 {
    if (!isRecord(value) || typeof value.ok !== 'boolean') {
      throw new TypeError('toolHub.setEnabled answer: ok discriminator missing')
    }
    if (!value.ok && typeof value.code === 'string' && !TOOL_HUB_SET_FAILURE_CODES.has(value.code)) {
      throw new TypeError('toolHub.setEnabled answer: unexpected failure code')
    }
    return value as unknown as ToolHubSetEnabledAnswerV1
  },
}

export const toolHubRemoteContribution: ToolHubRemoteContribution = {
  package: '@yeisme/dsh-tool-hub-host',
  descriptors: [
    {
      id: '@yeisme/dsh-tool-hub-host/toolHub.list@1',
      service: 'toolHub',
      namespace: 'toolHub',
      method: 'list',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'ToolHubCatalogAnswerV1', schema: listAnswerSchema },
    },
    {
      id: '@yeisme/dsh-tool-hub-host/toolHub.setEnabled@1',
      service: 'toolHub',
      namespace: 'toolHub',
      method: 'setEnabled',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'input', wire: 'input', source: 'json', codec: { mode: 'strict', typeSymbol: 'ToolHubSetEnabledInputV1', schema: setInputSchema } },
      ],
      result: { mode: 'strict', typeSymbol: 'ToolHubSetEnabledAnswerV1', schema: setAnswerSchema },
    },
  ],
}
