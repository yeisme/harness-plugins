// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { apply, inject, name, registerSessionTagsClient } from '../src/client/index.ts'
import type { SessionTagsRemoteFace } from '../src/client/wire.ts'

afterEach(cleanup)

const remote: SessionTagsRemoteFace = {
  async list() { return { ok: true, specVersion: '1.0', entries: [] } },
  async set() { throw new Error('unused') },
}

/** 记录 ctx 面上被触碰的一切（probe 失败时必须零触碰）。 */
function probeCtx(withSeam: boolean, entries: string[] = []) {
  const calls: { provide: string[]; effect: number; slots: string[]; domMutations: number } = {
    provide: [],
    effect: 0,
    slots: [],
    domMutations: 0,
  }
  const registry = withSeam
    ? { register: vi.fn(() => () => {}) }
    : undefined
  const slots = {
    inject: vi.fn((slot: string) => {
      calls.slots.push(slot)
      return () => {}
    }),
  }
  const observer = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(mutations => { calls.domMutations += mutations.length })
    : undefined
  observer?.observe(document.body, { childList: true, subtree: true })
  const ctx = {
    sessionGroupings: registry,
    slots,
    effect: vi.fn(() => () => {}),
    provide: vi.fn((key: string) => { calls.provide.push(key); return () => {} }),
    remote: { sessionTags: remote },
    sessions: { snapshot: () => ({ ids: [] }) },
  }
  return { ctx, calls, registry, disconnect: () => observer?.disconnect() }
}

describe('capability probe (old-DSH compatibility)', () => {
  it('does not register the provider, inject slots, or touch the DOM without ctx.sessionGroupings', () => {
    const { ctx, calls, disconnect } = probeCtx(false)
    const result = registerSessionTagsClient(ctx as never)
    expect(result).toMatchObject({ registered: false, reason: 'session-groupings-unavailable' })
    expect(ctx.slots.inject).not.toHaveBeenCalled()
    expect(calls.slots).toEqual([])
    expect(calls.effect).toBe(0)
    expect(document.body.innerHTML).toBe('')
    disconnect()
  })

  it('registers the provider and one shell.overlay seat when the seam exists', () => {
    const { ctx, registry, disconnect } = probeCtx(true)
    const result = registerSessionTagsClient(ctx as never)
    expect(result.registered).toBe(true)
    expect(registry?.register).toHaveBeenCalledTimes(1)
    expect(ctx.slots.inject).toHaveBeenCalledWith('shell.overlay', expect.any(Function))
    expect(document.body.innerHTML).toBe('') // 空闲 overlay 零渲染
    disconnect()
  })

  it('apply is probe-gated the same way (no dead buttons on old DSH)', () => {
    const { ctx, disconnect } = probeCtx(false)
    expect(() => apply(ctx as never)).not.toThrow()
    expect(ctx.slots.inject).not.toHaveBeenCalled()
    expect(name).toBe('client-ui-session-tags')
    expect(inject).toEqual(['slots'])
    disconnect()
  })

  it('throws no runtime crash when even the remote face is missing on old DSH', () => {
    const { ctx, disconnect } = probeCtx(false)
    delete (ctx as Partial<typeof ctx>).remote
    expect(() => registerSessionTagsClient(ctx as never)).not.toThrow()
    disconnect()
  })

  it('refuses to register when the seam exists but the host remote is absent', () => {
    const { ctx, disconnect } = probeCtx(true)
    const stripped = { ...ctx, remote: {} }
    expect(() => registerSessionTagsClient(stripped as never)).toThrow(/sessionTags remote/)
    disconnect()
  })
})

describe('built-in grouping compatibility boundary (task 1.3)', () => {
  it('keeps the DSH built-in group values as the frozen compat boundary', async () => {
    // 上游内建值集合：外部 provider 不得 shadow 或复用。
    const { BUILTIN_SESSION_GROUP_BY } = await import('../src/client/compat.ts')
    expect(BUILTIN_SESSION_GROUP_BY).toEqual(['workspace', 'flat'])
    // 外部选择键与内建值域可区分（provider: 前缀）。
    expect(BUILTIN_SESSION_GROUP_BY).not.toContain('yeisme.session-tags')
    expect(BUILTIN_SESSION_GROUP_BY).not.toContain(expect.stringMatching(/^provider:/) as never)
  })

  it('the published ui-workspace client surface is unchanged and seam-less', async () => {
    // 对已发布 @deepseek-ai/dsh-client-ui-workspace 的公开面 pin（文件级，
    // 不执行其浏览器形态产物）：/client 导出 apply/inject 原形保持，
    // 且尚无 sessionGroupings 公开导出（seam 未发布 → bundle 必须 probe 降级）。
    const { readFile } = await import('node:fs/promises')
    const { createRequire } = await import('node:module')
    const require = createRequire(import.meta.url)
    const pkgPath = require.resolve('@deepseek-ai/dsh-client-ui-workspace/package.json')
    const manifest = JSON.parse(await readFile(pkgPath, 'utf8')) as {
      version: string
      exports: Record<string, unknown>
    }
    expect(manifest.version).toMatch(/^0\.1\./)
    expect(manifest.exports['./client']).toBeDefined()
    const { dirname, join } = await import('node:path')
    const clientTypesEntry = (manifest.exports['./client'] as { types: string }).types
    const clientTypesPath = join(dirname(pkgPath), clientTypesEntry)
    const dts = await readFile(clientTypesPath, 'utf8')
    expect(dts).toContain('export declare const inject: string[]')
    expect(dts).toContain('export declare function apply')
    expect(dts).not.toContain('sessionGroupings')
  })
})
