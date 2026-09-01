import { describe, expect, it } from 'vitest'
import {
  createOfficialSeamsSessionManagerHost,
  createOfficialSeamsSessionManagerSeams,
  createSessionManagerHostPlaceholder,
  sessionManagerSeamGaps,
  type DshSessionManagerSeamSources,
  type OfficialSessionHeaderFace,
} from '../src/index.ts'

interface RegistryLog {
  readonly archive: readonly string[]
  readonly attach: readonly string[]
}

function fakeSources(options: {
  readonly archiveFails?: boolean
  readonly createFails?: boolean
  readonly withForkSeams?: boolean
  readonly withSessionQuery?: boolean
} = {}): DshSessionManagerSeamSources & { log: RegistryLog; created: unknown[] } {
  const log: RegistryLog = { archive: [], attach: [] }
  const created: unknown[] = []
  const headers: readonly OfficialSessionHeaderFace[] = [
    { id: 'session-1', createdAt: 1_000, cwd: 'ws-root/yeisme-agent' },
    { id: 'session-2', createdAt: 2_000, cwd: 'ws-root/docs', parentSession: 'session-1' },
    { id: 'session-3', createdAt: 3_000 },
  ]
  const workspaces = [{
    id: 'ws-1',
    title: 'yeisme-agent',
    path: 'ws-root/yeisme-agent',
    sessionIds: ['session-1', 'session-2'],
    attachSession: async (sessionId: string): Promise<void> => {
      log.attach.push(sessionId)
    },
  }]
  const agents = new Map<string, { id: string; status: string }>([
    ['session-1', { id: 'session-1', status: 'running' }],
    ['session-2', { id: 'session-2', status: 'idle' }],
  ])
  const sources: DshSessionManagerSeamSources & { log: RegistryLog; created: unknown[] } = {
    log,
    created,
    sessionPersistence: {
      async list(): Promise<readonly OfficialSessionHeaderFace[]> {
        return headers
      },
      ...(options.withForkSeams === true ? {
        async readFrom(sessionId: string) {
          expect(sessionId).toBe('session-1')
          return {
            meta: headers[0],
            events: [
              { type: 'turn/start' },
              { type: 'user/message' },
              { type: 'turn/end' },
              { type: 'turn/start' },
              { type: 'user/message' },
            ],
          }
        },
      } : {}),
    },
    workspaceRegistry: {
      list: () => workspaces,
      archivedSessionIds: ['session-2'],
      async archiveSession(sessionId: string): Promise<void> {
        log.archive.push(sessionId)
        if (options.archiveFails === true) throw new Error('unknown session')
      },
    },
    agents: {
      get: (sessionId: string) => agents.get(sessionId),
      ...(options.withForkSeams === true ? {
        async create(createOptions: unknown): Promise<unknown> {
          created.push(createOptions)
          if (options.createFails === true) throw new Error('factory unavailable')
          return { ok: true }
        },
      } : {}),
    },
    ...(options.withSessionQuery === true ? {
      sessionQuery: {
        async listSessions(): Promise<readonly { header: OfficialSessionHeaderFace; live: boolean; persisted: boolean }[]> {
          return headers.map((header, index) => ({ header, live: index === 0, persisted: true }))
        },
        async readTitleSnapshots(sessionIds: readonly string[]) {
          return sessionIds.flatMap(sessionId => sessionId === 'session-1'
            ? [{ sessionId, status: 'fulfilled' as const, value: { title: { title: '后端设计', updatedAt: 1_750_000_000_000 } } }]
            : [])
        },
      },
    } : {}),
  }
  return sources
}

describe('sessionManagerSeamGaps', () => {
  it('reports no gaps when every required seam has the expected shape', () => {
    expect(sessionManagerSeamGaps(fakeSources())).toEqual([])
  })

  it('names each missing or shape-drifted required seam', () => {
    expect(sessionManagerSeamGaps({})).toEqual(['sessionPersistence.list', 'workspaceRegistry.list+archive', 'agents.get'])
    expect(sessionManagerSeamGaps({ sessionPersistence: {}, workspaceRegistry: { list: () => [] }, agents: { get: () => undefined } }))
      .toEqual(['sessionPersistence.list', 'workspaceRegistry.list+archive'])
  })
})

