import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const forbiddenPackage = ['dsh', 'better', 'sidebar'].join('-')

function filesUnder(root: string): string[] {
  return readdirSync(root).flatMap(name => {
    const path = join(root, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

function forbiddenReferences(text: string): string[] {
  return text.includes(forbiddenPackage) ? [forbiddenPackage] : []
}

describe('source independence', () => {
  it('rejects the reference package marker in a negative fixture', () => {
    expect(forbiddenReferences(`dependency=${forbiddenPackage}`)).toEqual([forbiddenPackage])
  })

  it('keeps production source and manifests independent from the reference package', () => {
    const packageRoot = resolve(import.meta.dirname, '..')
    const protocolRoot = resolve(packageRoot, '../../host/pane-protocol')
    const files = [
      join(packageRoot, 'package.json'),
      join(protocolRoot, 'package.json'),
      ...filesUnder(join(packageRoot, 'src')),
      ...filesUnder(join(protocolRoot, 'src')),
      ...(existsSync(join(packageRoot, 'lib')) ? filesUnder(join(packageRoot, 'lib')) : []),
      ...(existsSync(join(protocolRoot, 'lib')) ? filesUnder(join(protocolRoot, 'lib')) : []),
    ]
    const hits = files.flatMap(file => forbiddenReferences(readFileSync(file, 'utf8')).map(marker => `${file}:${marker}`))
    expect(hits).toEqual([])
  })
})
