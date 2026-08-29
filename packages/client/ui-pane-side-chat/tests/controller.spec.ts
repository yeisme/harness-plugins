import { describe, expect, it } from 'vitest'
import { SideChatController, type SideChatSessionBinding, type SideChatSessionsFace } from '../src/controller.ts'

type PromptFace = SideChatSessionBinding['session']['prompt']

class SessionFake {
  readonly prompts: Array<{ text: string; mode: 'queue' | 'steer' }> = []
  cancelCount = 0
  olderCount = 0
  removed = false
  running = false
  queue: unknown[] = []
  promptError: { message?: string } | null = null
  nodes: Array<{ kind: string; seq: number; content?: Array<{ type: string; text: string }> }> = []
  promptImpl: PromptFace = async (content, mode) => {
    this.prompts.push({ text: content[0]?.text ?? '', mode })
    return { ok: true }
  }
  private readonly listeners = new Set<() => void>()

  constructor(readonly sessionId: string) {}

  emit(): void {
    for (const listener of this.listeners) listener()
  }

  readonly session = {
    prompt: (content: ReadonlyArray<{ type: 'text'; text: string }>, mode: 'queue' | 'steer') => this.promptImpl(content, mode),
    cancel: async () => {
      this.cancelCount += 1
      return { ok: true }
    },
    loadOlder: async () => {
      this.olderCount += 1
    },
    subscribe: (listener: () => void) => {
      this.listeners.add(listener)
      return () => { this.listeners.delete(listener) }
    },
    getSnapshot: () => ({
      running: this.running,
      removed: this.removed,
      nodes: this.nodes,
      queue: this.queue,
      promptError: this.promptError,
      hasMore: false,
      loadingOlder: false,
    }),
  }
}

class SessionsFake {
  readonly calls: string[] = []
  openCount = 0
  clearCount = 0
  readonly bindings = new Map<string, SessionFake>()
  private readonly rows: Record<string, { displayTitle: string; running: boolean }> = {}
  private readonly order: string[] = []
  current: string | undefined

  constructor(readonly withCreate: boolean) {
    for (const id of ['s-1', 's-2']) this.add(id, id === 's-1')
    this.current = 's-1'
  }

  add(id: string, running: boolean): SessionFake {
    const fake = new SessionFake(id)
    this.bindings.set(id, fake)
    this.order.push(id)
    this.rows[id] = { displayTitle: `Session ${id}`, running }
    return fake
  }

  readonly list = {
    getSnapshot: () => ({ ids: [...this.order], byId: this.rows, current: this.current }),
    subscribe: () => () => {},
  }

  binding(sessionId: string): SideChatSessionBinding | undefined {
    this.calls.push(`binding:${sessionId}`)
    const fake = this.bindings.get(sessionId)
    return fake === undefined ? undefined : { sessionId, session: fake.session }
  }

  fork = async (input: { sessionId: string; increaseTitle?: boolean }): Promise<string> => {
    this.calls.push(`fork:${input.sessionId}`)
    const child = `${input.sessionId}-fork`
    this.add(child, false)
    return child
  }

  create = async (_input?: { sessionId?: string }): Promise<string> => {
    this.calls.push('create')
    const id = 's-new'
    this.add(id, false)
    return id
  }

  // 主选择不变量：这些方法存在但控制器绝不触碰（测试断言计数为 0）。
  open(id: string): void {
    this.openCount += 1
    this.calls.push(`OPEN!!!:${id}`)
  }

  clear(): void {
    this.clearCount += 1
  }

  session(sessionId: string): SessionFake | undefined {
    return this.bindings.get(sessionId)
  }
}

function harness(withCreate = false): { sessions: SessionsFake; controller: SideChatController } {
  const sessions = new SessionsFake(withCreate)
  const face: SideChatSessionsFace = {
    list: sessions.list,
    binding: id => sessions.binding(id),
    fork: sessions.fork,
    ...(withCreate ? { create: (input?: { sessionId?: string }) => sessions.create(input) } : {}),
  }
  return { sessions, controller: new SideChatController(face) }
}

