/**
 * SessionGroupings registry + external-group derivation conformance
 * (v1alpha1 seam). Uses only the fake provider helper from the public
 * seam module — no DSH-private fixtures — so these specs double as the
 * community provider example.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  EXTERNAL_GROUPING_PREFIX,
  SessionGroupings,
  externalGroupingKey,
  fakeSessionGroupingProvider,
  providerIdOfGroupBy,
} from '../src/client/grouping.ts'
import {
  deriveExternalGroups, deriveSearchResults, mergedSearchTermsBySession,
} from '../src/client/tree.ts'
import { createWorkspaceViewStore } from '../src/client/stores.ts'

const sid = (id: string) => id as SessionId

const summary = (id: string, updatedAt: number, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id), displayTitle: id, running: false, blank: false, updatedAt, ...overrides,
})
const list = (...items: SessionSummary[]): SessionListState => ({
  ids: items.map(item => item.id),
  byId: Object.fromEntries(items.map(item => [item.id, item])),
  current: undefined,
  phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
})

async function registry() {
  const ctx = new Context()
  const groupings = new SessionGroupings(ctx)
  return { ctx, groupings }
}

describe('sessionGroupings registry', () => {
  it('registers and lists providers in order-then-registration order', async () => {
    const { ctx, groupings } = await registry()
    const first = fakeSessionGroupingProvider({ id: 'b.second', label: 'Second' })
    const second = fakeSessionGroupingProvider({ id: 'a.first', label: 'First' })
    const owner = await ctx.plugin({ name: 'owner', inject: [], apply: ownerCtx => {
      ownerCtx.sessionGroupings.register(first)
      ownerCtx.sessionGroupings.register({ ...second, order: -1 })
    } })
    expect(groupings.list().map(r => r.provider.id)).toEqual(['a.first', 'b.second'])
    expect(groupings.list().map(r => r.label)).toEqual(['First', 'Second'])
    await owner.dispose()
    expect(groupings.list()).toEqual([])
  })

  it('fails loud on duplicate provider ids and keeps the existing provider', async () => {
    const { ctx, groupings } = await registry()
    const first = fakeSessionGroupingProvider({ id: 'dup' })
    const second = fakeSessionGroupingProvider({ id: 'dup' })
    const owner = await ctx.plugin({ name: 'owner', inject: [], apply: ownerCtx => {
      ownerCtx.sessionGroupings.register(first)
    } })
    expect(() => { ctx.sessionGroupings.register(second) })
      .toThrow(/duplicate provider id "dup"/)
    expect(groupings.list().map(r => r.provider)).toEqual([first])
    await owner.dispose()
  })

  it('rejects ids colliding with built-in or reserved values', async () => {
    const { ctx, groupings } = await registry()
    for (const id of ['workspace', 'flat', 'provider:evil']) {
      expect(() => { ctx.sessionGroupings.register(fakeSessionGroupingProvider({ id })) }).toThrow(/collides/)
    }
    expect(groupings.list()).toEqual([])
  })

  it('clears menu entry, subscription, and actions when the owner fiber unloads (HMR)', async () => {
    const { ctx, groupings } = await registry()
    const provider = fakeSessionGroupingProvider({ id: 'tags', groups: [] })
    let notified = 0
    groupings.subscribe(() => { notified += 1 })
    const owner = await ctx.plugin({ name: 'owner', inject: [], apply: ownerCtx => {
      ownerCtx.sessionGroupings.register(provider)
    } })
    expect(groupings.getSnapshot().providers).toHaveLength(1)
    provider.setGroups([{ id: 'g', label: 'G', sessionIds: [] }])
    expect(groupings.getSnapshot().revision).toBeGreaterThan(0)
    expect(notified).toBe(2) // 注册 + 快照变化
    await owner.dispose()
    // 卸载后：菜单项（providers）、订阅转发、动作全部消失；后续快照通知不再推进 revision。
    expect(groupings.getSnapshot().providers).toEqual([])
    const revisionAfterUnload = groupings.getSnapshot().revision
    provider.setGroups([{ id: 'g2', label: 'G2', sessionIds: [] }])
    expect(groupings.getSnapshot().revision).toBe(revisionAfterUnload)
  })

  it('exposes an idempotent manual disposer', async () => {
    const { ctx, groupings } = await registry()
    const provider = fakeSessionGroupingProvider({ id: 'manual' })
    const dispose = ctx.sessionGroupings.register(provider)
    expect(groupings.list()).toHaveLength(1)
    dispose()
    dispose()
    expect(groupings.list()).toEqual([])
  })

  it('derives selection keys that never collide with built-in values', () => {
    expect(externalGroupingKey('yeisme.session-tags')).toBe('provider:yeisme.session-tags')
    expect(providerIdOfGroupBy('workspace')).toBeUndefined()
    expect(providerIdOfGroupBy('flat')).toBeUndefined()
    expect(providerIdOfGroupBy('provider:yeisme.session-tags')).toBe('yeisme.session-tags')
    expect(EXTERNAL_GROUPING_PREFIX).toBe('provider:')
  })

  it('keeps persisted built-in groupBy values loading unchanged', () => {
    const store = createWorkspaceViewStore().create()
    expect(store.getSnapshot().groupBy).toBe('workspace')
    store.actions.setGroupBy('flat')
    expect(store.getSnapshot().groupBy).toBe('flat')
    store.actions.setGroupBy('provider:yeisme.session-tags')
    expect(store.getSnapshot().groupBy).toBe('provider:yeisme.session-tags')
    store.actions.setGroupBy('workspace')
    expect(store.getSnapshot().groupBy).toBe('workspace')
  })
})

describe('deriveExternalGroups', () => {
  it('accepts additive parent and semantic color hints without changing old providers', () => {
    const provider = fakeSessionGroupingProvider({
      id: 'functions',
      groups: [
        { id: 'workspace:w1', label: 'Alpha', sessionIds: [] },
        { id: 'function:research', parentId: 'workspace:w1', color: 'chart-1', label: 'Research', sessionIds: [sid('a')] },
      ],
    })
    expect(provider.getSnapshot().groups[1]).toMatchObject({ parentId: 'workspace:w1', color: 'chart-1' })
    const legacy = fakeSessionGroupingProvider({ id: 'legacy', groups: [{ id: 'g', label: 'G', sessionIds: [] }] })
    expect(Object.keys(legacy.getSnapshot().groups[0]!)).toEqual(['id', 'label', 'sessionIds'])
  })

  it('repeats a multi-group session in each group and dedupes inside one group', () => {
    const sessions = list(summary('a', 1), summary('b', 2))
    const groups = deriveExternalGroups(sessions, 'p', {
      revision: 1,
      groups: [
        { id: 'work', label: 'Work', sessionIds: [sid('a'), sid('b'), sid('a')] },
        { id: 'research', label: 'Research', sessionIds: [sid('a')] },
      ],
    }, [], { expandedGroups: ['provider:p:work', 'provider:p:research'] })
    expect(groups.map(g => g.label)).toEqual(['Work', 'Research'])
    expect(groups[0]!.key).toBe('provider:p:work')
    expect(groups[0]!.sessions.map(s => s.id)).toEqual([sid('b'), sid('a')])
    expect(groups[0]!.external).toBe(true)
    expect(groups[0]!.workspaceId).toBeUndefined()
    expect(groups[1]!.sessions.map(s => s.id)).toEqual([sid('a')])
    expect(groups.every(g => g.external === true)).toBe(true)
  })

  it('filters unknown, archived, subagent-origin, and non-current blank sessions', () => {
    const subagent = { ...summary('child', 5), origin: 'subagent' as const }
    const blank = { ...summary('blank', 5), blank: true }
    const sessions = list(summary('live', 1), subagent, blank, summary('archived', 9))
    const groups = deriveExternalGroups(sessions, 'p', {
      revision: 1,
      groups: [{ id: 'g', label: 'G', sessionIds: [sid('live'), sid('ghost'), sid('child'), sid('blank'), sid('archived')] }],
    }, [sid('archived')], { expandedGroups: ['provider:p:g'] })
    expect(groups[0]!.sessions.map(s => s.id)).toEqual([sid('live')])
    // 当前会话是 blank 行时该行可见。
    const withCurrent = { ...sessions, current: sid('blank') }
    const currentVisible = deriveExternalGroups(withCurrent, 'p', {
      revision: 1,
      groups: [{ id: 'g', label: 'G', sessionIds: [sid('blank')] }],
    }, [], { expandedGroups: ['provider:p:g'] })
    expect(currentVisible[0]!.sessions.map(s => s.id)).toEqual([sid('blank')])
    expect(currentVisible[0]!.containsCurrent).toBe(true)
  })

  it('applies the browser-owned manual order per namespaced group account', () => {
    const sessions = list(summary('a', 1), summary('b', 2), summary('c', 3))
    const groups = deriveExternalGroups(sessions, 'p', {
      revision: 1,
      groups: [{ id: 'g', label: 'G', sessionIds: [sid('a'), sid('b'), sid('c')] }],
    }, [], {
      expandedGroups: ['provider:p:g'],
      ordersByGroup: { 'provider:p:g': ['c', 'a'] },
    })
    // c,a 按账户序，未列出的 b 按 recency 追加。
    expect(groups[0]!.sessions.map(s => s.id)).toEqual([sid('c'), sid('a'), sid('b')])
  })
})

describe('provider search terms', () => {
  it('merge per session across providers', () => {
    const merged = mergedSearchTermsBySession([
      { revision: 1, groups: [], searchTermsBySession: { s1: ['a', 'b'] } },
      { revision: 1, groups: [], searchTermsBySession: { s1: ['b', 'c'], s2: ['x'] } },
    ])
    expect(merged).toEqual({ s1: ['a', 'b', 'c'], s2: ['x'] })
    expect(mergedSearchTermsBySession([])).toBeUndefined()
    expect(mergedSearchTermsBySession([{ revision: 1, groups: [] }])).toBeUndefined()
  })

  it('match local search rows without changing the Host content search', () => {
    const sessions = list(summary('s1', 1), summary('s2', 2))
    const result = deriveSearchResults(
      sessions, [], 'tagonly', [], new Map(), { items: [], hasMore: false }, 20,
      { s1: ['tagonly'] },
    )
    expect(result.items.map(item => item.id)).toEqual([sid('s1')])
    const withoutTerms = deriveSearchResults(
      sessions, [], 'tagonly', [], new Map(), { items: [], hasMore: false }, 20,
    )
    expect(withoutTerms.items).toEqual([])
  })
})
