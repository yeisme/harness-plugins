import { describe, expect, it, vi } from 'vitest'
import { createSessionTagsController } from '../src/client/controller.ts'
import { createTagEditorController } from '../src/client/editor.ts'
import type { SessionTagsListAnswerV1, SessionTagsRemoteFace, SessionTagsSetAnswerV1, SessionTagsSetInputV1 } from '../src/client/wire.ts'

class ScriptedRemote implements SessionTagsRemoteFace {
  public setCalls: SessionTagsSetInputV1[] = []
  public nextSet: SessionTagsSetAnswerV1 = { ok: true, sessionId: 's1', tags: [], row: null }
  public listAnswer: SessionTagsListAnswerV1 = { ok: true, specVersion: '1.0', entries: [] }

  async list(): Promise<SessionTagsListAnswerV1> { return this.listAnswer }
  async set(input: SessionTagsSetInputV1): Promise<SessionTagsSetAnswerV1> {
    this.setCalls.push(input)
    return this.nextSet
  }
}

async function setup(entries: Array<[string, string[]]> = []) {
  const remote = new ScriptedRemote()
  remote.listAnswer = {
    ok: true,
    specVersion: '1.0',
    entries: entries.map(([sessionId, tags]) => ({
      sessionId,
      row: { session: { createdAt: '2026-01-01T00:00:00.000Z' }, tags, version: `v-${sessionId}`, updatedAt: 5 },
    })),
  }
  const controller = createSessionTagsController({ remote })
  await controller.refresh()
  const editor = createTagEditorController({ remote, controller })
  return { remote, controller, editor }
}

describe('tag editor state machine', () => {
  it('seeds draft and observed version from the authoritative row', async () => {
    const { editor } = await setup([['s1', ['a', 'b']]])
    editor.open('s1')
    expect(editor.getSnapshot()).toMatchObject({ open: true, sessionId: 's1', draft: ['a', 'b'], phase: 'editing' })
  })

  it('supports toggling, free input add, and duplicate folding', async () => {
    const { editor } = await setup([['s1', ['a']]])
    editor.open('s1')
    editor.toggleTag('a')
    expect(editor.getSnapshot().draft).toEqual([])
    editor.setInput('  New Tag ')
    editor.addFreeInput()
    expect(editor.getSnapshot().draft).toEqual(['New Tag'])
    expect(editor.getSnapshot().input).toBe('')
    editor.setInput('new tag')
    editor.addFreeInput()
    // 大小写区分：`new tag` 与 `New Tag` 是两个不同标签，均加入。
    expect(editor.getSnapshot().draft).toEqual(['New Tag', 'new tag'])
    editor.setInput('new tag ')
    editor.addFreeInput()
    // 规范化后重复：折叠，不新增。
    expect(editor.getSnapshot().draft).toEqual(['New Tag', 'new tag'])
  })

  it('save sends the full target tags plus the observed version', async () => {
    const { editor, remote } = await setup([['s1', ['a']]])
    editor.open('s1')
    editor.toggleTag('b')
    await editor.save()
    expect(remote.setCalls).toEqual([{ sessionId: 's1', tags: ['a', 'b'], ifVersion: 'v-s1' }])
    expect(editor.getSnapshot().open).toBe(false)
  })

  it('cancel performs zero writes and closes', async () => {
    const { editor, remote } = await setup([['s1', ['a']]])
    editor.open('s1')
    editor.toggleTag('z')
    editor.cancel()
    expect(remote.setCalls).toEqual([])
    expect(editor.getSnapshot().open).toBe(false)
  })

  it('clearing all tags saves an empty target and deletes the row', async () => {
    const { editor, remote } = await setup([['s1', ['a']]])
    editor.open('s1')
    editor.toggleTag('a')
    remote.nextSet = { ok: true, sessionId: 's1', tags: [], row: null }
    await editor.save()
    expect(remote.setCalls[0]).toMatchObject({ tags: [], ifVersion: 'v-s1' })
  })

  it('shows authoritative tags on version conflict without overwriting the draft', async () => {
    const { editor, remote } = await setup([['s1', ['a']]])
    editor.open('s1')
    editor.toggleTag('b')
    remote.nextSet = {
      ok: false,
      code: 'version-conflict',
      message: 'conflict',
      row: { session: { createdAt: '2026-01-01T00:00:00.000Z' }, tags: ['x'], version: 'v2', updatedAt: 9 },
    }
    await editor.save()
    const state = editor.getSnapshot()
    expect(state.phase).toBe('conflict')
    expect(state.authoritative).toEqual(['x'])
    expect(state.draft).toEqual(['a', 'b']) // 不静默覆盖
    // 显式再次保存：使用冲突应答带来的新观察版本。
    remote.nextSet = { ok: true, sessionId: 's1', tags: ['a', 'b'], row: null }
    await editor.save()
    expect(remote.setCalls[1]?.ifVersion).toBe('v2')
  })

  it('maps tags-invalid and infrastructure failures to error state', async () => {
    const { editor, remote } = await setup([['s1', ['a']]])
    editor.open('s1')
    remote.nextSet = { ok: false, code: 'tags-invalid', message: 'bad', reasons: ['too-many'] }
    await editor.save()
    expect(editor.getSnapshot()).toMatchObject({ phase: 'error', reasons: ['too-many'] })
    remote.nextSet = { ok: false, code: 'storage-unavailable', message: 'offline' }
    await editor.save()
    expect(editor.getSnapshot()).toMatchObject({ phase: 'error', message: 'offline' })
    remote.nextSet = { ok: false, code: 'session-not-found', message: 'gone' }
    await editor.save()
    expect(editor.getSnapshot()).toMatchObject({ phase: 'error', message: 'gone' })
  })

  it('blocks edits while saving and refuses reopen during save', async () => {
    const { editor, remote } = await setup([['s1', ['a']]])
    editor.open('s1')
    let release!: (value: SessionTagsSetAnswerV1) => void
    remote.set = vi.fn(async () => new Promise<SessionTagsSetAnswerV1>(resolve => { release = resolve }))
    const saving = editor.save()
    expect(editor.getSnapshot().phase).toBe('saving')
    editor.toggleTag('b')
    editor.setInput('x')
    editor.open('s2')
    expect(editor.getSnapshot().draft).toEqual(['a'])
    release({ ok: true, sessionId: 's1', tags: ['a'], row: null })
    await saving
    expect(editor.getSnapshot().open).toBe(false)
  })

  it('derives suggestions from current rows across sessions', async () => {
    const remote = new ScriptedRemote()
    remote.listAnswer = {
      ok: true,
      specVersion: '1.0',
      entries: [
        { sessionId: 's1', row: { session: { createdAt: 'x' }, tags: ['工作', 'a'], version: 'v1', updatedAt: 1 } },
        { sessionId: 's2', row: { session: { createdAt: 'x' }, tags: ['a', 'research'], version: 'v2', updatedAt: 2 } },
      ],
    }
    const controller = createSessionTagsController({ remote })
    await controller.refresh()
    const editor = createTagEditorController({ remote, controller })
    expect(new Set(editor.suggestions())).toEqual(new Set(['工作', 'a', 'research']))
  })

  it('opening without a row observes version null (first-write CAS)', async () => {
    const { editor, remote } = await setup([])
    editor.open('fresh')
    expect(editor.getSnapshot().draft).toEqual([])
    editor.setInput('first')
    editor.addFreeInput()
    await editor.save()
    expect(remote.setCalls[0]).toMatchObject({ sessionId: 'fresh', tags: ['first'], ifVersion: null })
  })
})
