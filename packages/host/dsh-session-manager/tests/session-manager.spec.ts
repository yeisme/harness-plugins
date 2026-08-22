import { describe, expect, it } from 'vitest'
import {
  createSessionLabelsEvent,
  createSessionManagerHost,
  createSessionManagerHostPlaceholder,
  type DshSessionManagerSeams,
  type SessionManagerHostV1,
  type SessionSummaryV1,
} from '../src/index.ts'

const sampleSessions: readonly SessionSummaryV1[] = [
  {
    sessionId: 'session-1',
    title: '后端设计',
    workspaceRef: 'ws-1',
    workspaceName: 'yeisme-agent',
    archived: false,
    running: true,
    unread: false,
    labels: ['backend'],
    updatedAt: '2026-08-19T00:00:00.000Z',
  },
  {
    sessionId: 'session-2',
    title: '归档任务',
    workspaceRef: 'ws-2',
    workspaceName: 'docs',
    archived: true,
    running: false,
    unread: true,
    labels: [],
    updatedAt: '2026-08-18T00:00:00.000Z',
  },
]

function fakeSeams(): DshSessionManagerSeams {
  const calls: string[] = []
  const seams: DshSessionManagerSeams = {
    async listSessions() {
      calls.push('listSessions')
      return sampleSessions
    },
    async archiveSession(sessionId) {
      calls.push(`archive:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async restoreSession(sessionId) {
      calls.push(`restore:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async trashSession(sessionId) {
      calls.push(`trash:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async purgeSession(sessionId) {
      calls.push(`purge:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async setLabels(sessionId, labels, expectedRevision) {
      calls.push(`labels:${sessionId}:${labels.join(',')}:${String(expectedRevision ?? '')}`)
      return { status: 'ok', sessionId }
    },
    async pauseSession(sessionId) {
      calls.push(`pause:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async resumeSession(sessionId) {
      calls.push(`resume:${sessionId}`)
      return { status: 'ok', sessionId }
    },
    async forkSession(sessionId) {
      calls.push(`fork:${sessionId}`)
      return { status: 'ok', sessionId, childSessionId: 'session-child' }
    },
  }
  return { ...seams, calls }
}

describe('@yeisme/dsh-session-manager', () => {
  it('exposes a versioned host contract', () => {
    const host: SessionManagerHostV1 = createSessionManagerHostPlaceholder()
    expect(host.version).toBe('0.1.0-rc.1')
    expect(host.capability).toBe('session-manager')
  })

  it('returns an empty session list from the placeholder', async () => {
    const host = createSessionManagerHostPlaceholder()
    await expect(host.listSessions()).resolves.toEqual([])
  })

  it('returns typed not_implemented receipts from the placeholder', async () => {
    const host = createSessionManagerHostPlaceholder()
    await expect(host.archiveSession('s1')).resolves.toMatchObject({ status: 'not_implemented', sessionId: 's1' })
    await expect(host.restoreSession('s1')).resolves.toMatchObject({ status: 'not_implemented', sessionId: 's1' })
    await expect(host.trashSession('s1')).resolves.toMatchObject({ status: 'not_implemented', sessionId: 's1' })
    await expect(host.purgeSession('s1')).resolves.toMatchObject({ status: 'not_implemented', sessionId: 's1' })
    await expect(host.setLabels('s1', ['backend'])).resolves.toMatchObject({ status: 'not_implemented', sessionId: 's1' })
    await expect(host.pauseSession('s1')).resolves.toMatchObject({ status: 'not_implemented', sessionId: 's1' })
    await expect(host.resumeSession('s1')).resolves.toMatchObject({ status: 'not_implemented', sessionId: 's1' })
    const fork = await host.forkSession('s1')
    expect(fork.status).toBe('not_implemented')
    expect(fork.childSessionId).toBeUndefined()
  })

  it('delegates all calls through the typed seam', async () => {
    const seams = fakeSeams()
    const host = createSessionManagerHost(seams)
    await expect(host.listSessions()).resolves.toEqual(sampleSessions)
    await host.archiveSession('session-1')
    await host.restoreSession('session-2')
    await host.trashSession('session-1')
    await host.purgeSession('session-2')
    await host.setLabels('session-1', ['a', 'b'], 3)
    await host.pauseSession('session-1')
    await host.resumeSession('session-2')
    await host.forkSession('session-1')
    expect(seams.calls).toEqual([
      'listSessions',
      'archive:session-1',
      'restore:session-2',
      'trash:session-1',
      'purge:session-2',
      'labels:session-1:a,b:3',
      'pause:session-1',
      'resume:session-2',
      'fork:session-1',
    ])
  })
})

describe('session labels event', () => {
  it('creates a log-backed label snapshot', () => {
    const event = createSessionLabelsEvent({
      sessionId: 'session-1',
      labels: ['backend', 'release'],
      revision: 3,
      updatedAt: '2026-08-19T00:00:00.000Z',
      source: 'user',
    })
    expect(event).toMatchObject({
      type: 'session/labels',
      sessionId: 'session-1',
      labels: ['backend', 'release'],
      revision: 3,
      updatedAt: '2026-08-19T00:00:00.000Z',
      source: 'user',
    })
  })
})
