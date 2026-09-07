import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import { expect, it } from 'vitest'

it('materializes the real browser artifact without importing the runtime client subpath', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  const require = createRequire(import.meta.url)
  const requests: string[] = []
  let registered = false
  runInNewContext(source, {
    window: { navigator: { language: 'en-US' }, __ModuleLoader__: { load(entry: { id: string; factory: (resolve: (name: string) => unknown) => unknown }) {
      expect(entry.id).toBe('@yeisme/dsh-creator-studio')
      registered = true
      const exports = entry.factory(name => {
        requests.push(name)
        if (name === '@deepseek-ai/dsh-client-runtime/client') throw new Error(`Unavailable browser module: ${name}`)
        if (name.startsWith('@deepseek-ai/')) return {}
        // React DOM belongs to the shared UI/Host platform, not this installer.
        if (name === 'react-dom' || name === 'react-dom/client') {
          return createRequire(new URL('../../../client/ui-creator-studio/package.json', import.meta.url))(name)
        }
        return require(name)
      })
      expect(exports).toEqual(expect.objectContaining({ apply: expect.any(Function) }))
    } } },
    console, TextEncoder, TextDecoder, URL, setTimeout, clearTimeout,
  })
  expect(registered).toBe(true)
  expect(requests).not.toContain('@deepseek-ai/dsh-client-runtime/client')
})
