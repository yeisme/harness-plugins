import { describe, expect, it, vi } from 'vitest'
import { sessionCatalogRemote } from '../src/client/session-catalog.ts'

describe('session catalog owner boundaries', () => {
  it('queries explicit session tools and skills, exposes no switches or private metadata', async () => {
    const tools = vi.fn(async () => ({ ok: true, value: { tools: [{ name: 'read', description: 'Read a file', arguments: { secret: 'not-public' } }] } }))
    const skills = vi.fn(async () => ({ ok: true, value: { catalogComplete: true, skills: [{ name: 'review', description: 'Review changes', modelInvocable: false }] } }))
    const ctx = { get: (key: string) => key === 'remote' ? { referenceTools: { list: tools }, skills: { list: skills } } : undefined }
    const port = sessionCatalogRemote(ctx as never, 'session-a')
    const result = await port.list()
    expect(result).toMatchObject({ ok: true, complete: true, items: [{ name: 'read', canToggle: false }, { name: 'review', enabled: false, canToggle: false }] })
    expect(tools).toHaveBeenCalledWith({ sessionId: 'session-a' }, expect.any(AbortSignal))
    expect(skills).toHaveBeenCalledWith({ sessionId: 'session-a', includeModelInvocable: true }, expect.any(AbortSignal))
    expect(JSON.stringify(result)).not.toContain('not-public')
    expect(await port.setEnabled({ id: 'tool:read', enabled: false, ifGeneration: 1 })).toMatchObject({ ok: false, code: 'toggle-unsupported' })
  })
  it('retains one source as partial and distinguishes missing from empty', async () => {
    const ctx = { get: (key: string) => key === 'remote' ? { referenceTools: { list: async () => ({ ok: true, value: { tools: [] } }) } } : undefined }
    expect(await sessionCatalogRemote(ctx as never, 'a').list()).toMatchObject({ ok: true, complete: false, toolsAvailable: true, skillsAvailable: false, items: [] })
    await expect(sessionCatalogRemote({ get: () => undefined } as never, 'b').list()).rejects.toThrow('catalog_unavailable')
  })
  it('keeps maintained and safe owner purpose metadata searchable in the session catalog', async () => {
    const ctx = { get: (key: string) => key === 'remote' ? {
      referenceTools: { list: async () => ({ ok: true, value: { tools: [{ name: 'read', description: 'Read' }, { name: 'owner_tool', description: 'Owner', purposeZh: '查询发布状态', category: 'operations', searchTerms: ['发布', '状态'] }] } }) },
      skills: { list: async () => ({ ok: true, value: { catalogComplete: true, skills: [] } }) },
    } : undefined }
    const result = await sessionCatalogRemote(ctx as never, 'a').list()
    if (!result.ok) throw new Error('expected catalog')
    expect(result.items.find(item => item.name === 'read')?.purpose).toMatchObject({ zh: '读取文本文件内容', category: 'files' })
    expect(result.items.find(item => item.name === 'owner_tool')?.purpose).toEqual({ zh: '查询发布状态', category: 'operations', searchTerms: ['发布', '状态'] })
  })
})
