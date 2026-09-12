import type { EikonaBatchPlanResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import { eikonaBatchPageResultSchema, type EikonaBatchPageQuery, type EikonaBatchPageResult, type EikonaBatchInputQuery, type EikonaBatchInputResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { EikonaBatchPreview } from './eikona-batch-preview.tsx'
import type { CreatorStudioTranslator } from './locales.ts'
export function EikonaBatchBrowser({ list, read, plan, t }: { plan?(input: EikonaBatchInputQuery): Promise<EikonaBatchPlanResult>; list(input: EikonaBatchPageQuery): Promise<EikonaBatchPageResult>; read(input: EikonaBatchInputQuery): Promise<EikonaBatchInputResult>; t: CreatorStudioTranslator }) {
  const live = useRef(true), pending = useRef(false), retry = useRef<Array<string | undefined>>([undefined])
  const [history, setHistory] = useState<Array<string | undefined>>([undefined])
  const [page, setPage] = useState<Extract<EikonaBatchPageResult, { status: 'ready' }>>()
  const [busy, setBusy] = useState(false), [error, setError] = useState(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const load = async (next: Array<string | undefined>) => {
    if (pending.current) return
    pending.current = true; retry.current = next; setBusy(true); setError(false)
    try {
      const cursor = next.at(-1)
      const parsed = eikonaBatchPageResultSchema.safeParse(await list({ limit: 20, ...(cursor ? { cursor } : {}) }))
      if (!live.current) return
      if (!parsed.success || parsed.data.status !== 'ready' || parsed.data.items.length > 20 || (parsed.data.nextCursor !== undefined && next.includes(parsed.data.nextCursor))) {
        setError(true)
        if (parsed.success && (parsed.data.status === 'permission_denied' || parsed.data.status === 'needs_contract')) setPage(undefined)
        return
      }
      setPage(parsed.data); setHistory(next)
    } catch { if (live.current) setError(true) }
    finally { pending.current = false; if (live.current) setBusy(false) }
  }
  return <SurfaceSection className="cs-section" title={t('eikona.batch.listTitle')} description={t('eikona.batch.description')}>
    <div className="cs-actions">
      <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load([undefined])}>{t('eikona.batch.loadList')}</Button>
      {history.length > 1 && <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load(history.slice(0, -1))}>{t('eikona.previousAssets')}</Button>}
      {page?.nextCursor && <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load([...history, page.nextCursor])}>{t('eikona.nextAssets')}</Button>}
      {error && <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load(retry.current)}>{t('eikona.retryAssets')}</Button>}
    </div>
    <div role="status">{busy ? t('eikona.batch.loading') : error ? t('eikona.batch.failed') : page?.items.length === 0 ? t('eikona.batch.empty') : ''}</div>
    {page?.items.map(item => <EikonaBatchPreview key={`${item.batchRef}:${item.digest}`} resource={{ ref: item.batchRef, version: item.digest, kind: 'batch-input', title: item.batchRef, status: 'available', evidenceRefs: [] }} read={read} {...(plan ? { plan } : {})} t={t} />)}
  </SurfaceSection>
}
