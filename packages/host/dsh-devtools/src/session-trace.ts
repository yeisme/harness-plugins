import { opaqueRef, safeIdentifier } from './redaction.ts'
import type { DevtoolsStore } from './store.ts'
import type { DevtoolsSpanRecordV1 } from './types.ts'

interface SessionLike { readonly id: string }
interface EventLike { readonly type?: string; readonly time?: number; readonly data?: unknown }
interface OpenSpan { readonly startTime: number; readonly name: string; readonly sessionRef?: string; readonly callRef?: string }

const TOOL_SLOW_MS = 5000
const TTFT_SLOW_MS = 3000

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
}

function integer(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

export class SessionTraceCollector {
  private readonly turns = new Map<string, OpenSpan>()
  private readonly steps = new Map<string, OpenSpan>()
  private readonly calls = new Map<string, OpenSpan>()

  constructor(private readonly store: DevtoolsStore, private readonly now: () => number = Date.now) {}

  sessionCreated(session: SessionLike): void {
    const sessionRef = opaqueRef('session', session.id)
    this.store.append({ type: 'lifecycle', ts: this.now(), event: 'session.created', severity: 'info', summary: 'Session created', ...(sessionRef === undefined ? {} : { sessionRef }) })
  }

  event(session: SessionLike, event: EventLike): void {
    const type = event.type
    const ts = typeof event.time === 'number' && Number.isFinite(event.time) ? event.time : this.now()
    const data = record(event.data) ?? {}
    const sessionRef = opaqueRef('session', session.id)
    const turn = integer(data.turn)
    const step = integer(data.step)
    if (type === 'turn/start' && turn !== undefined) {
      this.turns.set(`${session.id}:${turn}`, { startTime: ts, name: `turn ${turn}`, ...(sessionRef === undefined ? {} : { sessionRef }) })
      return
    }
    if (type === 'step/start' && turn !== undefined && step !== undefined) {
      this.steps.set(`${session.id}:${turn}:${step}`, { startTime: ts, name: `step ${step}`, ...(sessionRef === undefined ? {} : { sessionRef }) })
      return
    }
    if (type === 'assistant/chunk' && turn !== undefined && step !== undefined) {
      const key = `${session.id}:${turn}:${step}`
      const open = this.steps.get(key)
      if (open !== undefined && !this.steps.has(`${key}:ttft`)) {
        this.steps.set(`${key}:ttft`, open)
        const span = this.appendSpan('ttft', 'time to first token', open, ts, 'ok')
        if (span.durationMs > TTFT_SLOW_MS) this.store.appendFinding({ code: 'session.ttft_slow', severity: 'warn', summary: `TTFT ${span.durationMs}ms exceeds ${TTFT_SLOW_MS}ms`, evidenceSeqs: [span.seq], ts })
      }
      return
    }
    if (type === 'assistant/message' && turn !== undefined && step !== undefined) {
      const key = `${session.id}:${turn}:${step}`
      const open = this.steps.get(key)
      if (open !== undefined) this.appendSpan('llm', open.name, open, ts, 'ok')
      this.steps.delete(key)
      this.steps.delete(`${key}:ttft`)
      return
    }
    if (type === 'tool/call') {
      const callId = typeof data.callId === 'string' ? data.callId : undefined
      if (callId !== undefined) {
        const callRef = opaqueRef('call', callId)
        this.calls.set(`${session.id}:${callId}`, { startTime: ts, name: safeIdentifier(data.name, 'tool'), ...(sessionRef === undefined ? {} : { sessionRef }), ...(callRef === undefined ? {} : { callRef }) })
      }
      return
    }
    if (type === 'tool/result') {
      const message = record(data.message)
      const source = record(message?.source)
      const callId = typeof source?.callId === 'string' ? source.callId : undefined
      if (callId === undefined) return
      const key = `${session.id}:${callId}`
      const open = this.calls.get(key)
      if (open === undefined) return
      const span = this.appendSpan('tool', open.name, open, ts, message?.isError === true ? 'error' : 'ok')
      this.calls.delete(key)
      if (span.durationMs > TOOL_SLOW_MS) this.store.appendFinding({ code: 'tool.duration_slow', severity: 'warn', summary: `${open.name} took ${span.durationMs}ms`, evidenceSeqs: [span.seq], ts })
      return
    }
    if (type === 'llm/retry') {
      this.store.append({ type: 'lifecycle', ts, event: 'llm.retry', severity: 'warn', summary: 'LLM retry scheduled', ...(sessionRef === undefined ? {} : { sessionRef }) })
      return
    }
    if (type === 'turn/end' && turn !== undefined) this.closeTurn(session.id, turn, ts)
  }

  agentError(sessionId?: string): void {
    const sessionRef = sessionId === undefined ? undefined : opaqueRef('session', sessionId)
    const lifecycle = this.store.append({ type: 'lifecycle', ts: this.now(), event: 'agent.error', severity: 'error', summary: 'Agent error; details redacted', ...(sessionRef === undefined ? {} : { sessionRef }) })
    this.store.appendFinding({ code: 'runtime.error', severity: 'error', summary: 'Agent runtime reported an error', evidenceSeqs: [lifecycle.seq], ts: lifecycle.ts })
  }

  sessionDisposed(session: SessionLike): void {
    this.closeSession(session.id, this.now())
    const sessionRef = opaqueRef('session', session.id)
    this.store.append({ type: 'lifecycle', ts: this.now(), event: 'session.disposed', severity: 'info', summary: 'Session disposed', ...(sessionRef === undefined ? {} : { sessionRef }) })
  }

  dispose(): void {
    const ts = this.now()
    for (const sessionId of new Set([...this.turns.keys(), ...this.steps.keys(), ...this.calls.keys()].map(key => key.split(':')[0]).filter((value): value is string => value !== undefined))) this.closeSession(sessionId, ts)
  }

  private closeTurn(sessionId: string, turn: number, ts: number): void {
    const key = `${sessionId}:${turn}`
    const open = this.turns.get(key)
    if (open !== undefined) this.appendSpan('turn', open.name, open, ts, 'ok')
    this.turns.delete(key)
    this.closeMatching(this.steps, `${sessionId}:${turn}:`, ts)
    this.closeMatching(this.calls, `${sessionId}:`, ts)
  }

  private closeSession(sessionId: string, ts: number): void {
    this.closeMatching(this.turns, `${sessionId}:`, ts)
    this.closeMatching(this.steps, `${sessionId}:`, ts)
    this.closeMatching(this.calls, `${sessionId}:`, ts)
  }

  private closeMatching(map: Map<string, OpenSpan>, prefix: string, ts: number): void {
    for (const [key, open] of map) {
      if (!key.startsWith(prefix)) continue
      if (key.endsWith(':ttft')) { map.delete(key); continue }
      this.appendSpan(key.includes(':') && map === this.calls ? 'tool' : map === this.turns ? 'turn' : 'llm', open.name, open, ts, 'partial')
      map.delete(key)
    }
  }

  private appendSpan(category: 'turn' | 'llm' | 'ttft' | 'tool', name: string, open: OpenSpan, endTime: number, status: 'ok' | 'error' | 'partial'): DevtoolsSpanRecordV1 {
    return this.store.append({ type: 'span', ts: endTime, category, name, status, startTime: open.startTime, endTime, durationMs: Math.max(0, endTime - open.startTime), ...(open.sessionRef === undefined ? {} : { sessionRef: open.sessionRef }), ...(open.callRef === undefined ? {} : { callRef: open.callRef }) }) as DevtoolsSpanRecordV1
  }
}
