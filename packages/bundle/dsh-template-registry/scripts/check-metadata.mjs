#!/usr/bin/env node
// Static install-declaration metadata check (mirrors the repo-level
// declaration lint for this bundle): cordis.patch.yml row must match the
// package name, the dsh manifest must point at the patch file, the client
// entry must be exported, and the ModuleLoader banner id in tsdown.config.ts
// must equal the package name. Fails loud; nothing is rewritten here.

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []

const pkg = JSON.parse(await readFile(resolve(bundleRoot, 'package.json'), 'utf8'))
const patch = await readFile(resolve(bundleRoot, 'cordis.patch.yml'), 'utf8')
const tsdown = await readFile(resolve(bundleRoot, 'tsdown.config.ts'), 'utf8')

const rows = [...patch.matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)].map(match => match[1])
const names = [...patch.matchAll(/^\s*name:\s*'([^']+)'\s*$/gm)].map(match => match[1])

if (rows.length === 0) problems.push('cordis.patch.yml declares no insert row')
for (const row of rows) {
  if (row !== 'dsh-template-registry') problems.push(`patch row id must be dsh-template-registry, got ${row}`)
}
for (const name of names) {
  if (name !== pkg.name) problems.push(`patch row name must be ${pkg.name}, got ${name}`)
}

if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') problems.push('dsh.bundle.patch must point at ./cordis.patch.yml')
if (pkg.exports?.['./client'] === undefined) problems.push('package must export ./client')
if (pkg.scripts?.build === undefined) problems.push('package must declare a build script')

const bannerId = tsdown.match(/banner:\s*'window\.__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/)?.[1]
if (bannerId !== pkg.name) problems.push(`ModuleLoader banner id must equal ${pkg.name}, got ${String(bannerId)}`)

if (problems.length > 0) {
  process.stderr.write(`template-registry bundle metadata check failed:\n${problems.map(problem => `- ${problem}`).join('\n')}\n`)
  process.exit(1)
}
process.stdout.write(`template-registry bundle metadata: current (patch row ${rows.join(',')} -> ${pkg.name})\n`)
