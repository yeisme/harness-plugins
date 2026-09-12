import { EikonaImageComparison, type EikonaComparisonItem } from './eikona-image-comparison.tsx'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import { eikonaBatchMembersResultSchema, matchesEikonaBatchMembers, type EikonaBatchMembersResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioController } from './controller.ts'
import type { CreatorStudioTranslator } from './locales.ts'
import { EikonaRunCandidates } from './eikona-run-candidates.tsx'

type Runtime = Partial<Pick<CreatorStudioController, 'readEikonaBatchMembers' | 'readEikonaReview' | 'readEikonaCandidateImage' | 'selectEikonaCandidate' | 'refresh'>>
export function EikonaBatchResults({ operationRef, runtime, t }: { operationRef: string; runtime: Runtime; t: CreatorStudioTranslator }) {
  const live = useRef(true), pending = useRef(false), retry = useRef(0), identity = useRef<string | undefined>(undefined)
  const [comparison, setComparison] = useState<EikonaComparisonItem[]>([])
  const [page, setPage] = useState<Extract<EikonaBatchMembersResult, { status: 'ready' }>>()
  const [busy, setBusy] = useState(false), [error, setError] = useState(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const load = async (offset: number) => {
    if (pending.current || !runtime.readEikonaBatchMembers) return
    pending.current = true; retry.current = offset; setBusy(true); setError(false)
    try {
      const query = { operationRef, offset, limit: 20 }
      const parsed = eikonaBatchMembersResultSchema.safeParse(await runtime.readEikonaBatchMembers(query))
      if (!live.current) return
      if (!parsed.success || parsed.data.status !== 'ready' || !matchesEikonaBatchMembers(parsed.data, query)) {
        setError(true)
        if (parsed.success && parsed.data.status === 'permission_denied') { setPage(undefined); setComparison([]) }
        return
      }
      const value = parsed.data, fixed = JSON.stringify([value.projectRef, value.operationRef, value.batchRef, value.digest, value.planDigest, value.total])
      if (identity.current !== undefined && identity.current !== fixed) { setError(true); return }
      identity.current = fixed; setPage(value)
    } catch { if (live.current) setError(true) }
    finally { pending.current = false; if (live.current) setBusy(false) }
  }
  return <SurfaceSection className="cs-section" title={t('eikona.members.title')}>
    <div className="cs-actions">
      <Button className="cs-button vk-btn" disabled={busy} onClick={() => void load(page?.offset ?? 0)}>{t('eikona.members.read')}</Button>
      {page && page.offset > 0 && <Button className="cs-button vk-btn" disabled={busy} onClick={() => void load(Math.max(0, page.offset - 20))}>{t('eikona.previousAssets')}</Button>}
      {page?.nextOffset !== undefined && <Button className="cs-button vk-btn" disabled={busy} onClick={() => void load(page.nextOffset!)}>{t('eikona.nextAssets')}</Button>}
      {error && <Button className="cs-button vk-btn" disabled={busy} onClick={() => void load(retry.current)}>{t('eikona.retryAssets')}</Button>}
    </div>
    <p role="status">{busy ? t('eikona.batch.loading') : error ? t('eikona.members.readFailed') : page?.items.length === 0 ? t('eikona.batch.empty') : ''}</p>
    {comparison.length > 0 && <Button className="cs-button vk-btn" onClick={() => setComparison([])}>{t('eikona.clearComparison')}</Button>}
    {comparison.length === 2 && runtime.readEikonaCandidateImage && <EikonaImageComparison key={JSON.stringify(comparison)} items={[comparison[0]!, comparison[1]!]} read={input => runtime.readEikonaCandidateImage!(input)} t={t} />}
    <ul className="ys-list">{page?.items.map(member => <li className="cs-wrapping-content" key={`${member.requestId}:${member.runRef ?? ''}`}>
      <strong>{member.requestId}</strong><p>{t(`eikona.members.${member.status}`)}</p>
      {member.runRef && runtime.readEikonaReview ? <EikonaRunCandidates batchComparison={{ items: comparison, toggle: item => setComparison(current => current.some(value => value.ref === item.ref && value.contentDigest === item.contentDigest) ? current.filter(value => value.ref !== item.ref || value.contentDigest !== item.contentDigest) : current.length < 2 ? [...current, item] : current) }} runId={member.runRef} read={input => runtime.readEikonaReview!(input)} {...(runtime.readEikonaCandidateImage ? { readImage: runtime.readEikonaCandidateImage.bind(runtime) } : {})} {...(runtime.selectEikonaCandidate ? { select: async (input: Parameters<CreatorStudioController['selectEikonaCandidate']>[0]) => { const result = await runtime.selectEikonaCandidate!(input); if (result.status === 'selected') await runtime.refresh?.(); return result } } : {})} t={t} /> : <p>{t('eikona.members.noRun')}</p>}
    </li>)}</ul>
  </SurfaceSection>
}
