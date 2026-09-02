import { describe, expect, it } from 'vitest'
import {
  executeRewriteContractCaseV2,
  matchesRewriteDecisionV2,
  matchesRewriteStateV2,
  rewriteContractCasesV2,
} from '@yeisme/dsh-client-ui-conversation-rewrite-core/testing'

/**
 * Cross-surface contract parity：Web 以 consumer 身份执行共享 fixture 表，
 * 证明本包依赖的 core 版本对 boundary/staged mutation 的分类与 expected
 * 完全一致；expected 表由 core `./testing` 提供，本仓不复制。
 * （Web V1 facade 的 DSH-specific 行为由 boundary.spec 直接覆盖。）
 */
describe('shared rewrite contract fixtures (core/testing)', () => {
  it('`./testing` 子路径可从 Web 依赖图解析', () => {
    expect(rewriteContractCasesV2.length).toBeGreaterThan(20)
  })

  for (const kase of rewriteContractCasesV2) {
    it(`${kase.type}:${kase.id} 与 shared expected 一致`, async () => {
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

  it('全部 fixture 的 prompt 文本不进入执行结果', async () => {
    for (const kase of rewriteContractCasesV2) {
      if (kase.type === 'boundary') continue
      const result = await executeRewriteContractCaseV2(kase)
      expect(JSON.stringify(result.final)).not.toContain('ORIGINAL_PROMPT')
      expect(JSON.stringify(result.final)).not.toContain('EDITED_PROMPT')
    }
  })
})
