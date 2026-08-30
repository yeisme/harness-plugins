import { describe, expect, it } from 'vitest'
import {
  RADAR_HANDOFF_TTL_MS,
  createRadarProposalDraft,
  createRadarWorkbenchHandoff,
  verifyRadarHandoffFreshness,
} from '../src/handoff.js'
import {
  validateRadarProposalDraft,
  validateRadarWorkbenchHandoff,
} from '../src/contracts.js'

const CLOCK = () => 1_787_600_000_000
const NONCE = () => 'nonce-test-1'

describe('radar workbench handoff', () => {
  it('carries only safe typed refs', () => {
    const handoff = createRadarWorkbenchHandoff(
      {
        opportunityRef: 'opp:demo-1',
        editionRef: 'edition:demo-2026-08-30',
        profileRevision: 'profile-rev:demo-7',
        reasonRefs: ['reason:demand-rise'],
        evidenceRefs: ['evidence:run-3'],
      },
      { now: CLOCK, nonce: NONCE },
    )
    expect(validateRadarWorkbenchHandoff(handoff)).toBe(true)
    if (typeof handoff === 'object' && 'expiresAt' in handoff) {
      expect(handoff.expiresAt).toBe(CLOCK() + RADAR_HANDOFF_TTL_MS)
      expect(JSON.stringify(handoff)).not.toMatch(/https?:\/\/|\/home\/|\/tmp\//)
    }
  })

  it('fails closed without any target ref', () => {
    const handoff = createRadarWorkbenchHandoff({ profileRevision: 'profile-rev:demo-7' }, { now: CLOCK, nonce: NONCE })
    expect('ok' in handoff && handoff.ok === false).toBe(true)
  })

  it('fails closed on unsafe refs', () => {
    const handoff = createRadarWorkbenchHandoff(
      { opportunityRef: 'https://evil.example/opp', profileRevision: 'profile-rev:demo-7' },
      { now: CLOCK, nonce: NONCE },
    )
    expect('ok' in handoff && handoff.ok === false).toBe(true)
  })

  it('rejects stale profile revisions instead of silently re-pointing', () => {
    const handoff = createRadarWorkbenchHandoff(
      { opportunityRef: 'opp:demo-1', profileRevision: 'profile-rev:demo-6' },
      { now: CLOCK, nonce: NONCE },
    )
    expect('ok' in handoff && handoff.ok === false).toBe(false)
    if (typeof handoff === 'object' && 'profileRevision' in handoff) {
      const stale = verifyRadarHandoffFreshness(handoff, 'profile-rev:demo-7')
      expect(stale.ok).toBe(false)
      expect(stale.reason).toContain('stale')
      const fresh = verifyRadarHandoffFreshness(handoff, 'profile-rev:demo-6')
      expect(fresh.ok).toBe(true)
    }
  })
})

describe('radar proposal drafts', () => {
  it('creates pending-review drafts with reason/evidence refs and known limitations', () => {
    const draft = createRadarProposalDraft({
      opportunityRef: 'opp:demo-1',
      profileRevision: 'profile-rev:demo-7',
      activeProfileRevision: 'profile-rev:demo-7',
      reasonRefs: ['reason:demand-rise'],
      evidenceRefs: ['evidence:run-3'],
      knownLimitations: ['china-only signal'],
      targetOwner: 'creator-studio',
    })
    expect(validateRadarProposalDraft(draft)).toBe(true)
    if (typeof draft === 'object' && 'status' in draft) expect(draft.status).toBe('pending_review')
  })

  it('requires refresh/review when the profile is stale', () => {
    const draft = createRadarProposalDraft({
      opportunityRef: 'opp:demo-1',
      profileRevision: 'profile-rev:demo-6',
      activeProfileRevision: 'profile-rev:demo-7',
      targetOwner: 'creator-studio',
    })
    if (typeof draft === 'object' && 'status' in draft) expect(draft.status).toBe('refresh_required')
  })

  it('requires refresh when the edition is stale', () => {
    const draft = createRadarProposalDraft({
      opportunityRef: 'opp:demo-1',
      profileRevision: 'profile-rev:demo-7',
      activeProfileRevision: 'profile-rev:demo-7',
      targetOwner: 'creator-studio',
      editionStale: true,
    })
    if (typeof draft === 'object' && 'status' in draft) expect(draft.status).toBe('refresh_required')
  })

  it('never creates a canonical project from a draft', () => {
    const draft = createRadarProposalDraft({
      opportunityRef: 'opp:demo-1',
      profileRevision: 'profile-rev:demo-7',
      activeProfileRevision: 'profile-rev:demo-7',
      targetOwner: 'creator-studio',
    })
    expect(JSON.stringify(draft)).not.toMatch(/canonical|production|accepted/)
  })
})
