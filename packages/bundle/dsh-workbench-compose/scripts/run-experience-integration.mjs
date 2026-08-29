#!/usr/bin/env node

/**
 * Cross-package integration evidence for dsh-web-pane-experience-completion-v1.
 *
 * This stays host-independent: it exercises the Tier 0 overlay, hot upgrade,
 * menu/drag artifact handoff channels, Drama client wiring and consumption
 * gate, plus the versioned scenario mapping. Official dsh web is an optional
 * upstream integration and is not fabricated here.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-web-pane-experience`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const publicCommand = 'pnpm --filter @yeisme/dsh-workbench-compose run test:integration'

const checks = [
  {
    id: 'tier0-overlay-and-handoff',
    package: '@yeisme/dsh-client-ui-pane-workbench',
    files: [
      'tests/official-host.spec.tsx',
      'tests/client-v2.spec.ts',
      'tests/handoff-menu.spec.tsx',
      'tests/artifact-seam.spec.ts',
    ],
  },
  {
    id: 'drama-client-and-consumption-gate',
    package: '@yeisme/dsh-client-ui-ai-drama-director',
    files: [
      'tests/apply.spec.ts',
      'tests/handoff-gate.spec.ts',
      'tests/context.spec.ts',
      'tests/preset.spec.ts',
      'tests/probe.spec.ts',
    ],
  },
  {
    id: 'workbench-scenario-mapping',
    package: '@yeisme/dsh-workbench-compose',
    files: [
      'tests/scenario-mapping.spec.ts',
      'tests/client-provider.spec.tsx',
    ],
  },
]

mkdirSync(artifactsRoot, { recursive: true })

const results = checks.map(check => {
  const args = ['--filter', check.package, 'exec', 'vitest', 'run', ...check.files]
  const result = spawnSync('pnpm', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
    timeout: 300_000,
  })
  const exitCode = result.status ?? 1
  return {
    id: check.id,
    package: check.package,
    files: check.files,
    command: `pnpm ${args.join(' ')}`,
    status: exitCode === 0 ? 'passed' : 'failed',
    exit_code: exitCode,
    stdout: redact(result.stdout ?? ''),
    stderr: redact(result.stderr ?? result.error?.message ?? ''),
  }
})

const failed = results.filter(result => result.exit_code !== 0)
const finishedAt = new Date()
const relativeEvidenceRoot = relative(projectRoot, evidenceRoot)

writeFileSync(resolve(evidenceRoot, 'command.txt'), `${publicCommand}\n${results.map(result => result.command).join('\n')}\n`)
writeFileSync(resolve(evidenceRoot, 'stdout.log'), results.map(result => `## ${result.id} (${result.status})\n${result.stdout}`).join('\n'))
writeFileSync(resolve(evidenceRoot, 'stderr.log'), results.map(result => result.stderr.length === 0 ? '' : `## ${result.id}\n${result.stderr}`).filter(Boolean).join('\n'))
writeFileSync(resolve(evidenceRoot, 'env.json'), `${JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  ci: process.env.CI === 'true',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}, null, 2)}\n`)
writeFileSync(resolve(artifactsRoot, 'integration-matrix.json'), `${JSON.stringify({
  schema: 'dsh.web-pane-experience-integration-matrix.v1',
  change: 'dsh-web-pane-experience-completion-v1',
  checks: results.map(({ id, package: packageName, files, status, exit_code: exitCode }) => ({
    id,
    package: packageName,
    files,
    status,
    exit_code: exitCode,
  })),
  host_integration: 'optional_not_fabricated',
}, null, 2)}\n`)
writeFileSync(resolve(evidenceRoot, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins/packages/bundle/dsh-workbench-compose',
  run_id: runId,
  layer: 'integration',
  command: publicCommand,
  status: failed.length === 0 ? 'passed' : 'failed',
  exit_code: failed.length === 0 ? 0 : 1,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  checks: results.map(({ id, package: packageName, files, status, exit_code: exitCode }) => ({
    id,
    package: packageName,
    files,
    status,
    exit_code: exitCode,
  })),
  evidence: {
    command: `${relativeEvidenceRoot}/command.txt`,
    stdout: `${relativeEvidenceRoot}/stdout.log`,
    stderr: `${relativeEvidenceRoot}/stderr.log`,
    env: `${relativeEvidenceRoot}/env.json`,
    artifacts: `${relativeEvidenceRoot}/artifacts`,
  },
  redaction: {
    enabled: true,
    policy: 'yeisme.integration-test-redaction.v1',
    absolute_paths_persisted: false,
    raw_payloads_persisted: false,
  },
}, null, 2)}\n`)

process.stdout.write(`Web pane experience integration evidence: ${relativeEvidenceRoot}/summary.json\n`)
for (const result of failed) process.stderr.write(`${result.id} failed with exit ${result.exit_code}\n`)
process.exitCode = failed.length === 0 ? 0 : 1

function redact(value) {
  return String(value)
    .replaceAll(projectRoot, '<project>')
    .replaceAll(packageRoot, '<package>')
    .replace(/https?:\/\/[^\s)]+/giu, '<url>')
    .replace(/(?:file:\/\/)?\/(?:home|workspaces|Users|tmp|private)\/[^\s):]+/gu, '<path>')
    .replace(/(api[-_]?key|authorization|password|secret|token|cookie)\s*[:=]\s*[^,\s]+/giu, '$1=<redacted>')
    .replace(/(raw[_ -]?prompt|provider[_ -]?payload|private[_ -]?tool[_ -]?arguments?)\s*[:=]\s*.+$/gimu, '$1=<redacted>')
}
