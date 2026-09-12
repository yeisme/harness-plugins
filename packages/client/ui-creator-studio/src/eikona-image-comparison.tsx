import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { MediaCompareRenderer } from '@yeisme/dsh-rich-media/client'
import type { EikonaImageQuery, EikonaImageResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'
export interface EikonaComparisonItem { ref: string; contentDigest: string; title: string }
export function EikonaImageComparison({ items, read, t }: { items: readonly [EikonaComparisonItem, EikonaComparisonItem]; read(query: EikonaImageQuery): Promise<EikonaImageResult>; t: CreatorStudioTranslator }) {
  const [urls, setURLs] = useState<[string, string]>(), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false)
  const mounted = useRef(true), pending = useRef(false), retained = useRef<string[]>([]), keys = useRef<string[]>([])
  const release = () => { retained.current.forEach(url => URL.revokeObjectURL(url)); retained.current = [] }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; release() } }, [])
  const load = async () => {
    if (pending.current) return
    pending.current = true; setBusy(true); setFailed(false)
    try {
      const results = await Promise.all(items.map((item, index) => {
        keys.current[index] ??= `eikona-compare-${crypto.randomUUID()}`
        return read({ artifactRef: item.ref, contentDigest: item.contentDigest, idempotencyKey: keys.current[index]!, confirmed: true })
      }))
      if (!mounted.current) return
      const blobs: Blob[] = []
      for (let index = 0; index < 2; index++) {
        const result = results[index], item = items[index]!
        if (result?.status !== 'ready' || result.value.artifactRef !== item.ref || result.value.contentDigest !== item.contentDigest) { setFailed(true); return }
        const bytes = Uint8Array.from(atob(result.value.base64), character => character.charCodeAt(0))
        if (bytes.length !== result.value.byteLength) { setFailed(true); return }
        blobs.push(new Blob([bytes], { type: result.value.mediaType }))
      }
      release()
      for (const blob of blobs) retained.current.push(URL.createObjectURL(blob))
      setURLs([retained.current[0]!, retained.current[1]!])
    } catch { release(); if (mounted.current) { setURLs(undefined); setFailed(true) } }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  return <div data-eikona-comparison className="cs-wrapping-content">
    <p>{t('eikona.confirmComparison')}</p>
    <p>{items[0].title} · {items[1].title}</p>
    {urls ? <><MediaCompareRenderer left={{ url: urls[0], label: items[0].title, version: items[0].contentDigest }} right={{ url: urls[1], label: items[1].title, version: items[1].contentDigest }} labels={{ mode: t('eikona.compareMode'), sideBySide: t('eikona.compareSide'), swipe: t('eikona.compareSwipe'), opacity: t('eikona.compareOpacity'), position: t('eikona.comparePosition') }} />
      <Button className="cs-button vk-btn" type="button" onClick={() => { release(); setURLs(undefined) }}>{t('eikona.closePreview')}</Button></>
      : <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void load()}>{t('eikona.loadComparison')}</Button>}
    <div role="status">{busy ? t('eikona.loadingPreview') : failed ? t('eikona.previewFailed') : ''}</div>
  </div>
}
