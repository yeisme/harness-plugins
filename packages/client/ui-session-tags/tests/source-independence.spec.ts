import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

const FORBIDDEN = [
  /from\s+['"]@deepseek-ai\/dsh-[^'"]*\/src\//,
  /querySelector|querySelectorAll/,
  /document\.createElement\(['"]style/,
  /localStorage|sessionStorage|indexedDB/,
  /from\s+['"][^'"]*better-sidebar/i,
  /ctx\.betterSidebar/,
  /postMessage|window\.open\(/,
]

async function collect(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter(e => e.isFile() && /\.(ts|tsx)$/.test(e.name) && !e.parentPath.includes('node_modules'))
    .map(e => join(e.parentPath, e.name))
}

describe('source independence', () => {
  it('ships no DSH private imports, DOM selectors, or storage bridges', async () => {
    const files = await collect(join(root, 'src'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const violations = FORBIDDEN.filter(pattern => pattern.test(content))
      expect(violations, relative(root, file)).toEqual([])
    }
  })

  it('declares only public published peers', async () => {
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      peerDependencies?: Record<string, string>
      dependencies?: Record<string, string>
    }
    // visual kit 是本仓自有的样式常量包（零运行时依赖），3.4 采纳为显式放行项；
    // DSH 私有源码依赖仍然禁止。
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(['@yeisme/dsh-client-ui-visual-kit'])
    for (const name of Object.keys(manifest.peerDependencies ?? {})) {
      expect(name === '@deepseek-ai/cordis'
        || name === '@deepseek-ai/dsh-client-runtime'
        || name === 'react').toBe(true)
    }
  })
})
