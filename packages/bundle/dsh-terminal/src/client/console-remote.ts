/**
 * 浏览器侧自挂的 `terminalPane` Remote contribution。
 *
 * DSH Web 的 Client assembly 只挂载 in-box 生成命名空间；out-of-tree
 * 插件的新命名空间必须经公开 API `ctx.remote.$mount()` 自挂。Host 侧由
 * `TypertRemoteService` 的 source-mode discovery 动态绑定，无生成式白名单。
 *
 * 不引入 zod/typert 运行时依赖（ModuleLoader 单文件契约）：parse 以结构化
 * 校验实现，与 `@yeisme/dsh-terminal-host` 的 wire 逐字段对齐（bundle 层
 * 测试钉住两侧不漂移）。
 *
 * @module @yeisme/dsh-terminal/client/console-remote
 */

import type {
  TerminalPaneCloseResult,
  TerminalPaneListResult,
  TerminalPaneProbeResult,
  TerminalPaneReadResult,
  TerminalPaneSendResult,
  TerminalPaneSignalResult,
  TerminalPaneSpawnResult,
} from '@yeisme/dsh-terminal-host'

/** 与上游 `TypertSchema` 结构兼容的最小 parse 面。 */
interface MinimalSchema<Output> {
  parse(value: unknown): Output
}

/** 严格 codec（mode/typeSymbol/schema 与上游 `TypertCodec` 逐字段一致）。 */
interface StrictCodec {
  readonly mode: 'strict'
  readonly typeSymbol: string
  readonly schema: MinimalSchema<unknown>
}

export interface TerminalPaneInvocationDescriptor {
  readonly id: string
  readonly service: 'terminalPane'
  readonly namespace: 'terminalPane'
  readonly method: 'probe' | 'list' | 'spawn' | 'read' | 'send' | 'signal' | 'close'
  readonly invocation: { readonly kind: 'direct' }
  readonly parameters: readonly {
    readonly name: string
    readonly wire: string
    readonly source: 'json'
    readonly codec: StrictCodec
  }[]
  readonly result: StrictCodec
}

