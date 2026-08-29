import type { DevtoolsCpuProfileAnswerV1, DevtoolsSnapshotAnswerV1 } from '../wire.ts'

interface Schema<T> { parse(value: unknown): T }
interface Codec<T> { readonly mode: 'strict'; readonly typeSymbol: string; readonly schema: Schema<T> }

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new TypeError(`${label} must be an object`)
  return value as Record<string, unknown>
}

function answer<T extends DevtoolsSnapshotAnswerV1 | DevtoolsCpuProfileAnswerV1>(value: unknown, label: string): T {
  const root = object(value, label)
  if (typeof root.ok !== 'boolean' || root.specVersion !== '1.0') throw new TypeError(`${label} has an invalid envelope`)
  if (!root.ok) {
    const error = object(root.error, `${label}.error`)
    if (typeof error.code !== 'string' || typeof error.message !== 'string' || typeof error.retryable !== 'boolean') throw new TypeError(`${label}.error is invalid`)
  }
  return value as T
}

const snapshotCodec: Codec<DevtoolsSnapshotAnswerV1> = { mode: 'strict', typeSymbol: 'DevtoolsSnapshotAnswerV1', schema: { parse: value => answer(value, 'devtools.snapshot') } }
const cpuCodec: Codec<DevtoolsCpuProfileAnswerV1> = { mode: 'strict', typeSymbol: 'DevtoolsCpuProfileAnswerV1', schema: { parse: value => answer(value, 'devtools.captureCpuProfile') } }

export const devtoolsRemoteContribution = {
  package: '@yeisme/dsh-devtools-host',
  descriptors: [
    { id: '@yeisme/dsh-devtools-host/devtools.snapshot@1', service: 'devtools', namespace: 'devtools', method: 'snapshot', invocation: { kind: 'direct' }, parameters: [{ codec: { mode: 'strict', typeSymbol: 'DevtoolsSnapshotInputV1', schema: { parse: (value: unknown) => value } } }], result: snapshotCodec },
    { id: '@yeisme/dsh-devtools-host/devtools.captureCpuProfile@1', service: 'devtools', namespace: 'devtools', method: 'captureCpuProfile', invocation: { kind: 'direct' }, parameters: [{ codec: { mode: 'strict', typeSymbol: 'DevtoolsCpuProfileInputV1', schema: { parse: (value: unknown) => value } } }], result: cpuCodec },
  ],
} as const
