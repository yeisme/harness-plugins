/**
 * Bundle smoke test for @yeisme/dsh-url-session.
 *
 * 通过源码相对 import 断言 §3 client 插件面（不在 loader 外执行 banner）；
 * built `lib/client.js` 以字符串断言：ModuleLoader banner 在位、@yeisme/*
 * 已内联、react 作为宿主运行时外部依赖出现（ModuleLoader require 提供，
 * 先例 mcp-inspector clientExternals）。
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { apply, inject, name, SessionUrlSyncController } from '../src/client/index.ts'

describe('dsh-url-session bundle entry', () => {
  it('re-exports the §3 client plugin face from source', () => {
    expect(apply).toBeTypeOf('function')
    expect(typeof SessionUrlSyncController).toBe('function')
    expect(inject).toEqual(['slots'])
    expect(name).toContain('dsh-url-session')
  })

  it('ships a ModuleLoader banner with @yeisme/* inlined and runtime externals only', () => {
    const built = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    expect(built).toContain('__ModuleLoader__.load')
    expect(built).toContain('dsh-url-session')
    expect(built).not.toMatch(/require\(["']@yeisme\//u)
    // react 由宿主 ModuleLoader 提供（不内联；官方 primitives 同理，见 tsdown neverBundle）。
    expect(built).toMatch(/require\(["']react["']\)|require\(["']react\/jsx-runtime["']\)/u)
  })
})
