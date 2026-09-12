import { ImageViewport } from './image-viewport.tsx'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EikonaImageQuery, EikonaImageResult } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'
export function EikonaImagePreview({ artifactRef, contentDigest, title, read, t }: {
  artifactRef: string; contentDigest: string; title: string; read(input: EikonaImageQuery): Promise<EikonaImageResult>; t: CreatorStudioTranslator
}) {
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [url, setURL] = useState<string>()
  const mounted = useRef(true), pending = useRef(false), objectURL = useRef<string>(), key = useRef<string>()
  const release = () => { if (objectURL.current) URL.revokeObjectURL(objectURL.current); objectURL.current = undefined }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; release() } }, [])
  const open = async () => {
    if (pending.current) return
    pending.current = true; setBusy(true); setFailed(false)
    key.current ??= `eikona-preview-${crypto.randomUUID()}`
    try {
      const result = await read({ artifactRef, contentDigest, confirmed: true, idempotencyKey: key.current })
      if (!mounted.current) return
      if (result.status !== 'ready' || result.value.artifactRef !== artifactRef || result.value.contentDigest !== contentDigest) { setFailed(true); return }
      const bytes = Uint8Array.from(atob(result.value.base64), character => character.charCodeAt(0))
      if (bytes.length !== result.value.byteLength) { setFailed(true); return }
      const next = URL.createObjectURL(new Blob([bytes], { type: result.value.mediaType }))
      release(); objectURL.current = next; setURL(next); setConfirm(false)
    } catch { if (mounted.current) setFailed(true) }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  return <div className="cs-eikona-image-preview">
    {url ? <><ImageViewport url={url} title={title} t={t} />
      <Button className="cs-button vk-btn" type="button" onClick={() => { release(); setURL(undefined) }}>{t('eikona.closePreview')}</Button></>
      : <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => setConfirm(true)}>{t('eikona.previewImage')}</Button>}
    {confirm && <div><p>{t('eikona.confirmPreviewDescription')}</p><Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => void open()}>{t('eikona.confirmPreview')}</Button>
      <Button className="cs-button vk-btn" type="button" disabled={busy} onClick={() => setConfirm(false)}>{t('eikona.cancelPreview')}</Button></div>}
    <div role="status">{busy ? t('eikona.loadingPreview') : failed ? t('eikona.previewFailed') : ''}</div>
  </div>
}
