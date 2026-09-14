/**
 * Fixed-command Radar adapter.
 *
 * The adapter maps typed intents to the frozen Radar MCP argv
 * `mcp --transport stdio --lane <lane>` plus one typed MCP request. The
 * binary name comes from user-level config; intents carrying binary/argv,
 * cwd, env overrides, or an unregistered method fail closed. Process
 * execution is delegated to an injected runner so tests and the browser
 * projection never touch the shell.
 *
 * The market read path below extends the same fixed-argv seam: the HOST may
 * spawn the Radar CLI as a stdio MCP server (RADAR_FIXED_ARGV, no lane for
 * reader-default reads) when no connected MCP seam exists. The browser/client
 * never receives the executable, argv, cwd, env or credentials — only the
 * resulting ConnectedMarketTransport projection seam.
 */

import {
  RADAR_RECEIPT_SCHEMA,
  type RadarActionReceiptV1,
  type RadarIntentV1,
  type RadarLane,
} from './contracts.js'
import { RADAR_INTENT_OPERATIONS, type RadarOperationV1 } from './intersection.js'
import type { ConnectedMarketTransport } from './market-adapter.js'

export const RADAR_FIXED_ARGV = ['mcp', '--transport', 'stdio'] as const

export interface RadarAdapterConfigV1 {
  /** Bare executable name from user-level config; no path separators. */
  readonly binary: string
}

export interface RadarSpawnDescriptorV1 {
  readonly binary: string
  readonly argv: readonly string[]
  readonly request: RadarMcpRequestV1
}

export interface RadarMcpRequestV1 {
  readonly tool: 'radar.search' | 'radar.execute'
  readonly args: Readonly<Record<string, unknown>>
  readonly lane: RadarLane
}

export interface RadarRunnerResultV1 {
  readonly ok: boolean
  readonly receipt?: Omit<RadarActionReceiptV1, 'schema' | 'idempotencyKey'>
  readonly error?: string
}

export type RadarRunner = (descriptor: RadarSpawnDescriptorV1) => Promise<RadarRunnerResultV1>

export type RadarAdapterRejectReason = 'unsafe_binary' | 'unregistered_method' | 'spawn_failed'

export type RadarAdapterResult =
  | { readonly ok: true; readonly receipt: RadarActionReceiptV1 }
  | { readonly ok: false; readonly reason: RadarAdapterRejectReason; readonly detail: string }

const SAFE_BINARY = /^[a-z0-9][a-z0-9._-]{0,63}$/i

/** Binary must be a bare executable name; paths, flags, and env are rejected. */
export function isSafeRadarBinary(binary: string): boolean {
  return SAFE_BINARY.test(binary) && !binary.includes('/') && !binary.includes('\\')
}

/** Resolve the lane + MCP request for an intent. Returns undefined for unregistered kinds. */
export function resolveRadarSpawn(config: RadarAdapterConfigV1, intent: RadarIntentV1): RadarSpawnDescriptorV1 | undefined {
  if (!isSafeRadarBinary(config.binary)) return undefined
  const operation: RadarOperationV1 | undefined = RADAR_INTENT_OPERATIONS[intent.kind]
  if (operation === undefined) return undefined

  const argv: readonly string[] = [...RADAR_FIXED_ARGV, '--lane', operation.lane]
  if (operation.tool === 'radar.search') {
    return {
      binary: config.binary,
      argv,
      request: {
        tool: 'radar.search',
        lane: operation.lane,
        args: {
          view: 'opportunities',
          ...(intent.opportunityRefs.length > 0 ? { refs: [...intent.opportunityRefs] } : {}),
        },
      },
    }
  }
  if (operation.action === 'feedback_add') {
    const [ref] = intent.opportunityRefs
	const kind = intent.kind === 'save' ? 'saved' : 'dismissed'
    return {
      binary: config.binary,
      argv,
      request: {
        tool: 'radar.execute',
        lane: operation.lane,
        args: {
          action: 'feedback_add',
		  input: {
			opportunity_ref: ref,
			kind,
			idempotency_key: intent.idempotencyKey,
		  },
        },
      },
    }
  }
  // operator lane is edition_build only; collect/daily_run are never emitted.
  return {
    binary: config.binary,
    argv,
    request: {
      tool: 'radar.execute',
      lane: 'operator',
      args: {
        action: 'edition_build',
		input: {},
      },
    },
  }
}

/**
 * Dispatch one intent through the injected runner. Unknown runner outcomes
 * surface as `unknown` receipts; the adapter never retries on its own.
 */
