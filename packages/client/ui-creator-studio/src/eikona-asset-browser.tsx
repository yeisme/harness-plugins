import { EikonaCandidateReview, type EikonaReviewRead } from './eikona-candidate-review.tsx'
import { EikonaImageComparison, type EikonaComparisonItem } from './eikona-image-comparison.tsx'
import { EikonaImagePreview } from './eikona-image-preview.tsx'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import type { EikonaAssetPage, EikonaImageQuery, EikonaImageResult, EikonaSelectionQuery, EikonaSelectionResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'

type CandidateSelect = (query: EikonaSelectionQuery) => Promise<EikonaSelectionResult>
type ImageRead = (query: EikonaImageQuery) => Promise<EikonaImageResult>
type ReadyPage = Extract<EikonaAssetPage, { status: 'ready' }>
export function EikonaAssetBrowser({ scopeKey, read, readImage, readReview, selectCandidate, t }: { scopeKey: string; readImage?: ImageRead; readReview?: EikonaReviewRead; selectCandidate?: CandidateSelect; read(input: { cursor?: string; limit: number }): Promise<EikonaAssetPage>; t: CreatorStudioTranslator }) {
  return <AssetPage key={scopeKey} read={read} t={t} {...(readImage ? { readImage } : {})} {...(readReview ? { readReview } : {})} {...(selectCandidate ? { selectCandidate } : {})} />
}
function AssetPage({ read, readImage, readReview, selectCandidate, t }: { readImage?: ImageRead; readReview?: EikonaReviewRead; selectCandidate?: CandidateSelect; read(input: { cursor?: string; limit: number }): Promise<EikonaAssetPage>; t: CreatorStudioTranslator }) {
  const [selecting, setSelecting] = useState(false)
  const [selectionResult, setSelectionResult] = useState<EikonaSelectionResult>()
  const selectionFlight = useRef(false)
  const choose = async (selection: EikonaSelectionQuery['selection']) => {
    if (!selectCandidate || selectionFlight.current) return
    selectionFlight.current = true; setSelecting(true); setSelectionResult(undefined)
    try { const result = await selectCandidate({ selection }); if (mounted.current) setSelectionResult(result) }
    catch { if (mounted.current) setSelectionResult({ status: 'unconfirmed' }) }
    finally { selectionFlight.current = false; if (mounted.current) setSelecting(false) }
  }
  const [comparison, setComparison] = useState<EikonaComparisonItem[]>([])
  const [page, setPage] = useState<ReadyPage>()
  const [history, setHistory] = useState<Array<string | undefined>>([undefined])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const mounted = useRef(true), pending = useRef(false)
  const retryTarget = useRef<Array<string | undefined>>([undefined])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const load = async (next: Array<string | undefined>) => {
    if (pending.current) return
    pending.current = true; retryTarget.current = [...next]; setBusy(true); setError(false)
    const cursor = next.at(-1)
    try {
      const result = await read({ limit: 50, ...(cursor === undefined ? {} : { cursor }) })
      if (!mounted.current) return
      if (result.status === 'ready') {
        if (result.nextCursor !== undefined && next.includes(result.nextCursor)) { setError(true); return }
        setPage(result); setHistory(next)
      } else {
        setError(true)
        if (result.status === 'permission_denied' || result.status === 'needs_contract') { setPage(undefined); setComparison([]); setHistory([undefined]); retryTarget.current = [undefined] }
      }
    } catch { if (mounted.current) setError(true) }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  return <SurfaceSection className="cs-section" title={t('eikona.ownerAssets')} description={t('eikona.assetMetadataOnly')}>
    <div className="cs-actions">
      <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load([undefined])}>{t('eikona.loadAssets')}</Button>
      {history.length > 1 && <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load(history.slice(0, -1))}>{t('eikona.previousAssets')}</Button>}
      {page?.nextCursor && <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load([...history, page.nextCursor])}>{t('eikona.nextAssets')}</Button>}
      {error && <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load(retryTarget.current)}>{t('eikona.retryAssets')}</Button>}
    </div>
    <div role="status">{busy ? t('eikona.loadingAssets') : error ? t('eikona.assetsFailed') : page?.items.length === 0 ? t('eikona.assetsEmpty') : ''}</div>
    {selectCandidate && <div className="cs-actions">
      <Button className="cs-button vk-btn" type="button" disabled={selecting} onClick={() => void choose(null)}>{t('eikona.clearAdoptionSelection')}</Button>
      <span role="status">{selecting ? t('eikona.selectingCandidate') : selectionResult?.status === 'selected' ? t('eikona.candidateSelected') : selectionResult?.status === 'cleared' ? t('eikona.selectionCleared') : selectionResult ? t('eikona.selectionFailed') : ''}</span>
    </div>}
    {comparison.length > 0 && <Button className="cs-button vk-btn" type="button" onClick={() => setComparison([])}>{t('eikona.clearComparison')}</Button>}
    {comparison.length === 2 && readImage && <EikonaImageComparison key={JSON.stringify(comparison)} items={[comparison[0]!, comparison[1]!]} read={readImage} t={t} />}
    {page && <ul className="cs-list ys-list">{page.items.map(item => <li className="ys-row" key={item.ref} data-eikona-asset-ref={item.ref}>
      <span className="ys-row-main"><strong>{item.title}</strong><small>{item.versionStatus === 'unverified' ? t('eikona.assetUnverified') : t('eikona.assetDigestObserved')}</small></span>
      {readImage && item.contentDigest && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(item.mediaType ?? '') && <Button className="cs-button vk-btn" type="button" aria-pressed={comparison.some(value => value.ref === item.ref && value.contentDigest === item.contentDigest)} disabled={comparison.length === 2 && !comparison.some(value => value.ref === item.ref && value.contentDigest === item.contentDigest)} onClick={() => setComparison(current => current.some(value => value.ref === item.ref && value.contentDigest === item.contentDigest) ? current.filter(value => value.ref !== item.ref || value.contentDigest !== item.contentDigest) : [...current, { ref: item.ref, contentDigest: item.contentDigest!, title: item.title }])}>{t('eikona.selectComparison')}</Button>}
      {readImage && item.contentDigest && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(item.mediaType ?? '') && <EikonaImagePreview key={`${item.ref}:${item.contentDigest}`} artifactRef={item.ref} contentDigest={item.contentDigest} title={item.title} read={readImage} t={t} />}
      {selectCandidate && <Button className="cs-button vk-btn" type="button" disabled={selecting || !item.contentDigest} title={!item.contentDigest ? t('eikona.assetUnverified') : undefined} onClick={() => { if (item.contentDigest) void choose({ artifactRef: item.ref, contentDigest: item.contentDigest }) }}>{t('eikona.selectForAdoption')}</Button>}
      {readReview && <EikonaCandidateReview key={`${item.ref}:${item.contentDigest ?? "unknown"}`} artifactRef={item.ref} {...(item.contentDigest ? { contentDigest: item.contentDigest } : {})} read={readReview} t={t} />}
    </li>)}</ul>}
  </SurfaceSection>
}
