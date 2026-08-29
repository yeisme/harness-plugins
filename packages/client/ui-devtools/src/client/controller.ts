import type { DevtoolsCpuProfileAnswerV1, DevtoolsRecordV1, DevtoolsRemoteFace, DevtoolsSnapshotSuccessV1 } from '../wire.ts'

export type DevtoolsControllerState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly snapshot: DevtoolsSnapshotSuccessV1; readonly clockOffsetMs: number; readonly clockUncertaintyMs: number; readonly cpuProfile?: DevtoolsCpuProfileAnswerV1 }

export class DevtoolsController {
  private state: DevtoolsControllerState = { status: 'idle' }
  private listeners = new Set<() => void>()
  private records: DevtoolsRecordV1[] = []
  private cursor = 0
  private bootId: string | undefined
  private timer: ReturnType<typeof setInterval> | undefined
  private refreshing: Promise<void> | undefined

  constructor(private readonly remote: DevtoolsRemoteFace, private readonly now: () => number = Date.now) {}
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = (): DevtoolsControllerState => this.state

  start(): void { if (this.timer !== undefined) return; void this.refresh(); this.timer = setInterval(() => { void this.refresh() }, 1000) }
  stop(): void { if (this.timer !== undefined) clearInterval(this.timer); this.timer = undefined }

  refresh(): Promise<void> {
    if (this.refreshing !== undefined) return this.refreshing
    const started = this.now()
    if (this.state.status === 'idle') this.setState({ status: 'loading' })
    this.refreshing = this.remote.snapshot({ afterSeq: this.cursor, limit: 500 }).then(answer => {
      const finished = this.now()
      if (!answer.ok) { this.setState({ status: 'error', message: answer.error.message }); return }
      if (this.bootId !== answer.bootId) { this.bootId = answer.bootId; this.cursor = 0; this.records = [] }
      this.cursor = answer.nextSeq
      const bySeq = new Map(this.records.map(record => [record.seq, record]))
      for (const record of answer.records) bySeq.set(record.seq, record)
      this.records = [...bySeq.values()].sort((a, b) => a.seq - b.seq).slice(-3800)
      const snapshot = { ...answer, records: this.records }
      this.setState({ status: 'ready', snapshot, clockOffsetMs: answer.serverTime - ((started + finished) / 2), clockUncertaintyMs: (finished - started) / 2 })
    }).catch(() => { this.setState({ status: 'error', message: 'DevTools Host is unavailable' }) }).finally(() => { this.refreshing = undefined })
    return this.refreshing
  }

  async captureCpuProfile(durationMs = 10_000): Promise<DevtoolsCpuProfileAnswerV1> {
    const answer = await this.remote.captureCpuProfile({ durationMs })
    if (this.state.status === 'ready') this.setState({ ...this.state, cpuProfile: answer })
    return answer
  }

  private setState(state: DevtoolsControllerState): void { this.state = state; for (const listener of this.listeners) listener() }
}

export class ControllerBinding {
  private controller: DevtoolsController | undefined
  private listeners = new Set<() => void>()
  attach(controller: DevtoolsController): void { this.controller?.stop(); this.controller = controller; for (const listener of this.listeners) listener() }
  getSnapshot = (): DevtoolsController | undefined => this.controller
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  dispose(): void { this.controller?.stop(); this.controller = undefined; this.listeners.clear() }
}

export class OverlayToggle {
  private open = false
  private listeners = new Set<() => void>()
  getSnapshot = (): boolean => this.open
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  setOpen(open: boolean): void { if (this.open === open) return; this.open = open; for (const listener of this.listeners) listener() }
}
