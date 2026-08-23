/**
 * 集成测试证据写入 helper。
 *
 * 约定（见仓库 AGENTS.md）：每次集成运行把脱敏证据写入仓库根
 * temp/integration-test-runs/<run-id>/；不得包含凭据、raw prompt、
 * provider payload、private tool arguments、绝对路径。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'

const FORBIDDEN: readonly RegExp[] = [
  /\/workspaces\//i,
  /\/home\/[a-z]/i,
  /\/Users\/[a-z]/i,
  /[A-Za-z]:\\\\/,
  /rawPrompt/i,
  /privateArguments/i,
  /providerPayload/i,
  /"token"/i,
  /"authorization"/i,
  /"cookie"/i,
  /"secret"/i,
  /"credential"/i,
  /"password"/i,
  /bearer\s+[A-Za-z0-9._-]{8,}/i,
  /sk-[A-Za-z0-9]{8,}/,
]

export function assertRedacted(payload: string, label: string): void {
  for (const pattern of FORBIDDEN) {
    expect(payload, `${label} must stay redacted (matched ${String(pattern)})`).not.toMatch(pattern)
  }
}

export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml')) || existsSync(join(dir, '.git'))) return dir
    dir = dirname(dir)
  }
  throw new Error('repo root not found from test location')
}

export interface EvidenceRun {
  readonly runId: string
  readonly dir: string
  artifact(name: string, payload: string | Record<string, unknown> | readonly unknown[]): void
  summary(data: Record<string, unknown>): void
}

export function createEvidenceRun(changeId: string): EvidenceRun {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const runId = `${changeId}-${stamp}-${process.pid}`
  const dir = join(repoRoot(), 'temp', 'integration-test-runs', runId)
  mkdirSync(join(dir, 'artifacts'), { recursive: true })
  return {
    runId,
    dir,
    artifact(name, payload) {
      const text = typeof payload === 'string' ? payload : `${JSON.stringify(payload, null, 2)}\n`
      assertRedacted(text, `artifact ${name}`)
      writeFileSync(join(dir, 'artifacts', name), text)
    },
    summary(data) {
      const text = `${JSON.stringify({ schemaVersion: 'harness-plugins.integration-run.v1', changeId, generatedAt: new Date().toISOString(), ...data }, null, 2)}\n`
      assertRedacted(text, 'summary.json')
      writeFileSync(join(dir, 'summary.json'), text)
    },
  }
}
