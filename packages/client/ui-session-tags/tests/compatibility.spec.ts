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
    register: vi.fn(() => () => {}),
    inject: vi.fn((slot: string, setup: () => () => void) => {
      calls.slots.push(slot)
      return setup()
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
  it('does not register the provider, inject slots, or touch the DOM without ctx.sessionGroupings', async () => {
    const { ctx, calls, disconnect } = probeCtx(false)
    const result = await registerSessionTagsClient(ctx as never)
    expect(result).toMatchObject({ registered: false, reason: 'session-groupings-unavailable' })
    expect(ctx.slots.inject).not.toHaveBeenCalled()
    expect(calls.slots).toEqual([])
    expect(calls.effect).toBe(0)
    expect(document.body.innerHTML).toBe('')
    disconnect()
  })

  it('registers the provider and one shell.overlay seat when the seam exists', async () => {
    const { ctx, registry, disconnect } = probeCtx(true)
    const result = await registerSessionTagsClient(ctx as never)
    expect(result.registered).toBe(true)
    expect(registry?.register).toHaveBeenCalledTimes(1)
    expect(ctx.slots.inject).toHaveBeenCalledWith('shell.overlay', expect.any(Function))
    expect(ctx.slots.register).toHaveBeenCalledWith({
      name: 'shell.overlay',
      id: 'yeisme.session-tags.editor',
      order: 100,
      label: 'Manage tags',
    }, expect.any(Function))
    expect(document.body.innerHTML).toBe('') // 空闲 overlay 零渲染
    disconnect()
  })

  it('apply is probe-gated the same way (no dead buttons on old DSH)', async () => {
    const { ctx, disconnect } = probeCtx(false)
    expect(() => apply(ctx as never)).not.toThrow()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(ctx.slots.inject).not.toHaveBeenCalled()
    expect(name).toBe('client-ui-session-tags')
    // 静态 inject 只允许官方恒有服务：声明 seam 或 'effect' 会让 entry 永久 pending。
    expect(inject).toEqual(['slots', 'sessions', 'remote'])
    disconnect()
  })

  it('apply schedules dynamic late-binding when the seam is not present yet', async () => {
    const { ctx, calls, disconnect } = probeCtx(false)
    const dynamic: { services?: readonly string[] } = {}
    ;(ctx as { inject?: unknown }).inject = vi.fn((services: readonly string[], body: (sub: unknown) => unknown) => {
      dynamic.services = services
      // 模拟 seam 稍后到位：sub-ctx 携带可用 registry 立即触发注册。
      void body({ ...ctx, sessionGroupings: { register: vi.fn(() => () => {}) } })
      return undefined
    })
    expect(() => apply(ctx as never)).not.toThrow()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    // probe 失败当下零注册；晚绑定回调触发后经 sub-ctx 完成注册（overlay seat 注入一次）。
    expect(calls.slots).toEqual(['shell.overlay'])
    expect(dynamic.services).toEqual(['sessionGroupings'])
    disconnect()
  })

  it('apply does not schedule late-binding twice when the seam already exists', async () => {
    const { ctx, registry, disconnect } = probeCtx(true)
    const dynamicInject = vi.fn()
    ;(ctx as { inject?: unknown }).inject = dynamicInject
    apply(ctx as never)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(registry?.register).toHaveBeenCalledTimes(1)
    expect(dynamicInject).not.toHaveBeenCalled()
    disconnect()
  })

  it('throws no runtime crash when even the remote face is missing on old DSH', async () => {
    const { ctx, disconnect } = probeCtx(false)
    delete (ctx as Partial<typeof ctx>).remote
    await expect(registerSessionTagsClient(ctx as never)).resolves.toMatchObject({ registered: false })
    disconnect()
  })

  it('degrades honestly (no dead buttons) when the seam exists but the host remote is absent', async () => {
    const { ctx, calls, disconnect } = probeCtx(true)
    const stripped = { ...ctx, remote: {} }
    const result = await registerSessionTagsClient(stripped as never)
    // mutation 硬前置缺失 → 零注册（provider 无 set 通道只会制造死按钮）。
    expect(result).toMatchObject({ registered: false, reason: 'session-tags-remote-unavailable' })
    expect(calls.slots).toEqual([])
    disconnect()
  })

  it('self-mounts the sessionTags namespace via ctx.remote.$mount when not pre-mounted', async () => {
    const { ctx, registry, disconnect } = probeCtx(true)
    const wireAnswer = { ok: true as const, specVersion: '1.0' as const, entries: [] }
    const mounted: Record<string, unknown> = {}
    const remoteWithMount = {
      $mount: vi.fn(async (contribution: unknown) => {
        // 断言自挂 contribution 形状（package + 两个严格 descriptor）。
        const c = contribution as { package: string, descriptors: { method: string }[] }
        expect(c.package).toBe('@yeisme/dsh-session-tags-host')
        expect(c.descriptors.map(d => d.method)).toEqual(expect.arrayContaining(['list', 'set', 'snapshot', 'planBatch', 'executeBatch']))
        mounted['remote.sessionTags'] = {
          list: vi.fn(async () => ({ ok: true, value: wireAnswer })),
          set: vi.fn(async () => ({ ok: true, value: { ok: true, row: null } })),
        }
        mounted['remote.sessionOrganization'] = {
          snapshot: vi.fn(async () => ({ ok: true, value: { ok: true, specVersion: '1.0', functionTypes: [], assignments: [], tagCatalog: [], rules: [], recentBatches: [] } })),
          setAssignment: vi.fn(), putFunctionType: vi.fn(), putTagCatalog: vi.fn(), putRule: vi.fn(), classify: vi.fn(),
          planBatch: vi.fn(), unlockAdmin: vi.fn(), executeBatch: vi.fn(), undoBatch: vi.fn(),
        }
        return async () => {}
      }),
    }
    const ctxWithMount = {
      ...ctx,
      remote: remoteWithMount,
      get: (key: string) => {
        if (key === 'remote') return remoteWithMount
        if (key === 'sessionGroupings') return ctx.sessionGroupings
        return mounted[key]
      },
    }
    const result = await registerSessionTagsClient(ctxWithMount as never)
    expect(result.registered).toBe(true)
    expect(remoteWithMount.$mount).toHaveBeenCalledTimes(1)
    expect(registry?.register).toHaveBeenCalledTimes(1)
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
