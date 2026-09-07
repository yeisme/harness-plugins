import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const clientPath = resolve(process.cwd(), 'lib/client.js')
const requireUI = createRequire(resolve(process.cwd(), '../../client/ui-browser-pane/package.json'))

// Like the rich-media bundle gate, run against actual built bytes when present.
// A skipped test is not evidence of a successful build or Host browser boot.
describe.skipIf(!existsSync(clientPath))('Browser Pane built ModuleLoader factory', () => {
  it('imports the Host installer in plain Node without loading browser styles', () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "const m = await import('./lib/index.js'); if (m.name !== 'dsh-browser-pane') throw new Error('invalid Host entry')"], { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000 })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
  it('uses only the shared platform modules and materializes its client entry', () => {
    let registration: { id: string; factory: (require: (name: string) => unknown) => Record<string, unknown> } | undefined
    const code = readFileSync(clientPath, 'utf8')
    expect(code).not.toContain('process.env.NODE_ENV')
    vm.runInNewContext(code, { window: { __ModuleLoader__: { load: (value: typeof registration) => { registration = value } } } })
    expect(registration?.id).toBe('@yeisme/dsh-browser-pane')
    const required = new Set<string>()
    const exports = registration!.factory(name => {
      required.add(name)
      if (name === '@deepseek-ai/dsh-client-ui-primitives') return {}
      if (['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'].includes(name)) return requireUI(name)
      throw new Error(`Unexpected ModuleLoader dependency: ${name}`)
    })
    expect(exports.apply).toBeTypeOf('function')
    expect([...required].sort()).toEqual(['@deepseek-ai/dsh-client-ui-primitives', 'react', 'react/jsx-runtime'])
  })
})
