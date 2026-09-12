import { expect, it } from 'vitest'
import { matchesEikonaPreparationInput, type EikonaPreparationResult } from '../src/eikona-preparation-contract.ts'

it('binds a successful preparation to the selected model and fixed prompt version', () => {
  const result: EikonaPreparationResult = { status: 'ready', preparationRef: `egp_${'a'.repeat(64)}`, projectId: 'project',
    promptRef: 'eikona://prompts/prompt/versions/2', promptDigest: 'b'.repeat(64), digest: 'c'.repeat(64), summaryDigest: 'd'.repeat(64),
    modelRef: 'openai/gpt-5.4-image-2', candidateCount: 1, costState: 'unknown', executionAuthorized: false, createdAt: '2026-09-09T00:00:00Z',
    controls: { model_ref: 'openai/gpt-5.4-image-2', candidate_count: 1 } }
  const input = { prompt_id: 'prompt', prompt_version: 2, controls: { model_ref: 'openai/gpt-5.4-image-2' } }
  expect(matchesEikonaPreparationInput(input, result)).toBe(true)
  expect(matchesEikonaPreparationInput({ ...input, controls: { model_ref: 'other/model' } }, result)).toBe(false)
  expect(matchesEikonaPreparationInput({ ...input, prompt_version: 1 }, result)).toBe(false)
  expect(matchesEikonaPreparationInput({ prompt_id: 'prompt', prompt_version: 2 }, result)).toBe(true)
  expect(matchesEikonaPreparationInput(input, { status: 'unconfirmed' })).toBe(true)
})
