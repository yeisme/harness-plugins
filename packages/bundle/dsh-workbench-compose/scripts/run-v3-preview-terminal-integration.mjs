#!/usr/bin/env node

/**
 * V3 8.2 integration runner (local, host-independent slice).
 *
 * Exercises the preview/terminal surfaces against fake transports and owner
 * sources: large-text windows, table pages, PDF worker fallback, version
 * stale, image/audio/video budgets, precomputed peaks, HLS fallback, binary
 * fallback, and terminal duplicate/gap/expired-cursor/replay/refresh
 * semantics. The official DSH host is optional upstream integration and is
 * never fabricated here; real node-pty raw VT coverage stays with the seam.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-v3-preview-terminal`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const publicCommand = 'pnpm --filter @yeisme/dsh-workbench-compose run test:integration:v3'

const checks = [
  {
    id: 'preview-access-and-state',
    package: '@yeisme/dsh-rich-media',
    files: ['tests/preview-access.spec.ts', 'tests/preview-platform.spec.ts'],
  },
  {
    id: 'preview-formats-large-text-table-pdf-binary',
    package: '@yeisme/dsh-rich-media',
    files: ['tests/file-preview-formats.spec.tsx', 'tests/pdf-renderer.spec.tsx'],
  },
  {
    id: 'media-image-audio-video-lifecycle',
    package: '@yeisme/dsh-rich-media',
    files: ['tests/media-renderers.spec.tsx', 'tests/media-waveform.spec.tsx', 'tests/media-lifecycle.spec.ts'].filter(Boolean),
  },
  {
    id: 'terminal-transport-semantics',
    package: '@yeisme/dsh-terminal',
    files: ['tests/terminal-panel.spec.tsx', 'tests/link-policy.spec.ts'],
  },
  {
    id: 'terminal-host-contract',
    package: '@yeisme/dsh-terminal-host',
    files: ['tests/terminal-host.spec.ts'],
  },
  {
    id: 'file-document-views',
    package: '@yeisme/dsh-file-document',
    files: ['tests/file-tree.spec.ts', 'tests/pane-views.spec.tsx'],
  },
]

function redact(text) {
  return text
    .replaceAll(projectRoot, '<repo-root>')
    .replaceAll(/(?:Bearer\s+)\S+/gu, 'Bearer <redacted>')
    .replaceAll(/(?:ghp_|github_pat_)\S+/gu, '<token>')
}

mkdirSync(artifactsRoot, { recursive: true })

const results = checks.map(check => {
  const files = check.files.filter(file => file !== undefined)
  if (files.length === 0) return { ...check, files, status: 'skipped', exit_code: 0, stdout: '', stderr: '', command: `${check.package} (no files)` }
  const args = ['--filter', check.package, 'exec', 'vitest', 'run', ...files]
  const result = spawnSync('pnpm', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
    timeout: 300_000,
  })
  const exitCode = result.status ?? 1
  return {
    ...check,
    files,
    command: `pnpm ${args.join(' ')}`,
    status: exitCode === 0 ? 'passed' : 'failed',
    exit_code: exitCode,
    stdout: redact(result.stdout ?? ''),
    stderr: redact(result.stderr ?? result.error?.message ?? ''),
  }
})

const failed = results.filter(result => result.exit_code !== 0)
const finishedAt = new Date()

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
  schema: 'dsh.v3.preview_terminal_integration_matrix.v1',
  change: 'dsh-pane-workspace-experience-v3',
  task: '8.2-local-slice',
  checks: results.map(({ id, package: packageName, files, status, exit_code }) => ({ id, package: packageName, files, status, exit_code })),
  host_integration: 'official_dsh_seam_pending_upstream',
  real_pty_coverage: 'deferred_to_official_seam_7_1',
}, null, 2)}\n`)
writeFileSync(resolve(evidenceRoot, 'summary.json'), `${JSON.stringify({
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'integration',
  command: publicCommand,
  status: failed.length === 0 ? 'passed' : 'failed',
  exit_code: failed.length === 0 ? 0 : 1,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  checks: results.map(({ id, status, exit_code }) => ({ id, status, exit_code })),
  redaction: { enabled: true, policy: 'repo-root path, bearer, github tokens redacted; failure exit codes preserved' },
}, null, 2)}\n`)

console.log(`run_id=${runId}`)
console.log(`evidence=${relative(projectRoot, evidenceRoot)}`)
console.log(`status=${failed.length === 0 ? 'passed' : 'failed'} (${results.length - failed.length}/${results.length})`)
for (const result of results) console.log(`  ${result.status === 'passed' ? '✓' : '✗'} ${result.id} (${result.exit_code})`)
process.exit(failed.length === 0 ? 0 : 1)
