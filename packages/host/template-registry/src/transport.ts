/**
 * Fixed-argv stdio MCP transport for the template-registry owner (task 2.1).
 *
 * Cloned from the proven dsh-personal-radar fixed-argv seam
 * (packages/host/dsh-personal-radar/src/adapter.ts createFixedArgvMarketTransport):
 * the HOST may spawn the template-registry CLI as a stdio MCP server with the
 * frozen argv `mcp serve`; process execution is delegated to an injected
 * factory (no shell, pipes only) so tests and the browser projection never
 * depend on child_process. The binary name comes from user-level config and
 * must stay a bare executable name.
 *
 * Lifecycle model (mirrors the radar transport):
 * - one child process serves the whole connection and is (re)established
 *   lazily: the first request spawns + initializes, later requests reuse it;
 * - after a mid-request drop every pending request fails with the CONSTANT
 *   `template_registry_disconnected` marker (no raw process error text ever
 *   crosses the seam) and the next request spawns a fresh process;
 * - requests are multiplexed by JSON-RPC id; notifications are ignored;
 * - JSON-RPC error frames reject with `{ data: { code } }` so the owner's
 *   stable error codes (REVISION_CONFLICT, INPUT_INVALID, ...) survive for
 *   the typed RPC layer;
 * - an outer AbortSignal tears the whole connection down instead of leaving
 *   half-read state behind (the probe uses this for its timeout).
 *
 * @module @yeisme/dsh-template-registry/transport
 */

/** Frozen owner argv verified live against the published server (2026-09-14). */
export const TEMPLATE_REGISTRY_FIXED_ARGV = ['mcp', 'serve'] as const

/** Protocol version the real server negotiated in the live handshake. */
export const TEMPLATE_REGISTRY_MCP_PROTOCOL = '2025-06-18'

/** Constant disconnect marker — the only transport failure text that crosses the seam. */
export const TEMPLATE_REGISTRY_DISCONNECTED = 'template_registry_disconnected'

const SAFE_BINARY = /^[a-z0-9][a-z0-9._-]{0,63}$/i

/** Binary must be a bare executable name; paths, flags, and env are rejected. */
export function isSafeTemplateRegistryBinary(binary: string): boolean {
  return SAFE_BINARY.test(binary) && !binary.includes('/') && !binary.includes('\\')
}

export interface TemplateRegistryServerInfo {
  readonly protocolVersion: string
  readonly serverName: string
  readonly serverVersion: string
}

/**
 * Minimal stdio process seam. Host-side only; the injected factory keeps the
 * browser bundle and tests free of child_process.
 */
export interface TemplateRegistryStdioProcess {
  /** Write one newline-terminated JSON-RPC frame to the server's stdin. */
  write(frame: string): void
  /** Observe newline-delimited stdout frames; returns a cleanup function. */
  onLine(listener: (line: string) => void): () => void
  /** Observe process exit or spawn failure; returns a cleanup function. */
  onExit(listener: (failure: unknown) => void): () => void
  /** Terminate the process; idempotent. */
  kill(): void
}

export type TemplateRegistryProcessFactory = (descriptor: {
  readonly binary: string
  readonly argv: readonly string[]
  /** Owner project directory (the server resolves its store relative to cwd). */
  readonly cwd?: string
}) => TemplateRegistryStdioProcess

/** Default host factory: node child_process spawn with pipes (no shell). */
export const nodeTemplateRegistrySpawn: TemplateRegistryProcessFactory = ({ binary, argv, cwd }) => {
  // Resolved lazily through process.getBuiltinModule so bundlers never pull a
  // static node: import into browser builds; only a real host reaches here.
  const childProcess = process.getBuiltinModule('node:child_process') as typeof import('node:child_process')
  const child = childProcess.spawn(binary, [...argv], { stdio: ['pipe', 'pipe', 'pipe'], ...(cwd === undefined ? {} : { cwd }) })
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
  child.on('close', () => notifyExit(new Error('template_registry_owner_process_closed')))
  return {
    write: frame => { child.stdin.write(frame + '\n') },
    onLine(listener) { lineListeners.add(listener); return () => { lineListeners.delete(listener) } },
    onExit(listener) { exitListeners.add(listener); return () => { exitListeners.delete(listener) } },
    kill: () => { child.kill() },
  }
}

