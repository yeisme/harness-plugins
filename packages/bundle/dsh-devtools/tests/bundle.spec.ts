import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('@yeisme/dsh-devtools bundle', () => {
  it('declares one installable patch row and the public client face', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { dsh: { bundle: { patch: string }; client: { platform: string } } }
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(pkg.dsh.client.platform).toBe('web')
    expect(patch).toContain("name: '@yeisme/dsh-devtools'")
    expect((patch.match(/- id: dsh-devtools/g) ?? [])).toHaveLength(1)
  })
})
