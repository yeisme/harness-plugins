import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { eikonaReviewResultSchema, eikonaSelectionResultSchema, type EikonaImageQuery, type EikonaImageResult, type EikonaSelectionResult, type EikonaReviewResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { EikonaImageComparison, type EikonaComparisonItem } from './eikona-image-comparison.tsx'
import { EikonaImagePreview } from './eikona-image-preview.tsx'
import type { CreatorStudioTranslator } from './locales.ts'

/** Explicit read of one generated run; no implicit adoption or media access. */
export function EikonaRunCandidates({ runId, read, t, select, readImage, batchComparison }: {
  batchComparison?: { items: readonly EikonaComparisonItem[]; toggle(item: EikonaComparisonItem): void }
  readImage?(input: EikonaImageQuery): Promise<EikonaImageResult>
  select?(input: { selection: { artifactRef: string; contentDigest: string } }): Promise<EikonaSelectionResult>
  runId: string; read(input: { runId: string }): Promise<EikonaReviewResult>; t: CreatorStudioTranslator
}) {
  const live = useRef(true), pending = useRef(false)
  const [busy, setBusy] = useState(false), [result, setResult] = useState<EikonaReviewResult>()
  const [comparison, setComparison] = useState<EikonaComparisonItem[]>([])
  const activeComparison = batchComparison?.items ?? comparison
  const selecting = useRef(false)
  const [selection, setSelection] = useState<EikonaSelectionResult>(), [selectionBusy, setSelectionBusy] = useState(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  return <div className="cs-action-receipt cs-run-candidates">
    <p>{t('eikona.run.source')} {runId}</p>
    <Button className="cs-button vk-btn" type="button" disabled={busy || selectionBusy} onClick={async () => {
      if (pending.current || selecting.current) return
      pending.current = true; setBusy(true); setSelection(undefined); setComparison([])
      let next: EikonaReviewResult
      try {
        const parsed = eikonaReviewResultSchema.safeParse(await read({ runId }))
        next = parsed.success && (parsed.data.status !== 'ready' || parsed.data.runId === runId) ? parsed.data : { status: 'unconfirmed' }
      } catch { next = { status: 'unconfirmed' } }
      pending.current = false
      if (live.current) { setResult(next); setBusy(false) }
    }}>{t(busy ? 'eikona.run.loading' : 'eikona.run.load')}</Button>
    {!batchComparison && comparison.length > 0 && <Button className="cs-button vk-btn" type="button" onClick={() => setComparison([])}>{t('eikona.clearComparison')}</Button>}
    {!batchComparison && comparison.length === 2 && readImage && <EikonaImageComparison key={JSON.stringify(comparison)} items={[comparison[0]!, comparison[1]!]} read={readImage} t={t} />}
    {selection && <p role="status">{t(selection.status === 'selected' ? 'eikona.candidateSelected' : 'eikona.selectionFailed')}</p>}
    {result && (result.status === 'ready' ? <>
      <p role="status">{t(result.candidates.length ? 'eikona.run.loaded' : 'eikona.run.empty')}</p>
      <ul className="ys-list">{result.candidates.map(candidate => <li className="ys-row" key={candidate.candidateId}>
        <span className="cs-wrapping-content">{candidate.label || candidate.candidateId}</span>
        {select && candidate.artifactRef && candidate.contentDigest && <Button className="cs-button vk-btn" type="button" disabled={selectionBusy || busy} aria-pressed={selection?.status === 'selected' && selection.selection.artifactRef === candidate.artifactRef && selection.selection.contentDigest === candidate.contentDigest} onClick={async () => {
          if (selecting.current) return
          selecting.current = true; setSelectionBusy(true)
          const fixed = { artifactRef: candidate.artifactRef!, contentDigest: candidate.contentDigest! }
          let next: EikonaSelectionResult
          try {
            const parsed = eikonaSelectionResultSchema.safeParse(await select({ selection: fixed }))
            next = parsed.success ? parsed.data : { status: 'unconfirmed' }
            if (next.status === 'selected' && (next.selection.artifactRef !== fixed.artifactRef || next.selection.contentDigest !== fixed.contentDigest)) next = { status: 'unconfirmed' }
          } catch { next = { status: 'unconfirmed' } }
          selecting.current = false
          if (live.current) { setSelection(next); setSelectionBusy(false) }
        }}>{t('eikona.selectForAdoption')}</Button>}
        {readImage && candidate.artifactRef && candidate.contentDigest && (batchComparison || result.candidates.length > 1) && <Button className="cs-button vk-btn" type="button" aria-pressed={activeComparison.some(item => item.ref === candidate.artifactRef && item.contentDigest === candidate.contentDigest)} disabled={busy || (activeComparison.length === 2 && !activeComparison.some(item => item.ref === candidate.artifactRef && item.contentDigest === candidate.contentDigest))} onClick={() => batchComparison ? batchComparison.toggle({ ref: candidate.artifactRef!, contentDigest: candidate.contentDigest!, title: candidate.label || candidate.candidateId }) : setComparison(current => current.some(item => item.ref === candidate.artifactRef && item.contentDigest === candidate.contentDigest) ? current.filter(item => item.ref !== candidate.artifactRef || item.contentDigest !== candidate.contentDigest) : [...current, { ref: candidate.artifactRef!, contentDigest: candidate.contentDigest!, title: candidate.label || candidate.candidateId }])}>{t('eikona.selectComparison')}</Button>}
        {readImage && candidate.artifactRef && candidate.contentDigest && <EikonaImagePreview key={`${candidate.artifactRef}:${candidate.contentDigest}`} artifactRef={candidate.artifactRef} contentDigest={candidate.contentDigest} title={candidate.label || candidate.candidateId} read={readImage} t={t} />}
        {candidate.contentDigest && <span className="cs-wrapping-content">{t('eikona.run.version')} <code>{candidate.contentDigest}</code></span>}
        {candidate.artifactRef && <span className="cs-wrapping-content">{candidate.artifactRef}</span>}
      </li>)}</ul>
    </> : <p role="status">{t('eikona.run.unavailable')}</p>)}
  </div>
}
