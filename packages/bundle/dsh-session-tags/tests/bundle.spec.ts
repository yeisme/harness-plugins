import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
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

describe('dsh-session-tags bundle contract', () => {
  it('declares one additive patch with a single bundle row and no replacements', async () => {
    const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client.platform).toBe('web')
    // 单 bundle 行：根 face 即 Host 插件（re-export），./client face 由 dsh.client 声明挂载。
    // host+bundle 双行会重复 apply 同一插件（storage-domain 'already open'，5.2 集成证据复现）。
    expect(patch).toContain("name: '@yeisme/dsh-session-tags'")
    expect(patch).not.toContain("name: '@yeisme/dsh-session-tags-host'")
    expect((patch.match(/^ {2}- id:/gm) ?? []).length).toBe(1)
    expect(patch).not.toMatch(/^(replace|delete|update):/m)
  })

  it('composes the Host and Client workspace rows without copying implementations', () => {
    expect(manifest.dependencies['@yeisme/dsh-session-tags-host']).toBe('workspace:*')
    expect(manifest.dependencies['@yeisme/dsh-client-ui-session-tags']).toBe('workspace:*')
    // bundle 自身不携带第二份 zod/存储实现：运行时依赖只有两个 workspace 行。
    expect(Object.keys(manifest.dependencies)).toEqual([
      '@yeisme/dsh-client-ui-session-tags',
      '@yeisme/dsh-session-tags-host',
    ])
  })

  it('anchors the seam peer range and documents old-version incompatibility', async () => {
    // 锚点：首个包含 ctx.sessionGroupings 的 DSH 版本（尚未发布）。
    expect(manifest.peerDependencies['@deepseek-ai/dsh-client-ui-workspace']).toBe('>=0.1.0-next.0')
    expect(manifest.peerDependencies['@deepseek-ai/cordis']).toBe('^4.0.1')
    // seam 未发布：peer 声明为 optional（安装不阻塞），缺 seam 时 probe 降级。
    expect(manifest.peerDependenciesMeta['@deepseek-ai/dsh-client-ui-workspace']?.optional).toBe(true)
    const readme = await readFile(join(root, 'README.md'), 'utf8')
    expect(readme).toContain('INCOMPATIBLE')
  })

  it('keeps the host package independently loadable (no client-only imports)', async () => {
    const host = await import('@yeisme/dsh-session-tags-host')
    expect(host.SESSION_TAGS_DOMAIN).toBe('yeisme_session_tags_v1')
    expect(host.SESSION_ORGANIZATION_DOMAIN).toBe('yeisme_session_organization_v1')
    expect(host.name).toBe('dsh-session-tags-host')
    expect(typeof host.apply).toBe('function')
    // Client 包 node face 可独立加载；client face 是 ModuleLoader 形态
    //（浏览器单文件），用 window stub 执行 factory 验证其导出形状。
    const clientNode = await import('@yeisme/dsh-client-ui-session-tags')
    expect(clientNode.name).toBe('client-ui-session-tags')
    const clientFace = await loadClientFace()
    expect(typeof clientFace.apply).toBe('function')
    // 静态 inject 只含官方恒有服务：声明 seam/'effect' 会让 web entry 永久 pending。
    expect(clientFace.inject).toEqual(['slots', 'sessions', 'remote'])
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

/** 在 node 里执行 client 包的 ModuleLoader 形态产物，取回其 exports。 */
let clientFaceCache: Record<string, unknown> | undefined

async function loadClientFace(): Promise<Record<string, unknown>> {
  if (clientFaceCache !== undefined) return clientFaceCache
  const { pathToFileURL } = await import('node:url')
  const clientPath = require.resolve('@yeisme/dsh-client-ui-session-tags/client')
  let captured: Record<string, unknown> | undefined
  const previousWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = {
    __ModuleLoader__: {
      load(definition: { factory: (require: (name: string) => unknown) => unknown }) {
        const stubRequire = (name: string): unknown => {
          if (name === 'react') return { useEffect: () => {}, useRef: () => ({ current: null }) }
          if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' }
          // The client face builds its overlay CSS from the visual kit at
          // module scope; the stub only needs the call to resolve.
          if (name === '@yeisme/dsh-client-ui-visual-kit') return { buildPanelStyles: () => '' }
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

describe('host/client wire mirror sync', () => {
  const corpus: string[][] = [
    [],
    ['a'],
    ['  a  ', 'a', 'A'],
    ['工作', '研究', '工作 '],
    [''],
    ['　'],
    [String.fromCharCode(1)],
    ['a'.repeat(64), 'a'.repeat(65)],
    ['ﬁx', 'Ç'],
    Array.from({ length: 13 }, (_, i) => `t${i}`),
  ]

  it('normalizes identically on both sides over the corpus', async () => {
    const host = await import('@yeisme/dsh-session-tags-host')
    const client = (await loadClientFace()) as unknown as {
      normalizeTags(input: string[]): { ok: boolean }
    }
    for (const input of corpus) {
      expect(client.normalizeTags(input)).toEqual(host.normalizeTags(input))
    }
  })

  it('exposes the same failure-code set on both sides', async () => {
    const host = await import('@yeisme/dsh-session-tags-host')
    const client = (await loadClientFace()) as unknown as {
      SESSION_TAGS_FAILURE_CODES: readonly string[]
    }
    expect([...client.SESSION_TAGS_FAILURE_CODES]).toEqual([...host.SESSION_TAGS_FAILURE_CODES])
  })

  it('keeps specVersion 1.0 on the host remote', async () => {
    const host = await import('@yeisme/dsh-session-tags-host')
    expect(host.SESSION_TAGS_SPEC_VERSION).toBe('1.0')
    expect(host.SESSION_TAGS_REMOTE_SERVICE_KEY).toBe('sessionTags')
    expect(host.SESSION_ORGANIZATION_SPEC_VERSION).toBe('1.0')
    expect(host.SESSION_ORGANIZATION_REMOTE_SERVICE_KEY).toBe('sessionOrganization')
  })
})

describe('seam release state', () => {
  it('still treats the published ui-workspace as seam-less (probe required)', async () => {
    const { readFile: read } = await import('node:fs/promises')
    const pkgPath = require.resolve('@deepseek-ai/dsh-client-ui-workspace/package.json')
    const published = JSON.parse(await read(pkgPath, 'utf8')) as { exports: Record<string, { types?: string }> }
    const typesEntry = published.exports['./client']?.types
    expect(typesEntry).toBeDefined()
    const dts = await read(join(dirname(pkgPath), typesEntry ?? ''), 'utf8')
    expect(dts).not.toContain('sessionGroupings')
  })
})