describe('official-seams adapter', () => {
  it('folds persistence headers with workspace grouping, archive set, and live status', async () => {
    const host = createOfficialSeamsSessionManagerHost(fakeSources())
    const rows = await host.listSessions()
    expect(rows).toEqual([
      {
        sessionId: 'session-3',
        archived: false,
        running: false,
        unread: false,
        labels: [],
      },
      {
        sessionId: 'session-2',
        workspaceRef: 'ws-1',
        workspaceName: 'yeisme-agent',
        archived: true,
        running: false,
        unread: false,
        labels: [],
        parentSessionId: 'session-1',
      },
      {
        sessionId: 'session-1',
        workspaceRef: 'ws-1',
        workspaceName: 'yeisme-agent',
        archived: false,
        running: true,
        unread: false,
        labels: [],
      },
    ])
  })

  it('prefers the sessionQuery corpus and folds log-backed titles when available', async () => {
    const host = createOfficialSeamsSessionManagerHost(fakeSources({ withSessionQuery: true }))
    const rows = await host.listSessions()
    const titled = rows.find(row => row.sessionId === 'session-1')
    expect(titled).toMatchObject({
      title: '后端设计',
      updatedAt: new Date(1_750_000_000_000).toISOString(),
    })
    expect(rows.find(row => row.sessionId === 'session-2')?.title).toBeUndefined()
  })

  it('archives through the durable workspace registry and maps failures to typed receipts', async () => {
    const sources = fakeSources()
    const host = createOfficialSeamsSessionManagerHost(sources)
    await expect(host.archiveSession('session-1')).resolves.toMatchObject({ status: 'ok', sessionId: 'session-1' })
    expect(sources.log.archive).toEqual(['session-1'])

    const failing = createOfficialSeamsSessionManagerHost(fakeSources({ archiveFails: true }))
    await expect(failing.archiveSession('session-x')).resolves.toMatchObject({
      status: 'rejected',
      sessionId: 'session-x',
      reason: 'unknown session',
    })
  })

  it('keeps faces without an official seam on honest not_implemented receipts', async () => {
    const host = createOfficialSeamsSessionManagerHost(fakeSources())
    const expectations: readonly [string, Promise<{ status: string; reason?: string }>][] = [
      ['restoreSession', host.restoreSession('session-1')],
      ['trashSession', host.trashSession('session-1')],
      ['purgeSession', host.purgeSession('session-1')],
      ['setLabels', host.setLabels('session-1', ['backend'])],
      ['pauseSession', host.pauseSession('session-1')],
      ['resumeSession', host.resumeSession('session-1')],
    ]
    for (const [label, receipt] of expectations) {
      const settled = await receipt
      expect(settled.status, label).toBe('not_implemented')
      expect(settled.reason, label).toBeTruthy()
    }
  })

  it('forks through the official factory with a balanced turn-boundary seed', async () => {
    const sources = fakeSources({ withForkSeams: true })
    const host = createOfficialSeamsSessionManagerHost(sources)
    const receipt = await host.forkSession('session-1')
    expect(receipt.status).toBe('ok')
    expect(receipt.childSessionId).toMatch(/[0-9a-f-]{36}/)
    expect(sources.created).toEqual([{
      sessionId: receipt.childSessionId,
      meta: { cwd: 'ws-root/yeisme-agent', parentSession: 'session-1', seedLength: 3 },
      seed: [{ type: 'turn/start' }, { type: 'user/message' }, { type: 'turn/end' }],
    }])
    expect(sources.log.attach).toEqual([receipt.childSessionId])
  })

  it('degrades fork honestly when the factory rejects or the seams are absent', async () => {
    const failing = createOfficialSeamsSessionManagerHost(fakeSources({ withForkSeams: true, createFails: true }))
    const failedReceipt = await failing.forkSession('session-1')
    expect(failedReceipt).toMatchObject({ status: 'rejected', reason: 'factory unavailable' })
    expect(failedReceipt.childSessionId).toBeUndefined()

    const unwired = createOfficialSeamsSessionManagerHost(fakeSources())
    await expect(unwired.forkSession('session-1')).resolves.toMatchObject({
      status: 'not_implemented',
      reason: 'fork needs official sessionPersistence.readFrom and agents.create seams',
    })
  })
})

describe('degraded equivalence without official seams', () => {
  it('keeps mutation receipts equivalent to the placeholder and fails loud on reads', async () => {
    const seams = createOfficialSeamsSessionManagerSeams({})
    const placeholder = createSessionManagerHostPlaceholder()
    for (const action of ['archiveSession', 'restoreSession', 'trashSession', 'purgeSession', 'setLabels', 'pauseSession', 'resumeSession', 'forkSession'] as const) {
      const adapterReceipt = await (seams[action] as (id: string) => Promise<{ status: string }>)('session-1')
      const placeholderReceipt = await (placeholder[action] as (id: string) => Promise<{ status: string }>)('session-1')
      expect(adapterReceipt.status, action).toBe(placeholderReceipt.status)
      expect(adapterReceipt.status).toBe('not_implemented')
    }
    await expect(seams.listSessions()).rejects.toThrow(/official seam unavailable: sessionPersistence/)
  })
})
