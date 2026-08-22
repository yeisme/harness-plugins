import { readdir, readFile } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const FORBIDDEN = [
  /from\s+['"][^'"]*better-sidebar/i,
  /require\(\s*['"][^'"]*better-sidebar/i,
  /ctx\.betterSidebar/,
  /from\s+['"][^'"]*dsh-codex-ui/i,
  /from\s+['"][^'"]*dream12347/i,
  /from\s+['"](?!@yeisme\/)[^'"]*dsh-session-manager/i,
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
  it('does not import community plugin packages or private APIs', async () => {
    const files = [
      ...await collectFiles(join(root, 'src')),
      ...await collectFiles(join(root, 'tests')),
      join(root, 'package.json'),
      join(root, 'cordis.patch.yml'),
    ]
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const violations = FORBIDDEN.filter(pattern => pattern.test(content))
      expect(violations, relative(root, file)).toEqual([])
    }
  })
})
