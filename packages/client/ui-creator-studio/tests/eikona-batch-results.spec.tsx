// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EikonaBatchResults } from '../src/eikona-batch-results.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
afterEach(cleanup)
it('pins batch identity across pages, retains results on mismatch and reads candidates only explicitly', async () => {
  const first = { status: 'ready' as const, projectRef: 'project:owner', operationRef: 'eikona-batch:one', batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}`, planDigest: `sha256:${'b'.repeat(64)}`, offset: 0, total: 21, nextOffset: 20, items: Array.from({ length: 20 }, (_, i) => ({ requestId: `request:${i}`, status: 'succeeded' as const, runRef: `run_${i}` })) }
  const next = { ...first, offset: 20, nextOffset: undefined, items: [{ requestId: 'request:last', status: 'succeeded' as const, runRef: 'run_last' }] }
  const read = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ ...next, planDigest: `sha256:${'c'.repeat(64)}` }).mockResolvedValueOnce(next)
  const review = vi.fn(async () => ({ status: 'unavailable' as const }))
  render(<EikonaBatchResults operationRef={first.operationRef} runtime={{ readEikonaBatchMembers: read, readEikonaReview: review }} t={t} />)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '读取批量成员' }))
  await screen.findByText('request:0')
  expect(review).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '下一页' }))
  await screen.findByText('成员读取未确认，已保留当前结果。')
  expect(screen.getByText('request:0')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
  await screen.findByText('request:last')
  expect(read.mock.calls[1]![0]).toEqual(read.mock.calls[2]![0])
  expect(review).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '读取本次生成候选' }))
  expect(review).toHaveBeenCalledWith({ runId: 'run_last' })
})
it('compares fixed candidates from different members without reading media until confirmation', async () => {
  const operationRef = 'eikona-batch:one'
  const members = { status: 'ready' as const, projectRef: 'project:one', operationRef, batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}`, planDigest: `sha256:${'b'.repeat(64)}`, offset: 0, total: 2, items: ['one', 'two'].map(id => ({ requestId: id, runRef: `run_${id}`, status: 'succeeded' as const })) }
  const image = vi.fn(async () => ({ status: 'unavailable' as const }))
  const review = vi.fn(async ({ runId }: { runId: string }) => ({ status: 'ready' as const, runId, projectId: 'one', observedAt: '2026-09-09T00:00:00Z', ownerDecision: 'pending' as const, admissionState: 'unknown' as const, canDecide: false, canSupersede: false, candidates: [{ candidateId: 'one', label: runId, artifactRef: `eikona://artifacts/${runId}/one`, contentDigest: (runId === 'run_one' ? 'a' : 'b').repeat(64) }] }))
  render(<EikonaBatchResults operationRef={operationRef} runtime={{ readEikonaBatchMembers: async () => members, readEikonaReview: review, readEikonaCandidateImage: image }} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: '读取批量成员' }))
  await screen.findByText('two')
  for (const button of screen.getAllByRole('button', { name: '读取本次生成候选' })) fireEvent.click(button)
  await screen.findByText('run_two')
  for (const button of screen.getAllByRole('button', { name: '选入比较' })) fireEvent.click(button)
  expect(image).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '确认读取并比较' }))
  await vi.waitFor(() => expect(image).toHaveBeenCalledTimes(2))
  expect(image.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([
    expect.objectContaining({ artifactRef: 'eikona://artifacts/run_one/one', contentDigest: 'a'.repeat(64), confirmed: true }),
    expect.objectContaining({ artifactRef: 'eikona://artifacts/run_two/one', contentDigest: 'b'.repeat(64), confirmed: true }),
  ]))
})
