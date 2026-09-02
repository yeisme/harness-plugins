import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

/** core 必须保持零 React/DOM/DSH-private 依赖（specs ADDED requirement 1）。 */
describe('package purity', () => {
  const files = readdirSync(srcDir).filter((file) => file.endsWith('.ts'))

  it('src 下存在 boundary/controller/testing 模块', () => {
    expect(files).toContain('boundary.ts')
    expect(files).toContain('controller.ts')
    expect(files).toContain('testing.ts')
  })

  for (const file of files) {
    it(`${file} 不 import React/DOM/DSH runtime`, () => {
      const source = readFileSync(join(srcDir, file), 'utf8')
      expect(source, `${file} must not import React`).not.toMatch(/from ['"]react/)
      expect(source, `${file} must not import DOM`).not.toMatch(/@deepseek-ai\//)
      expect(source, `${file} must not use DOM globals`).not.toMatch(/\b(document|window|navigator)\b/)
      expect(source, `${file} must not reference private-core`).not.toMatch(/dsh-runtime|private-core/)
      // 绝对路径依赖同样被禁止（design §10 pack canary 规则）
      expect(source, `${file} must not use absolute imports`).not.toMatch(/from ['"]\//)
    })
  }

  it('package.json 无 production dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(srcDir, '..', 'package.json'), 'utf8'))
    expect(pkg.dependencies).toBeUndefined()
  })
})
