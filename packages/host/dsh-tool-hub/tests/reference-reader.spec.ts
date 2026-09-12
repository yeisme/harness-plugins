import { describe, expect, it, vi } from 'vitest'
import { SkillReferenceReader, type SkillReferenceReadAnswerV1 } from '../src/reference-reader.ts'

const summary = { name: 'review', source: 'user-agents', provider: 'filesystem', resourceBase: { kind: 'directory', path: 'owner-package-root' } }
const request = { itemId: 'skill:review', source: 'user-agents', scope: 'profile' as const }
const signal = () => new AbortController().signal
const page = (result: SkillReferenceReadAnswerV1) => {
  if (!('content' in result)) throw new Error(`Expected content, received ${result.status}`)
  return result
}
function fixture(content = '# Review guide\n中文说明。') {
  const owner = { list: vi.fn(async () => [summary]), getDocument: vi.fn(async () => ({ ...summary, content, metadata: { privateInternal: 'never-project' } })) }
  return { owner, reader: new SkillReferenceReader(() => owner) }
}

describe('explicit Skill document reads', () => {
  it('reads through the owner and projects only bounded text and opaque versioned identity', async () => {
    const { reader, owner } = fixture()
    const result = page(await reader.readSkill(request, signal()))
    expect(result).toMatchObject({ status: 'ready', content: '# Review guide\n中文说明。', startLine: 1, continuedLine: false })
    expect(result.revision).toMatch(/^[a-f0-9]{64}$/)
    expect(result.resourceRef).toMatch(/^skill-document:[a-f0-9]{64}$/)
    expect(JSON.stringify(result)).not.toContain('owner-package-root')
    expect(JSON.stringify(result)).not.toContain('never-project')
    expect(owner.list).toHaveBeenCalledTimes(2)
    expect(owner.getDocument).toHaveBeenCalledTimes(1)
  })

  it('does not load runtime bodies or accept arbitrary paths, other sources or a session scope', async () => {
    const { reader, owner } = fixture()
    for (const input of [{ ...request, itemId: 'skill:../private' }, { ...request, scope: 'session' }, { ...request, source: 'project-dsh' }]) {
      expect(await reader.readSkill(input as typeof request, signal())).toMatchObject({ status: 'denied' })
    }
    owner.list.mockResolvedValue([{ ...summary, provider: 'runtime' }])
    expect(await reader.readSkill(request, signal())).toMatchObject({ status: 'denied' })
    expect(owner.getDocument).not.toHaveBeenCalled()
  })

  it('pages at the line bound without mixing revisions or documents', async () => {
    const { reader, owner } = fixture('line\n'.repeat(5001))
    const first = page(await reader.readSkill(request, signal()))
    expect(first).toMatchObject({ status: 'partial', content: 'line\n'.repeat(5000), startLine: 1 })
    const second = page(await reader.readSkill({ ...request, expectedRevision: first.revision, cursor: first.nextCursor }, signal()))
    expect(second).toMatchObject({ status: 'ready', content: 'line\n', startLine: 5001, continuedLine: false })
    owner.getDocument.mockResolvedValue({ ...summary, content: 'changed', metadata: { privateInternal: 'never-project' } })
    expect(await reader.readSkill({ ...request, cursor: first.nextCursor }, signal())).toMatchObject({ status: 'stale', reason: 'cursor_mismatch' })
    expect(await reader.readSkill({ ...request, expectedRevision: first.revision }, signal())).toMatchObject({ status: 'stale', reason: 'revision_changed' })
    const other = { ...summary, name: 'other' }
    owner.list.mockResolvedValue([other])
    owner.getDocument.mockResolvedValue({ ...other, content: 'line\n'.repeat(5001), metadata: { privateInternal: 'never-project' } })
    expect(await reader.readSkill({ ...request, itemId: 'skill:other', cursor: first.nextCursor }, signal())).toMatchObject({ status: 'stale', reason: 'cursor_mismatch' })
  })

  it('uses the UTF-8 byte bound without splitting a code point, including a continued long line', async () => {
    const content = '🐈'.repeat(70000)
    const { reader } = fixture(content)
    const first = page(await reader.readSkill(request, signal()))
    expect(Buffer.byteLength(first.content)).toBe(256 * 1024)
    expect(first.content.endsWith('🐈')).toBe(true)
    const second = page(await reader.readSkill({ ...request, cursor: first.nextCursor }, signal()))
    expect(second.continuedLine).toBe(true)
    expect(first.content + second.content).toBe(content)
  })

  it('withholds content when the source disappears during the read', async () => {
    const { reader, owner } = fixture()
    owner.list.mockResolvedValueOnce([summary]).mockResolvedValueOnce([])
    const result = await reader.readSkill(request, signal())
    expect(result).toEqual({ specVersion: '1.0', status: 'denied', reason: 'source_no_longer_visible' })
  })

  it('withholds a read from a replaced owner instance', async () => {
    const { owner } = fixture()
    let current: typeof owner | undefined = owner
    const reader = new SkillReferenceReader(() => current)
    owner.getDocument.mockImplementation(async () => { current = undefined; return { ...summary, content: 'old document', metadata: { privateInternal: 'never-project' } } })
    expect(await reader.readSkill(request, signal())).toEqual({ specVersion: '1.0', status: 'denied', reason: 'source_no_longer_visible' })
  })

  it('settles cancellation even when the owner read ignores the signal', async () => {
    const owner = { list: vi.fn(async () => [summary]), getDocument: vi.fn(() => new Promise<unknown>(() => {})) }
    const reader = new SkillReferenceReader(() => owner), abort = new AbortController()
    const result = reader.readSkill(request, abort.signal)
    await vi.waitFor(() => expect(owner.getDocument).toHaveBeenCalledTimes(1))
    abort.abort()
    expect(await result).toEqual({ specVersion: '1.0', status: 'disabled', reason: 'cancelled' })
  })

  it('does not copy owner errors or claim a missing reader is an empty document', async () => {
    expect(await new SkillReferenceReader(() => undefined).readSkill(request, signal())).toMatchObject({ status: 'disabled', reason: 'reader_unavailable' })
    const genericOwner = { list: async () => [summary], get: vi.fn() }
    expect(await new SkillReferenceReader(() => genericOwner).readSkill(request, signal())).toMatchObject({ status: 'disabled', reason: 'reader_unavailable' })
    expect(genericOwner.get).not.toHaveBeenCalled()
    const { reader, owner } = fixture()
    owner.getDocument.mockRejectedValue(new Error('private-owner-detail'))
    expect(await reader.readSkill(request, signal())).toEqual({ specVersion: '1.0', status: 'error', reason: 'owner_read_failed' })
    owner.getDocument.mockRejectedValue(Object.assign(new Error('private-owner-detail'), { code: 'FS_PERMISSION_DENIED' }))
    expect(await reader.readSkill(request, signal())).toEqual({ specVersion: '1.0', status: 'denied', reason: 'permission_denied' })
  })
})
