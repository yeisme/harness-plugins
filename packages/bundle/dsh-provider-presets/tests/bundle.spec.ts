import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)

const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
  name: string
  dsh: { bundle: { patch: string }; client: { platform: string } }
  peerDependencies: Record<string, string>
  peerDependenciesMeta: Record<string, { optional?: boolean }>
  dependencies: Record<string, string>
  scripts: Record<string, string>
}

describe('dsh-provider-presets bundle contract', () => {
  it('declares one additive patch with a single bundle row and no replacements', async () => {
    const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client.platform).toBe('web')
    // 单 web 行：根 face 是空 host apply，./client face 由 dsh.client 声明挂载。
    expect(patch).toContain("name: '@yeisme/dsh-provider-presets'")
    expect((patch.match(/^ {2}- id:/gm) ?? []).length).toBe(1)
    expect(patch).not.toMatch(/^(replace|delete|update):/m)
  })

  it('composes the Client workspace row without copying implementations', () => {
    expect(manifest.dependencies['@yeisme/dsh-client-ui-provider-presets']).toBe('workspace:*')
    // bundle 自身不携带第二份实现：运行时依赖只有一个 client workspace 行。
    expect(Object.keys(manifest.dependencies)).toEqual(['@yeisme/dsh-client-ui-provider-presets'])
  })

  it('anchors the runtime peer range and documents old-version incompatibility', async () => {
    // 锚点：首个包含 settings.models.footer slot 与 remote.settings/credentials/llm
    // 子命名空间的 DSH 发布版（0.1.2-rc.1）。
    expect(manifest.peerDependencies['@deepseek-ai/cordis']).toBe('^4.0.1')
    expect(manifest.peerDependencies['@deepseek-ai/dsh-client-runtime']).toBe('0.1.0-rc.6')
    expect(manifest.peerDependenciesMeta['@deepseek-ai/dsh-client-runtime']?.optional).toBe(true)
    const readme = await readFile(join(root, 'README.md'), 'utf8')
    expect(readme).toContain('INCOMPATIBLE')
  })

  it('client face is ModuleLoader-shaped with only always-present static inject', async () => {
    const face = await loadClientFace()
    expect(face.name).toBe('client-ui-provider-presets')
    expect(typeof face.apply).toBe('function')
    // 静态 inject 只含官方恒有服务：remote.* 经 ctx.get 探针（guard facade
    // 拒绝未声明 inject 的属性访问），声明它们会让 rc.6 web entry 永久 pending。
    expect(face.inject).toEqual(['locale'])
  })

  it('ships the preset catalog contract through the bundle client face', async () => {
    const face = await loadClientFace() as unknown as {
      PROVIDER_PRESETS: ReadonlyArray<{ readonly id: string }>
      presetCatalogViolations(list: unknown): readonly string[]
    }
    expect(face.PROVIDER_PRESETS.length).toBeGreaterThanOrEqual(10)
    expect(face.presetCatalogViolations(face.PROVIDER_PRESETS)).toEqual([])
    expect(face.PROVIDER_PRESETS.some(preset => preset.id === 'custom-openai')).toBe(true)
  })

  it('ships an executable integration runner with the required evidence contract', async () => {
    const runner = join(root, 'scripts/run-web-profile-integration.mjs')
    const syntax = spawnSync(process.execPath, ['--check', runner], { encoding: 'utf8' })
    expect(syntax.status, syntax.stderr).toBe(0)
    expect(manifest.scripts['test:integration']).toBe('node scripts/run-web-profile-integration.mjs')

    const source = await readFile(runner, 'utf8')
    expect(source).toContain("schema_version: 'yeisme.integration_test_evidence.v1'")
    expect(source).toContain("project: 'agent/harness-plugins'")
    expect(source).toContain("layer: 'browser-e2e'")
    for (const file of ['summary.json', 'command.txt', 'stdout.log', 'stderr.log', 'env.json']) {
      expect(source).toContain(file)
    }
    expect(source).toContain("artifacts: relative(projectRoot, artifactsRoot)")
    expect(source).toContain("policy: 'yeisme.integration-test-redaction.v1'")
  })
})

/** 在 node 里执行 bundle 的 ModuleLoader 形态产物，取回其 exports。 */
let clientFaceCache: Record<string, unknown> | undefined

async function loadClientFace(): Promise<Record<string, unknown>> {
  if (clientFaceCache !== undefined) return clientFaceCache
  const { pathToFileURL } = await import('node:url')
  const clientPath = require.resolve('@yeisme/dsh-provider-presets/client')
  let captured: Record<string, unknown> | undefined
  const previousWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = {
    __ModuleLoader__: {
      load(definition: { factory: (require: (name: string) => unknown) => unknown }) {
        const stubRequire = (name: string): unknown => {
          if (name === 'react') return { useCallback: () => () => {}, useMemo: () => [], useState: () => [undefined, () => {}], useSyncExternalStore: () => ({}) }
          if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' }
          return {}
        }
        captured = definition.factory(stubRequire) as Record<string, unknown>
      },
    },
  }
  try {
    await import(pathToFileURL(clientPath).href)
  } finally {
    ;(globalThis as { window?: unknown }).window = previousWindow
  }
  if (captured === undefined) throw new Error('ModuleLoader factory did not run')
  clientFaceCache = captured
  return captured
}
