import { useEffect, useRef, useState } from 'react'
import { Button, CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { ArtifactRefV1, PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorArtifactContentV1 } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'

/** Mount with the complete Creator context as key to discard stale reads on scope changes. */
export function CreatorSubtitleResults({ receipt, read, t }: {
  receipt: PaneActionReceiptV1 | null
  read(artifact: ArtifactRefV1): Promise<CreatorArtifactContentV1 | undefined>
  t: CreatorStudioTranslator
}) {
  const artifacts = receipt?.owner === 'sonora' && ['completed', 'partial'].includes(receipt.status)
    ? (receipt.outputArtifacts ?? []).filter(artifact => artifact.owner === 'sonora' && artifact.kind === 'subtitle' && ['text/vtt', 'application/x-subrip'].includes(artifact.mediaType)) : []
  const [selected, setSelected] = useState<ArtifactRefV1>()
  const [body, setBody] = useState<string>()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('ready')
  const [downloadError, setDownloadError] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  async function open(artifact: ArtifactRefV1) {
    const current = ++generation.current
    setSelected(artifact); setBody(undefined); setPhase('loading'); setDownloadError(false); setDownloading(false)
    try {
      const result = await read(artifact)
      if (generation.current !== current) return
      if (result === undefined || result.artifact.owner !== artifact.owner || result.artifact.ref !== artifact.ref
        || result.artifact.version !== artifact.version || result.artifact.mediaType !== artifact.mediaType || result.contentRevision !== artifact.version) { setPhase('error'); return }
      setBody(result.content); setPhase('ready')
    } catch { if (generation.current === current) setPhase('error') }
  }
  async function download() {
    if (body === undefined || selected === undefined) return
    const current = ++generation.current
    setDownloading(true); setDownloadError(false)
    let url: string | undefined
    try {
      const result = await read(selected)
      if (generation.current !== current) return
      if (result === undefined || result.artifact.owner !== selected.owner || result.artifact.ref !== selected.ref || result.artifact.version !== selected.version
        || result.artifact.mediaType !== selected.mediaType || result.contentRevision !== selected.version || result.content !== body) { setDownloadError(true); return }
      url = URL.createObjectURL(new Blob([result.content], { type: `${selected.mediaType}; charset=utf-8` }))
      const link = document.createElement('a')
      link.href = url; link.download = selected.mediaType === 'text/vtt' ? 'subtitles.vtt' : 'subtitles.srt'
      document.body.append(link); link.click(); link.remove()
      const released = url
      setTimeout(() => URL.revokeObjectURL(released), 1000)
    } catch { if (url !== undefined) URL.revokeObjectURL(url); if (generation.current === current) setDownloadError(true) }
    finally { if (generation.current === current) setDownloading(false) }
  }
  if (artifacts.length === 0 && selected === undefined) return null
  return <SurfaceSection className="cs-section" title={t('subtitle.results.title')} description={t('subtitle.results.description')} data-subtitle-results>
    <div className="cs-actions">{artifacts.map(artifact => <Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" key={`${artifact.ref}:${artifact.version}`} onClick={() => void open(artifact)}>{t('subtitle.results.open', { title: artifact.title })}</Button>)}</div>
    {selected !== undefined && <p className="cs-subtitle-version cs-muted">{t('subtitle.results.selected', { title: selected.title, version: selected.version })}</p>}
    {phase === 'loading' && <SurfaceState phase="loading" title={t('state.loading')} />}
    {phase === 'error' && <SurfaceState phase="error" title={t('subtitle.results.unavailable')} action={selected === undefined ? undefined : <Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" onClick={() => void open(selected)}>{t('state.retry')}</Button>} />}
    {phase === 'ready' && body !== undefined && <><CodeBlock className="cs-subtitle-code" code={body} copyLabel={t('subtitle.results.copy')} copiedLabel={t('workspace.code.copied')} /><Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" disabled={downloading} onClick={() => void download()}>{downloading ? t('state.loading') : t('subtitle.results.download')}</Button></>}
    {downloadError && <SurfaceState phase="error" title={t('subtitle.results.unavailable')} />}
  </SurfaceSection>
}
