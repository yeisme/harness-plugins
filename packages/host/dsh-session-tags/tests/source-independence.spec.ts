import { readdir, readFile } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const FORBIDDEN = [
  /from\s+['"][^'"]*better-sidebar/i,
  /require\(\s*['"][^'"]*better-sidebar/i,
  /ctx\.betterSidebar/,
  /from\s+['"]@deepseek-ai\/dsh-[^'"]*\/src\//,
  /from\s+['"][^'"]*dsh-codex-ui/i,
  /from\s+['"][^'"]*dream12347/i,
]

const SRC_FORBIDDEN = [
  ...FORBIDDEN,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/,
]

async function collectFiles(dir: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(full))
    else if (/\.(ts|tsx|js|mjs|cjs|json|ya?ml)$/.test(entry.name)) files.push(full)
  }
  return files
}

describe('source independence', () => {
  it('does not import community plugins or private APIs', async () => {
    const files = [
      ...await collectFiles(join(root, 'src')),
      ...await collectFiles(join(root, 'tests')),
      join(root, 'package.json'),
    ]
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const violations = FORBIDDEN.filter(pattern => pattern.test(content))
      expect(violations, relative(root, file)).toEqual([])
    }
  })

  it('does not use browser storage in shipped source', async () => {
    const files = await collectFiles(join(root, 'src'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const violations = SRC_FORBIDDEN.filter(pattern => pattern.test(content))
      expect(violations, relative(root, file)).toEqual([])
    }
  })

  it('declares public storage-domain, session-persistence, and Typert peers', async () => {
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      peerDependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const required = [
      '@deepseek-ai/dsh-storage-domain',
      '@deepseek-ai/dsh-session-persistence',
      '@deepseek-ai/dsh-typert-protocol',
    ]
    for (const name of required) {
      expect(manifest.peerDependencies?.[name]).toBe('^0.1.0-rc.6')
      expect(manifest.devDependencies?.[name]).toBe('^0.1.0-rc.6')
    }
  })
})
