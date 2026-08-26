/**
 * dsh-unified-panel-visual-system-v1 3.4 B 档守卫：
 * PreviewPanel 委派宿主 `dsh-badge*`/`dsh-preview-*` 类承载视觉（官方 slot
 * 语义），本仓不自建样式。本测试钉住两个合同：源码零硬编码颜色字面量、
 * 状态表达走宿主类名而非颜色。
 */
import { describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '../src')

async function collect(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await collect(path))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path)
  }
  return out
}

describe('agent preset visual delegation guard', () => {
  it('源码零硬编码颜色字面量', async () => {
    for (const file of await collect(root)) {
      const content = await readFile(file, 'utf8')
      expect(content.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], relative(root, file)).toEqual([])
      expect(content.match(/rgba?\(/g) ?? [], relative(root, file)).toEqual([])
    }
  })

  it('状态徽标委派宿主 dsh-badge 类（不自建状态色）', async () => {
    const preview = await readFile(join(root, 'client/PreviewPanel.tsx'), 'utf8')
    for (const cls of ['dsh-badge-error', 'dsh-badge-warning', 'dsh-badge-success']) {
      expect(preview).toContain(cls)
    }
    expect(preview.match(/dsh-badge/g)?.length ?? 0).toBeGreaterThanOrEqual(5)
  })
})
