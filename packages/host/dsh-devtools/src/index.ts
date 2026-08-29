import type { Context, Exporter, Message } from '@deepseek-ai/cordis'
import { CpuProfiler } from './cpu-profile.ts'
import { HostPerformanceSampler } from './performance.ts'
import { DevtoolsRemoteService } from './remote.ts'
import { DevtoolsService } from './service.ts'
import { SessionTraceCollector } from './session-trace.ts'
import { DevtoolsStore } from './store.ts'
import type { DevtoolsSeverity } from './types.ts'

export const name = 'dsh-devtools-host'
export const inject = ['typert', 'webServer'] as const

interface Config {
  readonly level?: DevtoolsSeverity
  readonly sampleIntervalMs?: number
  readonly summaryIntervalMs?: number
}

interface WebServerFace { readonly host?: string }
interface SessionLike { readonly id: string }
interface AgentErrorLike { readonly agent?: { readonly session?: { readonly id?: string } } }

function optionalGet(ctx: Context, key: string): unknown {
  try { return (ctx as unknown as { get(name: never): unknown }).get(key as never) } catch { return undefined }
}

function isLoopbackHost(host: unknown): boolean {
  return host === '127.0.0.1' || host === '::1' || host === 'localhost'
}

function envLevel(config: Config): DevtoolsSeverity {
  const value = config.level ?? process.env.DSH_DEVTOOLS_LEVEL ?? 'info'
  return value === 'error' || value === 'warn' || value === 'debug' ? value : 'info'
}

export function apply(ctx: Context, config: Config = {}): void {
  const now = Date.now
  const store = new DevtoolsStore({ now })
  const webServer = optionalGet(ctx, 'webServer') as WebServerFace | undefined
  const cpuProfiler = new CpuProfiler(() => isLoopbackHost(webServer?.host))
  const terminal = { write: (line: string): void => { process.stderr.write(`${line}\n`) } }
  const service = new DevtoolsService(store, cpuProfiler, {
    logger: true,
    sessionTimeline: true,
    hostMetrics: true,
    exactRpcCorrelation: false,
  }, terminal, envLevel(config))
  const traces = new SessionTraceCollector(store, now)
  const sampler = new HostPerformanceSampler(store, now)
  const remote = new DevtoolsRemoteService(ctx, service)
  void remote

  const exporter: Exporter = { colors: false, levels: { default: 3 }, export: (message: Message) => { service.ingestLog(message) } }
  const logger = ctx.logger as typeof ctx.logger & { readonly buffer?: readonly Message[] }
  for (const message of logger.buffer ?? []) service.ingestLog(message)
  ctx.logger.exporter(exporter)

  const ready = store.append({ type: 'lifecycle', ts: now(), event: 'devtools.ready', severity: 'info', summary: 'DSH DevTools ready' })
  terminal.write(`[dsh-devtools] ready boot_id=${store.bootId} stdout=unchanged storage=memory cpu_profile=${cpuProfiler.available() ? 'local' : 'disabled'}`)
  void ready
  const unsubscribeTerminal = store.subscribe(record => {
    if (record.type === 'finding' || (record.type === 'lifecycle' && record.severity !== 'info')) terminal.write(service.render(record))
  })

  const sessionCtx = ctx as unknown as {
    on(name: 'session/created', listener: (session: SessionLike) => void): () => void
    on(name: 'session/event', listener: (session: SessionLike, event: unknown) => void): () => void
    on(name: 'session/disposed', listener: (session: SessionLike) => void): () => void
    on(name: 'agent/error', listener: (event: AgentErrorLike) => void): () => void
  }
  sessionCtx.on('session/created', session => { traces.sessionCreated(session) })
  sessionCtx.on('session/event', (session, event) => { traces.event(session, event as never) })
  sessionCtx.on('session/disposed', session => { traces.sessionDisposed(session) })
  sessionCtx.on('agent/error', event => { traces.agentError(event.agent?.session?.id) })

  const sampleIntervalMs = Math.max(250, config.sampleIntervalMs ?? 1000)
  const summaryEvery = Math.max(1, Math.round((config.summaryIntervalMs ?? 10_000) / sampleIntervalMs))
  let samples = 0
  const interval = setInterval(() => {
    const sample = sampler.sample()
    samples += 1
    if (samples % summaryEvery === 0) terminal.write(service.render(sample))
  }, sampleIntervalMs)
  interval.unref()

  ctx.effect(() => () => {
    clearInterval(interval)
    unsubscribeTerminal()
    traces.dispose()
    sampler.dispose()
    cpuProfiler.dispose()
    const shutdown = store.append({ type: 'lifecycle', ts: now(), event: 'devtools.shutdown', severity: 'info', summary: 'DSH DevTools stopped' })
    const summary = store.summary()
    terminal.write(`[dsh-devtools] shutdown uptime_ms=${summary.uptimeMs} records=${summary.records} errors=${summary.errors} findings=${summary.findings}`)
    void shutdown
  }, 'dsh-devtools: shutdown')
}

const DshDevtoolsHostPlugin = { name, inject, apply }
export default DshDevtoolsHostPlugin

export { CpuProfiler } from './cpu-profile.ts'
export type { InspectorSessionFace } from './cpu-profile.ts'
export { HostPerformanceSampler } from './performance.ts'
export type { HostMetricsSource } from './performance.ts'
export { containsForbiddenContent, logFingerprint, normalizeScriptUrl, opaqueRef, safeIdentifier } from './redaction.ts'
export { DevtoolsRemoteService, devtoolsRemoteMarkers } from './remote.ts'
export { DevtoolsService } from './service.ts'
export { SessionTraceCollector } from './session-trace.ts'
export { DevtoolsStore } from './store.ts'
export * from './types.ts'