export async function dispatchRadarIntent(
  config: RadarAdapterConfigV1,
  intent: RadarIntentV1,
  runner: RadarRunner,
): Promise<RadarAdapterResult> {
  if (!isSafeRadarBinary(config.binary)) {
    return { ok: false, reason: 'unsafe_binary', detail: 'radar binary failed the safe-name check' }
  }
  const descriptor = resolveRadarSpawn(config, intent)
  if (descriptor === undefined) {
    return { ok: false, reason: 'unregistered_method', detail: `intent kind ${intent.kind} has no registered spawn` }
  }
  let result: RadarRunnerResultV1
  try {
    result = await runner(descriptor)
  } catch (error) {
    return { ok: false, reason: 'spawn_failed', detail: error instanceof Error ? error.message : 'runner failed' }
  }
  if (!result.ok || result.receipt === undefined) {
    return {
      ok: true,
      receipt: {
        schema: RADAR_RECEIPT_SCHEMA,
        idempotencyKey: intent.idempotencyKey,
        outcome: 'unknown',
        reason: result.error ?? 'radar owner outcome unknown; reconcile by run ref',
      },
    }
  }
  return {
    ok: true,
    receipt: {
      schema: RADAR_RECEIPT_SCHEMA,
      idempotencyKey: intent.idempotencyKey,
      ...result.receipt,
    },
  }
}

/**
 * Minimal stdio MCP process seam for the fixed-argv market fallback.
 *
 * Host-side only. The factory is injected so the browser bundle, tests and
 * the client projection never depend on child_process: a browser context
 * simply never constructs this path.
 */
export interface MarketStdioProcess {
  /** Write one newline-terminated JSON-RPC frame to the server's stdin. */
  write(frame: string): void
  /** Observe newline-delimited stdout frames; returns a cleanup function. */
  onLine(listener: (line: string) => void): () => void
  /** Observe process exit or spawn failure; returns a cleanup function. */
  onExit(listener: (failure: unknown) => void): () => void
  /** Terminate the process; idempotent. */
  kill(): void
}
export type MarketProcessFactory = (descriptor: { binary: string; argv: readonly string[] }) => MarketStdioProcess

/** Default host factory: node child_process spawn with pipes (no shell). */
export const nodeMarketSpawn: MarketProcessFactory = ({ binary, argv }) => {
  // Resolved lazily through process.getBuiltinModule so bundlers never pull a
  // static node: import into browser builds; only a real host reaches here.
  const childProcess = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')
  const child = childProcess.spawn(binary, [...argv], { stdio: ['pipe', 'pipe', 'pipe'] })
  const lineListeners = new Set<(line: string) => void>()
  const exitListeners = new Set<(failure: unknown) => void>()
  let buffer = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    let index: number
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line) for (const listener of [...lineListeners]) listener(line)
    }
  })
  const notifyExit = (failure: unknown) => { for (const listener of [...exitListeners]) listener(failure) }
  child.on('error', notifyExit)
  child.on('close', () => notifyExit(new Error('market_owner_process_closed')))
  return {
    write: frame => { child.stdin.write(frame + '\n') },
    onLine(listener) { lineListeners.add(listener); return () => { lineListeners.delete(listener) } },
    onExit(listener) { exitListeners.add(listener); return () => { exitListeners.delete(listener) } },
    kill: () => { child.kill() },
  }
}

export interface FixedArgvMarketConnection extends ConnectedMarketTransport {
  /** Kill the owned child process; reads after this re-establish on demand. */
  dispose(): void
}

/**
 * Market read transport over the legacy fixed Radar CLI argv
 * (`radar mcp --transport stdio`), speaking minimal MCP stdio JSON-RPC.
 *
 * One child process serves the whole connection and is (re)established
 * lazily: after a mid-read drop the pending read fails with the constant
 * `market_owner_disconnected` (mapped to the shared offline taxonomy by the
 * adapter; no raw process error ever crosses the seam) and the next read
 * spawns a fresh process. Requests are multiplexed by JSON-RPC id; an outer
 * AbortSignal kills the process instead of leaving half-read state behind.
 */
