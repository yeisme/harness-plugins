#!/usr/bin/env node
// pnpm check:plugins 统一入口 CLI（G18 §1.3）。
// 用法：node lib/cli.mjs [--baseline] [--only=a,b] [--report-root=temp/toolchain-runs] [--no-report]
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runPluginChecks, summarizeExitCode, writeRunReport, findWorkspaceRoot } from './index.js'
import type { CheckerId } from './types.js'

const VALID: CheckerId[] = [
  'bundle-contract',
  'declaration-lint',
  'safe-projection-audit',
  'dispose-hmr-conformance',
  'visual-token-conformance',
]

export async function main(argv: string[]): Promise<number> {
  let baseline = false
  let only: CheckerId[] | undefined
  let reportRoot = 'temp/toolchain-runs'
  let writeReport = true
  for (const arg of argv) {
    if (arg === '--baseline') baseline = true
    else if (arg.startsWith('--only=')) {
      const requested = arg.slice('--only='.length).split(',').map(item => item.trim()).filter(item => item !== '')
      const invalid = requested.filter(item => !VALID.includes(item as CheckerId))
      if (invalid.length > 0) {
        process.stderr.write(`unknown checkers: ${invalid.join(', ')} (valid: ${VALID.join(', ')})\n`)
        return 2
      }
      only = requested as CheckerId[]
    } else if (arg.startsWith('--report-root=')) reportRoot = arg.slice('--report-root='.length)
    else if (arg === '--no-report') writeReport = false
    else {
      process.stderr.write(`unknown argument: ${arg}\n`)
      return 2
    }
  }

  const root = findWorkspaceRoot(process.cwd())
  const result = await runPluginChecks(only !== undefined ? { root, only, baseline } : { root, baseline })

  for (const reportItem of result.reports) {
    const reds = reportItem.findings.length
    const label = reportItem.status === 'error' ? 'ERROR' : reportItem.status === 'red' ? 'RED' : 'PASS'
    process.stdout.write(`CHECK ${reportItem.checker}: ${label} (checked ${reportItem.checkedCount}, findings ${reds}, ${reportItem.durationMs}ms)\n`)
    if (reportItem.error !== undefined) process.stdout.write(`  internal error: ${reportItem.error}\n`)
    for (const finding of reportItem.findings) {
      process.stdout.write(`  - ${finding.location}${finding.line !== undefined ? `:${String(finding.line)}` : ''} [${finding.code}] ${finding.message}\n`)
    }
  }

  if (writeReport) {
    const written = await writeRunReport(result, resolve(root, reportRoot))
    process.stdout.write(`report: ${written.runDir}\n`)
  }
  if (baseline) process.stdout.write('mode: baseline — red lights recorded, not failing (first-run baseline per G18 §1.4)\n')

  return summarizeExitCode(result)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(code => {
    process.exitCode = code
  })
}
