import { expect, it } from 'vitest'
import { creatorCandidatePageSchema, creatorCandidateQuerySchema } from '../src/candidate-history.ts'

const artifact = { schema: 'pane.artifact.v1alpha1', owner: 'auctra', kind: 'text', ref: 'auctra:working-copy:fixture',
  version: '1:fixture', mediaType: 'text/plain', title: 'Working Copy', capabilities: [], evidenceRefs: [] }
const candidate = { ref: 'cand-one', version: '0:digest', title: 'Candidate', status: 'ready' }
const page = { schemaVersion: 'creator.candidate-page.v1alpha1', status: 'ready', artifact, candidates: [candidate], nextCursor: 'opaque_cursor' }
it('keeps pagination bounded and explicitly versioned', () => {
  expect(creatorCandidatePageSchema.safeParse(page).success).toBe(true)
  expect(creatorCandidateQuerySchema.safeParse({ schemaVersion: 'creator.candidate-query.v1alpha1', artifact, limit: 50 }).success).toBe(true)
  for (const limit of [0, 101, 1.5]) expect(creatorCandidateQuerySchema.safeParse({ schemaVersion: 'creator.candidate-query.v1alpha1', artifact, limit }).success).toBe(false)
  expect(creatorCandidatePageSchema.safeParse({ ...page, candidates: Array.from({ length: 101 }, (_, index) => ({ ...candidate, ref: `cand-${index}` })) }).success).toBe(false)
})
it.each(['duplicate', 'body', 'cursor', 'owner', 'version'])('rejects %s contamination', mode => {
  const changed = { ...page, candidates: [{ ...candidate, ...(mode === 'body' ? { body: 'private' } : {}),
    ...(mode === 'owner' || mode === 'version' ? { artifact: { ...artifact, owner: mode === 'owner' ? 'eikona' : 'auctra', version: mode === 'version' ? 'wrong' : candidate.version } } : {}) }],
    ...(mode === 'cursor' ? { nextCursor: 'file:///private' } : {}) }
  if (mode === 'duplicate') changed.candidates.push(changed.candidates[0]!)
  expect(creatorCandidatePageSchema.safeParse(changed).success).toBe(false)
})
it('failure pages cannot smuggle prior candidates or metadata', () => {
  expect(creatorCandidatePageSchema.safeParse({ schemaVersion: page.schemaVersion, status: 'invalid_input' }).success).toBe(true)
  expect(creatorCandidatePageSchema.safeParse({ ...page, status: 'invalid_input' }).success).toBe(false)
})
