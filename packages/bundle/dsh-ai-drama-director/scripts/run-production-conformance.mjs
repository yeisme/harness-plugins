#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const bundleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(bundleRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replace(/[:.]/gu, '-')}-${process.pid}-drama-production`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const commandLog = []
const stdout = []
const stderr = []
let status = 'passed'
let failure

const checks = [
  {
    id: 'g15-current-episode-loop',
    title: 'Story → Visual/Audio → Run → Review',
    evidence: [
      'packages/client/ui-creator-studio/tests/runtime.spec.ts',
      'packages/client/ui-ai-drama-director/tests/views.spec.tsx',
      'packages/client/ui-ai-drama-director/tests/creator-runtime.spec.ts',
    ],
  },
  {
    id: 'g16-show-review-batch',
    title: 'Show Board → Review Inbox → batch preview → receipt → reconcile',
    evidence: [
      'packages/host/dsh-ai-drama-director/tests/show-control.spec.ts',
      'packages/client/ui-ai-drama-director/tests/show-control-controller.spec.ts',
      'packages/client/ui-ai-drama-director/tests/show-control-views.spec.tsx',
    ],
  },
  {
    id: 'g17-compare-annotation-repair',
    title: 'Asset/review compare → annotation batch → repair handoff',
    evidence: [
      'packages/host/dsh-selection-host/tests/anchors.spec.ts',
      'packages/host/dsh-selection-host/tests/batch.spec.ts',
      'packages/client/ui-ai-drama-director/tests/show-control-views.spec.tsx',
    ],
  },
  {
    id: 'g17-timeline-delivery',
    title: 'Timeline review → delivery readiness → owner receipt history',
    evidence: [
      'packages/bundle/dsh-rich-media/tests/media-waveform.spec.tsx',
      'packages/client/ui-ai-drama-director/tests/show-control-views.spec.tsx',
      'packages/host/dsh-ai-drama-director/tests/show-control.spec.ts',
    ],
  },
]

await mkdir(artifactsRoot, { recursive: true })

try {
  run('pnpm', ['--dir', 'packages/host/creator-studio', 'run', 'build'])
  run('pnpm', ['--dir', 'packages/client/ui-creator-studio', 'run', 'build'])
  run('pnpm', ['--dir', 'packages/host/dsh-selection-host', 'run', 'build'])
  run('pnpm', ['--dir', 'packages/bundle/dsh-rich-media', 'run', 'build'])
  run('pnpm', ['--dir', 'packages/host/dsh-ai-drama-director', 'run', 'build'])
  run('pnpm', ['--dir', 'packages/client/ui-ai-drama-director', 'run', 'build'])
  run('pnpm', ['--dir', 'packages/bundle/dsh-ai-drama-director', 'run', 'build'])
  run('pnpm', ['--dir', 'packages/client/ui-creator-studio', 'exec', 'vitest', 'run', 'tests/runtime.spec.ts', 'tests/views.spec.tsx', 'tests/client.spec.tsx'])
  run('pnpm', ['--dir', 'packages/host/dsh-ai-drama-director', 'exec', 'vitest', 'run', 'tests/show-control.spec.ts'])
  run('pnpm', ['--dir', 'packages/client/ui-ai-drama-director', 'exec', 'vitest', 'run', 'tests/creator-runtime.spec.ts', 'tests/views.spec.tsx', 'tests/show-control-controller.spec.ts', 'tests/show-control-views.spec.tsx'])
  run('pnpm', ['--dir', 'packages/host/dsh-selection-host', 'exec', 'vitest', 'run', 'tests/anchors.spec.ts', 'tests/batch.spec.ts'])
  run('pnpm', ['--dir', 'packages/bundle/dsh-rich-media', 'exec', 'vitest', 'run', 'tests/media-waveform.spec.tsx'])
  run('pnpm', ['--dir', 'packages/bundle/dsh-ai-drama-director', 'run', 'smoke:bundle'])
} catch (error) {
  status = 'failed'
  failure = redact(error instanceof Error ? error.message : String(error))
}

const finishedAt = new Date()
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'cross-package-integration',
  command: 'pnpm --dir packages/bundle/dsh-ai-drama-director run test:production',
  status,
  exit_code: status === 'passed' ? 0 : 1,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  failure: failure ?? null,
  checks: checks.map(check => ({ ...check, status })),
  redaction: { enabled: true, policy: 'yeisme.integration-test-redaction.v1' },
  evidence: {
    summary: relative(projectRoot, resolve(evidenceRoot, 'summary.json')),
    command: relative(projectRoot, resolve(evidenceRoot, 'command.txt')),
    stdout: relative(projectRoot, resolve(evidenceRoot, 'stdout.log')),
    stderr: relative(projectRoot, resolve(evidenceRoot, 'stderr.log')),
    env: relative(projectRoot, resolve(evidenceRoot, 'env.json')),
    artifacts: relative(projectRoot, artifactsRoot),
  },
}

await Promise.all([
  writeJson(resolve(evidenceRoot, 'summary.json'), summary),
  writeFile(resolve(evidenceRoot, 'command.txt'), `${commandLog.join('\n')}\n`, 'utf8'),
  writeFile(resolve(evidenceRoot, 'stdout.log'), redact(stdout.join('\n')), 'utf8'),
  writeFile(resolve(evidenceRoot, 'stderr.log'), redact([...stderr, ...(failure === undefined ? [] : [failure])].join('\n')), 'utf8'),
  writeJson(resolve(evidenceRoot, 'env.json'), {
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    ci: process.env.CI === 'true',
    timezone: 'UTC',
  }),
  writeJson(resolve(artifactsRoot, 'scenarios.json'), checks.map(check => ({ ...check, status }))),
])

process.stdout.write(`Drama production evidence: ${summary.evidence.summary}\n`)
if (failure !== undefined) process.stderr.write(`${failure}\n`)
process.exitCode = summary.exit_code

function run(command, args) {
  commandLog.push(`$ ${command} ${args.map(() => '<arg>').join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 300_000,
  })
  stdout.push(redact(result.stdout ?? ''))
  stderr.push(redact(result.stderr ?? ''))
  if (result.error !== undefined) throw result.error
  if (result.signal === 'SIGTERM' && result.status === null) throw new Error(`${command} timed out after 300s`)
  if ((result.status ?? 1) !== 0) throw new Error(`${command} exited with ${result.status ?? 1}`)
}

function redact(value) {
  return String(value)
    .replaceAll(projectRoot, '<project>')
    .replaceAll(bundleRoot, '<bundle>')
    .replace(/https?:\/\/[^\s)]+/giu, '<url>')
    .replace(/\/(?:tmp|private)\/[^\s)]+/giu, '<temp>')
    .replace(/(api[-_]?key|authorization|password|secret|token)\s*[:=]\s*[^,\s]+/giu, '$1=<redacted>')
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