/** `$mount` 接受的 contribution 形状。 */
export interface TerminalPaneRemoteContribution {
  readonly package: '@yeisme/dsh-terminal-host'
  readonly descriptors: readonly TerminalPaneInvocationDescriptor[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** ok/失败判别的通用校验（失败码集合按方法收窄见下方）。 */
function answerSchema(okCodes: readonly string[]): MinimalSchema<unknown> {
  return {
    parse(value: unknown): unknown {
      if (!isRecord(value) || typeof value.ok !== 'boolean') {
        throw new TypeError('terminalPane answer: ok discriminator missing')
      }
      if (!value.ok && (typeof value.code !== 'string' || !okCodes.includes(value.code))) {
        throw new TypeError(`terminalPane answer: unexpected failure code ${String(value.code)}`)
      }
      return value
    },
  }
}

const PROBE_CODES: readonly string[] = []
const SESSION_CODES = [
  'service_unavailable', 'contract_mismatch', 'session_not_live', 'backend_missing', 'name_conflict',
  'spawn_rejected', 'too_many', 'terminal_not_found', 'not_owner', 'send_active', 'send_wait_timeout',
  'signal_rejected', 'close_failed', 'input_invalid',
]

/** scope 入参（sessionId）。 */
function inputSchema(required: readonly string[]): MinimalSchema<unknown> {
  return {
    parse(value: unknown): unknown {
      if (!isRecord(value)) throw new TypeError('terminalPane input: record required')
      for (const field of required) {
        if (typeof value[field] !== 'string' || (value[field] as string).length === 0) {
          throw new TypeError(`terminalPane input: ${field} must be a non-empty string`)
        }
      }
      return value
    },
  }
}

function descriptor(method: TerminalPaneInvocationDescriptor['method'], inputFields: readonly string[]): TerminalPaneInvocationDescriptor {
  const parameters = inputFields.map(() => ({
    name: 'input',
    wire: 'input',
    source: 'json' as const,
    codec: { mode: 'strict' as const, typeSymbol: `TerminalPane${method}InputV1`, schema: inputSchema(inputFields) },
  }))
  return {
    id: `@yeisme/dsh-terminal-host/terminalPane.${method}@1`,
    service: 'terminalPane',
    namespace: 'terminalPane',
    method,
    invocation: { kind: 'direct' },
    parameters,
    result: {
      mode: 'strict',
      typeSymbol: `TerminalPane${method[0]!.toUpperCase()}${method.slice(1)}AnswerV1`,
      schema: answerSchema(method === 'probe' ? PROBE_CODES : SESSION_CODES),
    },
  }
}

/** 浏览器侧自挂的 `terminalPane` Remote contribution。 */
export const terminalPaneRemoteContribution: TerminalPaneRemoteContribution = {
  package: '@yeisme/dsh-terminal-host',
  descriptors: [
    descriptor('probe', []),
    descriptor('list', ['sessionId']),
    descriptor('spawn', ['sessionId', 'type']),
    descriptor('read', ['sessionId', 'terminalId']),
    descriptor('send', ['sessionId', 'terminalId', 'text']),
    descriptor('signal', ['sessionId', 'terminalId', 'signal']),
    descriptor('close', ['sessionId', 'terminalId']),
  ],
}

/** 解析后的 Remote 面（解 RemoteResult 传输层包装）。 */
export interface TerminalPaneRemoteFace {
  probe(): Promise<TerminalPaneProbeResult>
  list(sessionId: string): Promise<TerminalPaneListResult>
  spawn(input: { sessionId: string; type: string; name?: string }): Promise<TerminalPaneSpawnResult>
  read(input: { sessionId: string; terminalId: string; offset?: number; count?: number }): Promise<TerminalPaneReadResult>
  send(input: { sessionId: string; terminalId: string; text: string; submit: boolean }): Promise<TerminalPaneSendResult>
  signal(input: { sessionId: string; terminalId: string; signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGHUP' }): Promise<TerminalPaneSignalResult>
  close(input: { sessionId: string; terminalId: string }): Promise<TerminalPaneCloseResult>
}

interface RemoteResultLike<T> {
  readonly ok: boolean
  readonly value?: T
  readonly error?: unknown
}

function optionalLookup(ctx: { get?: (name: never) => unknown } & Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  try {
    const value = ctx.get?.(key as never)
    if (isRecord(value)) return value
  } catch {
    // guard facade without the service
  }
  const prop = ctx[key]
  return isRecord(prop) ? prop : undefined
}

function isNamespaceFace(candidate: unknown): candidate is Record<string, (input?: unknown) => Promise<RemoteResultLike<unknown>>> {
  if (!isRecord(candidate)) return false
  return ['probe', 'list', 'spawn', 'read', 'send', 'signal', 'close']
    .every(method => typeof candidate[method] === 'function')
}

/**
 * 解析 terminalPane Remote：优先已挂命名空间，否则 `$mount` 自挂后取回；
 * 均失败（旧 runtime 无 $mount / 服务端拒绝）→ undefined，诚实降级。
 */
export async function resolveTerminalPaneRemote(ctx: Parameters<typeof optionalLookup>[0]): Promise<TerminalPaneRemoteFace | undefined> {
  const remote = optionalLookup(ctx, 'remote')
  if (isNamespaceFace(remote?.terminalPane)) return wrapNamespace(remote!.terminalPane)
  if (remote !== undefined && typeof remote.$mount === 'function') {
    try {
      await (remote.$mount as (contribution: unknown) => Promise<() => Promise<void>>)(terminalPaneRemoteContribution)
    } catch {
      return undefined
    }
    const mounted = optionalLookup(ctx, 'remote.terminalPane')
    if (isNamespaceFace(mounted)) return wrapNamespace(mounted)
  }
  return undefined
}

function wrapNamespace(namespace: Record<string, (input?: unknown) => Promise<RemoteResultLike<unknown>>>): TerminalPaneRemoteFace {
  const invoke = async <T>(method: string, input?: unknown): Promise<T> => {
    const answered = await namespace[method]!(input)
    if (!answered.ok) {
      const error = answered.error
      const detail = isRecord(error) && typeof error.message === 'string' ? error.message : JSON.stringify(error)
      throw new Error(`terminalPane.${method} transport failure: ${detail}`)
    }
    return answered.value as T
  }
  return {
    probe: () => invoke('probe'),
    list: sessionId => invoke('list', { sessionId }),
    spawn: input => invoke('spawn', input),
    read: input => invoke('read', input),
    send: input => invoke('send', input),
    signal: input => invoke('signal', input),
    close: input => invoke('close', input),
  }
}
