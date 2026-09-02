import { describe, expect, it } from 'vitest'
import {
  executeRewriteContractCaseV2,
  matchesRewriteDecisionV2,
  matchesRewriteStateV2,
  rewriteContractCasesV2,
  type RewriteContractCaseV2,
} from '../src/testing.ts'

/**
 * Shared fixtures 自检：本包先以第一 consumer 身份跑通全表，Web/TUI 的
 * cross-surface 测试执行同一 case 表（见 specs 的 cross-surface requirement）。
 */
describe('rewriteContractCasesV2', () => {
  it('覆盖必需类别（boundary/阶段失败/duplicate/dispose）', () => {
    const ids = new Set(rewriteContractCasesV2.map((kase) => kase.id))
    const required = [
      'boundary-edit-completed',
      'boundary-retry-completed',
      'boundary-first-round-enabled',
      'boundary-first-round-disabled',
      'boundary-user-turn-running',
      'boundary-retry-settlement-pending',
      'boundary-non-text-prompt',
      'boundary-removed-session',
      'boundary-stable-boundary-unavailable',
      'mutation-full-success',
      'mutation-fork-rejected',
      'mutation-fork-unknown-partial-child',
      'mutation-prompt-rejected',
      'mutation-prompt-unknown',
      'mutation-activate-rejected',
      'mutation-hydrate-unknown',
      'procedure-duplicate-run',
      'procedure-dispose-late-result',
    ]
    for (const id of required) {
      expect(ids.has(id), `missing fixture ${id}`).toBe(true)
    }
  })

  it('fixture 文本只使用虚构值，不含真实 prompt/路径', () => {
    const serialized = JSON.stringify(rewriteContractCasesV2)
    expect(serialized).not.toMatch(/\/(home|Users|workspaces)\//)
    expect(serialized).not.toContain('sk-')
  })

  for (const kase of rewriteContractCasesV2) {
    it(`${kase.type}:${kase.id} 与 expected 一致`, async () => {
      const result = await executeRewriteContractCaseV2(kase)
      if (kase.type === 'boundary') {
        expect(result.decision).not.toBeNull()
        expect(matchesRewriteDecisionV2(result.decision!, kase.expected), kase.id).toBe(true)
      } else {
        expect(result.final).not.toBeNull()
        expect(matchesRewriteStateV2(result.final!, kase.expected), `${kase.id}: ${JSON.stringify(result.final)}`).toBe(true)
      }
    })
  }

  it('duplicate-run fixture 只产生一次 fork/prompt/activate', async () => {
    const kase = rewriteContractCasesV2.find((entry): entry is RewriteContractCaseV2 & { type: 'procedure'; id: 'procedure-duplicate-run' } => entry.type === 'procedure' && entry.id === 'procedure-duplicate-run')
    const result = await executeRewriteContractCaseV2(kase!)
    expect(result.calls).toEqual(['fork', 'prompt', 'activate'])
  })

  it('boundarySeq=null 且能力缺席的 fixture 零 owner 调用', async () => {
    const kase = rewriteContractCasesV2.find((entry): entry is RewriteContractCaseV2 & { type: 'mutation'; id: 'mutation-first-round-capability-missing' } => entry.type === 'mutation' && entry.id === 'mutation-first-round-capability-missing')
    const result = await executeRewriteContractCaseV2(kase!)
    expect(result.calls).toEqual([])
  })

  it('sentinel：执行全部 mutation/procedure case 后无 prompt 文本泄漏', async () => {
    const leaked: string[] = []
    for (const kase of rewriteContractCasesV2) {
      if (kase.type === 'boundary') continue
      const result = await executeRewriteContractCaseV2(kase)
      const serialized = JSON.stringify(result.final)
      for (const marker of ['ORIGINAL_PROMPT', 'EDITED_PROMPT']) {
        if (serialized.includes(marker)) leaked.push(`${kase.id}:${marker}`)
      }
    }
    expect(leaked).toEqual([])
  })
})
