import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EikonaReviewResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'

export type EikonaReviewRead = (query: { runId: string }) => Promise<EikonaReviewResult>
export function EikonaCandidateReview({ artifactRef, contentDigest, read, t }: { artifactRef: string; contentDigest?: string; read: EikonaReviewRead; t: CreatorStudioTranslator }) {
  const match = /^eikona:\/\/artifacts\/([A-Za-z0-9][A-Za-z0-9._-]{0,159})\/([A-Za-z0-9][A-Za-z0-9._-]{0,159})$/u.exec(artifactRef)
  const [result, setResult] = useState<EikonaReviewResult>(), [busy, setBusy] = useState(false)
  const mounted = useRef(true), pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  if (!match) return null
  const runId = match[1]!, candidateId = match[2]!
  const load = async () => {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try { const value = await read({ runId }); if (mounted.current) setResult(value) }
    catch { if (mounted.current) setResult({ status: 'unconfirmed' }) }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  const candidate = result?.status === 'ready' && result.runId === runId ? result.candidates.find(item => item.candidateId === candidateId) : undefined
  const bound = candidate?.artifactRef === artifactRef && contentDigest !== undefined && candidate?.contentDigest === contentDigest
  return <div className="cs-actions" data-eikona-candidate-review>
    <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load()}>{t('eikona.readReview')}</Button>
    <span role="status">{busy ? t('eikona.loadingReview') : result === undefined ? '' : result.status !== 'ready' ? t('eikona.reviewFailed') : !candidate ? t('eikona.reviewMissing') : <>
      {candidate.decisionVersion === undefined ? t('eikona.reviewVersionUnknown') : candidate.decisionVersion === 0 ? t('eikona.reviewNoDecision') : `${t('eikona.reviewVersion')} ${candidate.decisionVersion}`}
      {' · '}{t(candidate.decisionState === 'accepted' ? 'eikona.reviewAccepted' : candidate.decisionState === 'rejected' ? 'eikona.reviewRejected' : candidate.decisionState === 'request_revision' ? 'eikona.reviewRevisionRequested' : candidate.decisionState === 'stale' ? 'eikona.reviewSuperseded' : candidate.decisionState === 'pending' ? 'eikona.reviewPending' : 'eikona.reviewStateUnknown')}
      {' · '}{bound ? t('eikona.reviewContentMatches') : t('eikona.reviewContentUnverified')}
    </>}</span>
  </div>
}
