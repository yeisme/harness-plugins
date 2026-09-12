import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const startedAt = new Date()
const runId = `sonora-subtitle-${startedAt.toISOString().replace(/[-:.]/g, '')}-${process.pid}`
const directory = resolve(root, 'temp/integration-test-runs', runId)
mkdirSync(resolve(directory, 'artifacts'), { recursive: true })
const args = ['--filter', '@yeisme/dsh-creator-studio-host', 'exec', 'vitest', 'run', 'tests/sonora-subtitle-adapter.integration.spec.ts', 'tests/sonora-subtitle-export.spec.ts']
const redact = text => String(text ?? '').replaceAll(root, '[PROJECT_ROOT]')
  .replace(/(Bearer\s+)\S+/gi, '$1[REDACTED]')
  .replace(/((?:token|secret|password|cookie)\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
writeFileSync(resolve(directory, 'command.txt'), `pnpm ${args.join(' ')}\n`)
writeFileSync(resolve(directory, 'env.json'), JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch }, null, 2))
const result = spawnSync('pnpm', args, { cwd: root, encoding: 'utf8' })
const exitCode = result.status ?? 1
writeFileSync(resolve(directory, 'stdout.log'), redact(result.stdout))
writeFileSync(resolve(directory, 'stderr.log'), redact(`${result.stderr ?? ''}${result.error?.message ?? ''}`))
writeFileSync(resolve(directory, 'summary.json'), JSON.stringify({ runId, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
  status: exitCode === 0 ? 'passed' : 'failed', exitCode, layer: 'integration',
  notes: ['Real Creator directory and gateway with Sonora adapter; injected HTTP fixture.', 'Does not verify live Sonora, browser UI, real audio providers, or delivery.'],
}, null, 2))
console.log(`Sonora subtitle evidence: ${relative(root, directory)}`)
process.exitCode = exitCode
