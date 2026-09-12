// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EikonaBatchPlanPreview } from '../src/eikona-batch-plan-preview.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
afterEach(cleanup)
it('checks explicitly and keeps unknown cost distinct from zero or execution consent', async () => {
 const input = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` }
 const read = vi.fn(async () => ({ status: 'ready' as const, ...input, projectRef: 'project:owner', planDigest: `sha256:${'b'.repeat(64)}`, planStatus: 'blocked' as const, requestCount: 1, estimatedCalls: 2, maxParallelRequests: 1, maxProviderCalls: 2, costEstimateKnown: false, blockers: [{ requestId: 'request:one', code: 'COST_ESTIMATE_UNKNOWN' }], executionAuthorized: false as const }))
 render(<EikonaBatchPlanPreview input={input} read={read} t={t} />)
 expect(read).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: '检查运行计划' }))
 await screen.findByText(/未知，不能按零费用处理/u)
 expect(screen.queryByText(/\$0/u)).toBeNull()
 expect(screen.getByText('COST_ESTIMATE_UNKNOWN')).toBeTruthy()
 expect(screen.getByText(/费用仍未知，请先核实费用/u)).toBeTruthy()
 expect(read).toHaveBeenCalledExactlyOnceWith(input)
 expect(screen.queryByRole('button', { name: '执行' })).toBeNull()
})
