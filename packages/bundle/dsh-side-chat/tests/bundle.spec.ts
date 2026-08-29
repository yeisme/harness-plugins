import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { name, inject, apply } from '../src/index.ts'

describe('dsh-side-chat bundle', () => {
  it('exposes a no-op host face (pure client bundle)', () => {
    expect(name).toBe('dsh-side-chat')
    expect(inject).toEqual([])
    expect(() => apply(undefined as never)).not.toThrow()
  })

  it('declares a single-row cordis patch insert', async () => {
    const patch = await readFile(resolve(__dirname, '../cordis.patch.yml'), 'utf8')
    expect(patch).toContain("name: '@yeisme/dsh-side-chat'")
    expect(patch.match(/- insert:/g)).toHaveLength(1)
  })

  it('client entry re-exports the pane-side-chat client face', async () => {
    // 经 banner-free root 入口读取（../src/client 会拉起 ModuleLoader 包装的
    // lib/client.js，其只在 loader 内执行）。
    const client = await import('../../client/ui-pane-side-chat/src/index.ts')
    expect(typeof client.SideChatController).toBe('function')
    const built = await readFile(resolve(__dirname, '../lib/client.js'), 'utf8').catch(() => '')
    if (built.length > 0) {
      expect(built.startsWith('window.__ModuleLoader__.load({')).toBe(true)
      expect(built).toContain('"@yeisme/dsh-side-chat"')
    }
  })
})
