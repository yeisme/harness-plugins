import { describe, expect, it } from 'vitest'
import { createSessionTagsController } from '../src/client/controller.ts'
import {
  MANAGE_TAGS_ACTION_ID,
  SESSION_TAGS_PROVIDER_ID,
  UNTAGGED_GROUP_ID,
  createSessionTagsProvider,
} from '../src/client/provider.ts'
import type { SessionTagsRemoteFace } from '../src/client/wire.ts'

class StubRemote implements SessionTagsRemoteFace {
  private answer: { entries: Array<{ sessionId: string; row: { session: object; tags: string[]; version: string; updatedAt: number } }> } = { entries: [] }
  setAnswer(entries: Array<[string, string[]]>): void {
    this.answer = {
      entries: entries.map(([sessionId, tags]) => ({
        sessionId,
        row: { session: { createdAt: '2026-01-01T00:00:00.000Z' }, tags, version: `v-${sessionId}`, updatedAt: 1 },
      })),
    }
  }
  async list() {
    return { ok: true as const, specVersion: '1.0' as const, entries: this.answer.entries }
  }
  async set() { throw new Error('not used') }
}

async function setup(entries: Array<[string, string[]]>, allIds: string[], locale?: string) {
  const remote = new StubRemote()
  remote.setAnswer(entries)
  const controller = createSessionTagsController({ remote })
  await controller.refresh() // 首次挂载读取（provider 构造前进入 ready）
  const opened: string[] = []
  const provider = createSessionTagsProvider({
    controller,
    allSessionIds: () => allIds,
    locale,
    labels: { menuLabel: '按标签', untaggedLabel: '未标记', manageActionLabel: '管理标签' },
    onManageTags: sessionId => { opened.push(sessionId) },
  })
  return { remote, controller, provider, opened, setAnswer: remote.setAnswer.bind(remote), setAllIds(ids: string[]) { allIds = ids } }
}

describe('session-tags provider projection', () => {
  it('registers under the fixed provider id with manage-tags action', async () => {
    const { provider, opened } = await setup([], ['s1'])
    expect(provider.id).toBe('yeisme.session-tags')
    expect(provider.label).toBeInstanceOf(Function)
    const action = provider.sessionActions?.[0]
    expect(action?.id).toBe(MANAGE_TAGS_ACTION_ID)
    action?.open('s7')
    expect(opened).toEqual(['s7'])
  })

  it('projects one group per tag and repeats multi-tag sessions in each group', async () => {
    const { provider } = await setup([['s1', ['工作', '研究']], ['s2', ['工作']]], ['s1', 's2'])
    const snapshot = provider.getSnapshot()
    const groups = Object.fromEntries(snapshot.groups.map(g => [g.label, g.sessionIds]))
    expect(groups['工作']).toEqual(['s1', 's2'])
    expect(groups['研究']).toEqual(['s1'])
    // 两个条目打开的是同一 canonical SessionId。
    expect(snapshot.groups.find(g => g.label === '工作')?.sessionIds).toContain('s1')
  })

  it('puts untagged sessions last in a localized group', async () => {
    const { provider } = await setup([['s1', ['b']]], ['s1', 's2', 's3'])
    const snapshot = provider.getSnapshot()
    const last = snapshot.groups[snapshot.groups.length - 1]
    expect(last?.id).toBe(UNTAGGED_GROUP_ID)
    expect(last?.label).toBe('未标记')
    expect(last?.sessionIds).toEqual(['s2', 's3'])
  })

  it('sorts tag groups by current locale and omits empty groups', async () => {
    const { provider } = await setup([['s1', ['beta']], ['s2', ['alpha']], ['s3', ['Alpha']]], ['s1', 's2', 's3'], 'en')
    const snapshot = provider.getSnapshot()
    expect(snapshot.groups.map(g => g.label)).toEqual(['alpha', 'Alpha', 'beta'])
    // 无未标记会话：不产出空组。
    expect(snapshot.groups.some(g => g.id === UNTAGGED_GROUP_ID)).toBe(false)
  })

  it('emits no groups while controller is not ready (never fabricate)', () => {
    const remote = new StubRemote()
    remote.list = async () => { throw new Error('down') }
    const controller = createSessionTagsController({ remote })
    const provider = createSessionTagsProvider({
      controller,
      allSessionIds: () => ['s1'],
      onManageTags: () => {},
    })
    expect(provider.getSnapshot().groups).toEqual([])
  })

  it('exposes only tag text as safe search terms', async () => {
    const { provider } = await setup([['s1', ['工作', 'research']]], ['s1'])
    const terms = provider.getSnapshot().searchTermsBySession
    expect(terms?.s1).toEqual(['research', '工作'])
    // 只含标签文本：不泄漏 version/updatedAt/storage 身份。
    const flat = JSON.stringify(terms)
    expect(flat).not.toContain('v-s1')
    expect(flat).not.toContain('createdAt')
  })

  it('keeps snapshot reference stable until material changes', async () => {
    const ctx = await setup([['s1', ['a']]], ['s1', 's2'])
    const first = ctx.provider.getSnapshot()
    // 相同材料重读：不换快照、revision 不变。
    await ctx.controller.refresh()
    expect(ctx.provider.getSnapshot()).toBe(first)
    ctx.setAnswer([['s1', ['a', 'b']]])
    await ctx.controller.refresh()
    const second = ctx.provider.getSnapshot()
    expect(second).not.toBe(first)
    expect((second.revision as number)).toBe((first.revision as number) + 1)
    expect(second.groups.map(g => g.label)).toEqual(['a', 'b', '未标记'])
  })

  it('tag mutation does not reorder untagged membership or promote recency hints', async () => {
    const ctx = await setup([['s1', ['keep']]], ['s1', 's2', 's3'])
    const before = ctx.provider.getSnapshot().groups.find(g => g.id === UNTAGGED_GROUP_ID)?.sessionIds
    ctx.setAnswer([['s1', ['keep']], ['s2', ['new']]])
    return ctx.controller.refresh().then(() => {
      const snapshot = ctx.provider.getSnapshot()
      const after = snapshot.groups.find(g => g.id === UNTAGGED_GROUP_ID)?.sessionIds
      // s2 离开未标记组，但 s3 的相对顺序不变（不按写入时间重排）。
      expect(after).toEqual(['s3'])
      expect(before).toEqual(['s2', 's3'])
      // 快照不携带任何时间序/排序提示字段。
      expect(Object.keys(snapshot.groups[0] ?? {})).toEqual(['id', 'label', 'sessionIds'])
    })
  })

  it('notifies subscribers when the projection changes', async () => {
    const ctx = await setup([['s1', ['a']]], ['s1'])
    let notified = 0
    ctx.provider.subscribe(() => { notified += 1 })
    ctx.setAnswer([['s1', ['a', 'b']]])
    return ctx.controller.refresh().then(() => {
      // ready 态重读不闪空：材料变化恰好一次通知。
      expect(notified).toBe(1)
      expect(ctx.provider.getSnapshot().groups.map(g => g.label)).toEqual(['a', 'b'])
      expect(SESSION_TAGS_PROVIDER_ID).toBe('yeisme.session-tags')
    })
  })
})
