import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { apply, name } from '../src/index.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
  name: string
  dsh: { bundle: { patch: string }; client: { platform: string; inject: string[] } }
  dependencies: Record<string, string>
}

describe('dsh-interaction-space bundle contract', () => {
  it('exposes a valid no-op host plugin', () => {
    expect(name).toBe('dsh-interaction-space')
    expect(apply).toBeTypeOf('function')
  })

  it('declares one additive patch with a single bundle row', async () => {
    const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client.platform).toBe('web')
    expect(patch).toContain("name: '@yeisme/dsh-interaction-space'")
    expect(patch.match(/- insert:/g)).toHaveLength(1)
    expect(patch).toContain('- id: dsh-interaction-space')
    expect(patch).not.toMatch(/^(replace|delete|update):/m)
  })

  it('composes the client workspace package without copying implementations', () => {
    expect(manifest.dependencies['@yeisme/dsh-client-ui-interaction-space']).toBe('workspace:*')
    expect(manifest.dependencies['@yeisme/dsh-selection-host']).toBe('workspace:*')
    expect(Object.keys(manifest.dependencies).length).toBe(3)
  })

  it('documents the main-selection and owner-dispatch invariants', async () => {
    const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
    expect(patch).toContain('preview-before-mutate')
    expect(patch).toContain('sessions.open()/clear()')
    const readme = await readFile(join(root, 'README.md'), 'utf8')
    expect(readme).toContain('interaction.space')
  })
})
