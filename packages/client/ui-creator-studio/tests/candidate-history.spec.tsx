// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CandidateHistory } from '../src/candidate-history.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
import type { CreatorCandidatePageV1 } from '@yeisme/dsh-creator-studio-host/contracts'
afterEach(cleanup)
const artifact = { schema: 'pane.artifact.v1alpha1' as const, owner: 'auctra', kind: 'text', ref: 'auctra:working-copy:fixture', version: '1:fixture', mediaType: 'text/plain', title: 'Working Copy', capabilities: [], evidenceRefs: [] }
const first: CreatorCandidatePageV1 = { schemaVersion: 'creator.candidate-page.v1alpha1', status: 'ready', artifact,
  candidates: [{ ref: 'cand-one', version: '0:one', title: 'First', status: 'ready' }], nextCursor: 'next_one' }
it('keeps the displayed page on failure and refreshes only on explicit request', async () => {
  const read = vi.fn<(_: unknown) => Promise<CreatorCandidatePageV1>>().mockResolvedValueOnce(first)
    .mockResolvedValueOnce({ schemaVersion: 'creator.candidate-page.v1alpha1', status: 'invalid_input' }).mockResolvedValue(first)
  const onPage = vi.fn()
  render(<CandidateHistory artifact={artifact} read={read} onPage={onPage} t={t} />)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '加载历史' }))
  await waitFor(() => expect(onPage).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: '下一页' }))
  await screen.findByText(/历史加载失败/)
  expect(onPage).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledTimes(2)
  expect(read.mock.calls[1]?.[0]).toMatchObject({ cursor: 'next_one', limit: 50 })
  fireEvent.click(screen.getByRole('button', { name: '刷新首页' }))
  await waitFor(() => expect(onPage).toHaveBeenCalledTimes(2))
  expect(read.mock.calls[2]?.[0]).not.toHaveProperty('cursor')
})
it('deduplicates clicks and ignores results from an unmounted context', async () => {
  let resolve!: (value: CreatorCandidatePageV1) => void
  const read = vi.fn(() => new Promise<CreatorCandidatePageV1>(done => { resolve = done })), onPage = vi.fn()
  const view = render(<CandidateHistory artifact={artifact} read={read} onPage={onPage} t={t} />)
  const load = screen.getByRole('button', { name: '加载历史' })
  fireEvent.click(load); fireEvent.click(load)
  expect(read).toHaveBeenCalledOnce()
  view.unmount()
  await act(async () => { resolve(first) })
  expect(onPage).not.toHaveBeenCalled()
})
