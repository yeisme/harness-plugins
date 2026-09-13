#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderMetadataFiles } from './bundle-metadata-source.mjs'

const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const unsupported = process.argv.slice(2).filter(argument => argument !== '--check')
if (unsupported.length > 0) throw new Error(`unsupported arguments: ${unsupported.join(', ')}`)

const outputs = renderMetadataFiles()
const drift = []

for (const [relativePath, expected] of outputs) {
  const outputPath = resolve(bundleRoot, relativePath)
  if (checkOnly) {
    let actual
    try {
      actual = await readFile(outputPath, 'utf8')
    } catch {
      drift.push(relativePath)
      continue
    }
    if (actual !== expected) drift.push(relativePath)
  } else {
    await writeFile(outputPath, expected, 'utf8')
  }
}

if (drift.length > 0) {
  process.stderr.write(`3D Director bundle metadata drift: ${drift.join(', ')}\nRun: pnpm --dir packages/bundle/dsh-3d-director run generate:metadata\n`)
  process.exitCode = 1
} else {
  process.stdout.write(checkOnly ? '3D Director bundle metadata: current\n' : '3D Director bundle metadata: generated\n')
}