export function createFixedArgvMarketTransport(config: RadarAdapterConfigV1, options: { spawnProcess: MarketProcessFactory }): FixedArgvMarketConnection {
  if (!isSafeRadarBinary(config.binary)) throw new Error('unsafe_binary')
  let child: MarketStdioProcess | undefined
  let ready: Promise<void> | undefined
  let nextId = 1
  let disposed = false
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>()
  const teardown = () => {
    child?.kill()
    child = undefined
    ready = undefined
    // Constant error text only: spawn failures and exit codes stay host-side.
    for (const entry of [...pending.values()]) entry.reject(new Error('market_owner_disconnected'))
    pending.clear()
  }
  const establish = () => {
    if (child !== undefined) return ready
    const process_ = options.spawnProcess({ binary: config.binary, argv: [...RADAR_FIXED_ARGV] })
    child = process_
    process_.onLine(line => {
      let frame: { id?: unknown; result?: unknown; error?: { code?: unknown; data?: { code?: unknown } } }
      try { frame = JSON.parse(line) } catch { return }
      if (typeof frame.id !== 'number') return // notifications are ignored
      const entry = pending.get(frame.id)
      if (entry === undefined) return
      pending.delete(frame.id)
      if (frame.error) {
        // Preserve the owner's stable resource error code (brief_not_found,
        // evidence_not_found, ...) for the adapter's named-code mapping.
        entry.reject({ data: { code: frame.error.data?.code ?? frame.error.code ?? 'market_read_failed' } })
      } else entry.resolve(frame.result)
    })
    process_.onExit(() => { if (child === process_) teardown() })
    const initializeId = nextId++
    ready = new Promise<void>((resolve, reject) => {
      pending.set(initializeId, { resolve: () => resolve(), reject: error => reject(error) })
      process_.write(JSON.stringify({ jsonrpc: '2.0', id: initializeId, method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'dsh-personal-radar', version: '1' } } }))
      process_.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }))
    })
    return ready
  }
  return {
    async readResource(input, options) {
      if (disposed) throw new Error('market_owner_disconnected')
      // An outer abort (timeout or cancelled read) drops the whole connection
      // instead of leaving a half-read child behind; the next read rebuilds it.
      const onAbort = () => teardown()
      options?.signal?.addEventListener('abort', onAbort, { once: true })
      try {
        await establish()
        if (disposed || child === undefined) throw new Error('market_owner_disconnected')
        const id = nextId++
        // The MCP stdio resource seam mirrors the connected-transport read
        // contract: `resources/read` with the exact radar://market URI.
        return await new Promise<unknown>((resolve, reject) => {
          pending.set(id, { resolve, reject })
          child!.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'resources/read', params: { uri: input.uri } }))
        })
      } catch (error) {
        // JSON-RPC rejections carry only stable owner codes; everything else
        // collapses to the constant disconnected marker (never raw text).
        if (error && typeof error === 'object' && 'data' in error) throw error
        throw new Error('market_owner_disconnected')
      } finally {
        options?.signal?.removeEventListener('abort', onAbort)
      }
    },
    dispose() { disposed = true; teardown() },
  }
}

export interface DualPathMarketTransportOptions {
  /** Preferred seam: the host's already-connected scoped MCP market connection. */
  connected?: () => ConnectedMarketTransport | null | undefined
  /** Fallback seam: fixed-argv Radar CLI stdio server; host side only. */
  fixedArgv?: { binary: string; spawnProcess?: MarketProcessFactory }
}
export interface DualPathMarketConnection extends ConnectedMarketTransport {
  dispose(): void
}

/**
 * Compose the two host read paths into one transport contract.
 *
 * The connected MCP seam wins whenever it is present at read time (dynamic
 * per call so connection replacements are honored immediately and no process
 * is ever spawned); the fixed-argv fallback engages only when that seam is
 * absent AND a safe binary is configured. Both paths yield the same
 * ConnectedMarketTransport consumed by createConnectedRadarMarketHost, so
 * aborts, timeouts and the offline/blocked error taxonomy stay uniform.
 */
export function createDualPathMarketTransport(options: DualPathMarketTransportOptions): DualPathMarketConnection {
  const fallback = options.fixedArgv !== undefined
    ? createFixedArgvMarketTransport({ binary: options.fixedArgv.binary },
      { spawnProcess: options.fixedArgv.spawnProcess ?? nodeMarketSpawn })
    : undefined
  return {
    async readResource(input, readOptions) {
      const seam = options.connected?.() ?? null
      if (seam !== null) return seam.readResource(input, readOptions)
      if (fallback !== undefined) return fallback.readResource(input, readOptions)
      throw new Error('market_transport_unavailable')
    },
    dispose: () => fallback?.dispose(),
  }
}