describe('SideChatController', () => {
  it('starts empty with create availability probed from the runtime face', () => {
    expect(harness().controller.getSnapshot()).toMatchObject({ phase: 'empty', createAvailable: false })
    expect(harness(true).controller.getSnapshot()).toMatchObject({ createAvailable: true })
  })

  it('attaches an existing session and exposes its conversation face', () => {
    const { controller } = harness()
    controller.attach('s-2')
    expect(controller.getSnapshot()).toMatchObject({ phase: 'attached', sessionId: 's-2', title: 'Session s-2' })
    expect(controller.getSession()).toBeDefined()
  })

  it('marks unresolvable sessions honestly instead of falling back', () => {
    const { controller } = harness()
    controller.attach('s-missing')
    expect(controller.getSnapshot()).toMatchObject({ phase: 'unresolvable', sessionId: 's-missing' })
    expect(controller.getSession()).toBeUndefined()
  })

  it('never calls sessions.open()/clear() across every lifecycle path (main-selection invariant)', async () => {
    const { sessions, controller } = harness(true)
    controller.attach('s-2')
    await controller.send('hello', 'auto')
    await controller.startNew()
    await controller.forkFrom('s-1')
    await controller.send('again', 'auto')
    controller.detach()
    controller.dispose()
    expect(sessions.openCount).toBe(0)
    expect(sessions.clearCount).toBe(0)
    expect(sessions.calls.filter(call => call.includes('OPEN'))).toEqual([])
  })

  it('sends prompts through the bound session face with auto steer on running sessions', async () => {
    const { sessions, controller } = harness()
    const target = sessions.session('s-1')!
    target.running = true
    controller.attach('s-1')
    await controller.send('steer me', 'auto')
    await controller.send('queue me', 'queue')
    expect(target.prompts).toEqual([
      { text: 'steer me', mode: 'steer' },
      { text: 'queue me', mode: 'queue' },
    ])
  })

  it('propagates typed prompt failures into promptError', async () => {
    const { sessions, controller } = harness()
    const target = sessions.session('s-2')!
    target.promptImpl = async () => ({ ok: false, error: { message: 'rejected: quota' } })
    controller.attach('s-2')
    await controller.send('hello', 'auto')
    expect(controller.getSnapshot()).toMatchObject({ sending: false, promptError: 'rejected: quota' })
  })

  it('starts a new session through the runtime create probe without opening it', async () => {
    const { sessions, controller } = harness(true)
    await controller.startNew()
    expect(controller.getSnapshot()).toMatchObject({ phase: 'attached', sessionId: 's-new' })
    expect(sessions.openCount).toBe(0)
  })

  it('keeps startNew a no-op when create is unavailable', async () => {
    const { controller } = harness()
    await controller.startNew()
    expect(controller.getSnapshot().phase).toBe('empty')
  })

  it('forks from a source session and attaches the child without opening it', async () => {
    const { sessions, controller } = harness()
    await controller.forkFrom('s-1')
    expect(controller.getSnapshot()).toMatchObject({ phase: 'attached', sessionId: 's-1-fork' })
    expect(sessions.calls).toContain('fork:s-1')
    expect(sessions.openCount).toBe(0)
  })

  it('surfaces typed create failures inline', async () => {
    const { sessions, controller } = harness(true)
    sessions.create = async () => { throw new Error('workspace missing') }
    await controller.startNew()
    expect(controller.getSnapshot().error).toContain('create failed')
    expect(controller.getSnapshot().starting).toBe(false)
  })

  it('cancels and paginates through the bound face', async () => {
    const { sessions, controller } = harness()
    const target = sessions.session('s-1')!
    controller.attach('s-1')
    await controller.cancel()
    await controller.loadOlder()
    expect(target.cancelCount).toBe(1)
    expect(target.olderCount).toBe(1)
  })

  it('detach cancels only the local subscription; the session stays re-attachable', () => {
    const { sessions, controller } = harness()
    controller.attach('s-1')
    const target = sessions.session('s-1')!
    controller.detach()
    expect(controller.getSnapshot()).toMatchObject({ phase: 'empty', sessionId: undefined })
    target.emit()
    controller.attach('s-1')
    expect(controller.getSnapshot()).toMatchObject({ phase: 'attached', sessionId: 's-1' })
  })

  it('mirrors promptError from conversation snapshot updates', () => {
    const { sessions, controller } = harness()
    controller.attach('s-2')
    const target = sessions.session('s-2')!
    target.promptError = { message: 'transport reset' }
    target.emit()
    expect(controller.getSnapshot().promptError).toBe('transport reset')
  })
})
