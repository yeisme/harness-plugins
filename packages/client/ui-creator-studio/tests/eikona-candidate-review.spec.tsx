// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EikonaCandidateReview } from '../src/eikona-candidate-review.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
import type { EikonaReviewResult } from '@yeisme/dsh-creator-studio-host/contracts'
afterEach(cleanup)
it('reads explicitly and does not label an undecided candidate as adopted from the run status', async () => {
  const ref = 'eikona://artifacts/run/candidate', digest = 'a'.repeat(64)
  const read = vi.fn(async (): Promise<EikonaReviewResult> => ({ status: 'ready', runId: 'run', projectId: 'project', observedAt: '2026-09-08T00:00:00Z', ownerDecision: 'accepted', admissionState: 'unknown', canDecide: true, canSupersede: true, candidates: [{ candidateId: 'candidate', label: 'Candidate', artifactRef: ref, contentDigest: digest, decisionVersion: 0 }] }))
  render(<EikonaCandidateReview artifactRef={ref} contentDigest={digest} read={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '读取审阅' }))
  await screen.findByText(/已确认尚无决定/u)
  expect(screen.getByText(/图片摘要一致/u)).toBeTruthy()
  expect(read).toHaveBeenCalledWith({ runId: 'run' })
  expect(screen.queryByText(/已采用/u)).toBeNull()
})

it('shows the candidate decision independently of the run aggregate', async () => {
  const read = vi.fn(async (): Promise<EikonaReviewResult> => ({ status: 'ready', runId: 'run', projectId: 'project', observedAt: '2026-09-08T00:00:00Z', ownerDecision: 'pending', admissionState: 'unknown', canDecide: true, canSupersede: true, candidates: [{ candidateId: 'candidate', label: 'Candidate', decisionVersion: 1, decisionState: 'accepted' }] }))
  render(<EikonaCandidateReview artifactRef="eikona://artifacts/run/candidate" read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: '读取审阅' }))
  await screen.findByText(/已采用/u)
  expect(screen.getByText(/决定版本 1/u)).toBeTruthy()
  expect(screen.getByText(/图片绑定待核验/u)).toBeTruthy()
})