export interface TemplateRegistryMcpConnection {
  /** One JSON-RPC request; rejects with the constant marker or an owner error code. */
  request(method: string, params?: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>
  /** Server identity from the current (or freshly established) handshake. */
  serverInfo(options?: { signal?: AbortSignal }): Promise<TemplateRegistryServerInfo>
  /** Kill the owned child process; later requests reject with the constant marker. */
  dispose(): void
}

interface PendingEntry { resolve: (value: unknown) => void; reject: (error: unknown) => void }

interface JsonRpcFrame {
  id?: unknown
  result?: unknown
  error?: { code?: unknown; data?: { code?: unknown } }
}

/**
 * Create the fixed-argv stdio MCP connection. Unsafe binary names throw at
 * construction (`unsafe_binary`), mirroring the radar guard.
 */
export function createTemplateRegistryMcpConnection(
  config: { readonly binary: string; readonly cwd?: string },
  options: { readonly spawnProcess: TemplateRegistryProcessFactory },
): TemplateRegistryMcpConnection {
  if (!isSafeTemplateRegistryBinary(config.binary)) throw new Error('unsafe_binary')
  let child: TemplateRegistryStdioProcess | undefined
  let ready: Promise<TemplateRegistryServerInfo> | undefined
  let nextId = 1
  let disposed = false
  const pending = new Map<number, PendingEntry>()

  const teardown = () => {
    child?.kill()
    child = undefined
    ready = undefined
    // Constant error text only: spawn failures and exit codes stay host-side.
    for (const entry of [...pending.values()]) entry.reject(new Error(TEMPLATE_REGISTRY_DISCONNECTED))
    pending.clear()
  }

  const establish = (): Promise<TemplateRegistryServerInfo> => {
    if (child !== undefined) return ready!
    const process_ = options.spawnProcess({ binary: config.binary, argv: [...TEMPLATE_REGISTRY_FIXED_ARGV], ...(config.cwd === undefined ? {} : { cwd: config.cwd }) })
    child = process_
    process_.onLine(line => {
      let frame: JsonRpcFrame
      try { frame = JSON.parse(line) as JsonRpcFrame } catch { return }
      if (typeof frame.id !== 'number') return // notifications (initialized, logging) are ignored
      const entry = pending.get(frame.id)
      if (entry === undefined) return
      pending.delete(frame.id)
      if (frame.error) {
        // Preserve the owner's stable error code (REVISION_CONFLICT,
        // INPUT_INVALID, ...) for the typed RPC layer's named-code mapping.
        entry.reject({ data: { code: frame.error.data?.code ?? frame.error.code ?? 'template_registry_call_failed' } })
      } else entry.resolve(frame.result)
    })
    process_.onExit(() => { if (child === process_) teardown() })
    const initializeId = nextId++
    const handshake = new Promise<TemplateRegistryServerInfo>((resolve, reject) => {
      pending.set(initializeId, {
        resolve: result => {
          const info = (result ?? {}) as { protocolVersion?: unknown; serverInfo?: { name?: unknown; version?: unknown } }
          const serverName = typeof info.serverInfo?.name === 'string' ? info.serverInfo.name : ''
          const serverVersion = typeof info.serverInfo?.version === 'string' ? info.serverInfo.version : ''
          const protocolVersion = typeof info.protocolVersion === 'string' ? info.protocolVersion : ''
          if (serverName === '' || protocolVersion === '') {
            reject(new Error(TEMPLATE_REGISTRY_DISCONNECTED))
            return
          }
          resolve({ protocolVersion, serverName, serverVersion })
        },
        reject: error => reject(error),
      })
      process_.write(JSON.stringify({ jsonrpc: '2.0', id: initializeId, method: 'initialize',
        params: { protocolVersion: TEMPLATE_REGISTRY_MCP_PROTOCOL, capabilities: {}, clientInfo: { name: 'dsh-template-registry', version: '1' } } }))
      process_.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }))
    })
    ready = handshake
    return handshake
  }

  const request = async (method: string, params?: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown> => {
    if (disposed) throw new Error(TEMPLATE_REGISTRY_DISCONNECTED)
    // An outer abort (timeout or cancelled probe) drops the whole connection
    // instead of leaving a half-read child behind; the next call rebuilds it.
    const onAbort = () => teardown()
    options?.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      await establish()
      if (disposed || child === undefined) throw new Error(TEMPLATE_REGISTRY_DISCONNECTED)
      const id = nextId++
      return await new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        child!.write(JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) }))
      })
    } catch (error) {
      // JSON-RPC rejections carry only stable owner codes; everything else
      // collapses to the constant disconnected marker (never raw text).
      if (error && typeof error === 'object' && 'data' in error) throw error
      throw new Error(TEMPLATE_REGISTRY_DISCONNECTED)
    } finally {
      options?.signal?.removeEventListener('abort', onAbort)
    }
  }

  return {
    request,
    // The handshake result IS the server info; re-running establish() on a
    // live child reuses the resolved promise without another initialize.
    // An outer abort (the probe timeout) tears the connection down so a
    // silent owner cannot hold the probe open.
    serverInfo: async options_ => {
      const onAbort = () => teardown()
      options_?.signal?.addEventListener('abort', onAbort, { once: true })
      try {
        return await establish()
      } catch (error) {
        if (error && typeof error === 'object' && 'data' in error) throw error
        throw new Error(TEMPLATE_REGISTRY_DISCONNECTED)
      } finally {
        options_?.signal?.removeEventListener('abort', onAbort)
      }
    },
    dispose() { disposed = true; teardown() },
  }
}
