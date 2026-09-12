import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { SonoraTranscriptionCatalog } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'

export function CreatorTranscriptionCapabilities({ runtime, t }: {
  runtime: { readTranscriptionCatalog(): Promise<SonoraTranscriptionCatalog | undefined> }
  t: CreatorStudioTranslator
}) {
  const [catalog, setCatalog] = useState<SonoraTranscriptionCatalog>()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const request = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++request.current
    setPhase('loading')
    try {
      const next = await runtime.readTranscriptionCatalog()
      if (current !== request.current) return
      if (next === undefined) { setPhase('error'); return }
      setCatalog(next); setPhase('ready')
    } catch { if (current === request.current) setPhase('error') }
  }, [runtime])
  useEffect(() => { void refresh(); return () => { request.current++ } }, [refresh])
  const yesNo = (value: boolean) => t(value ? 'transcription.cap.yes' : 'transcription.cap.no')
  return <SurfaceSection className="cs-section" title={t('transcription.cap.title')} description={t('transcription.cap.probe')} data-transcription-capabilities>
    <div className="cs-actions"><Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" disabled={phase === 'loading'} onClick={() => void refresh()}>{t('state.refresh')}</Button></div>
    {phase === 'loading' && <SurfaceState phase="loading" title={t('state.loading')} />}
    {phase === 'error' && <SurfaceState phase={catalog === undefined ? 'error' : 'stale'} title={t(catalog === undefined ? 'transcription.cap.unavailable' : 'transcription.cap.stale')} />}
    {catalog !== undefined && <>
      {catalog.diagnostics_available !== true && <SurfaceState phase="partial" title={t('transcription.cap.diagnosticsUnknown')} />}
      {catalog.profiles.length === 0 && <SurfaceState phase="empty" title={t('transcription.cap.empty')} />}
      <ul className="cs-capability-list">{catalog.profiles.map(profile => <li key={profile.provider_id}>
        <strong>{profile.provider_id}</strong> · <span>{t(profile.fixture ? 'transcription.cap.fixture' : 'transcription.cap.declared')}</span>
        <dl className="cs-capability-details">
          <dt>{t('transcription.cap.model')}</dt><dd>{profile.model_ref}</dd>
          <dt>{t('transcription.cap.revision')}</dt><dd>{profile.revision} · {profile.readiness}</dd>
          <dt>{t('transcription.cap.locales')}</dt><dd>{profile.supported_locales.join(', ') || t('transcription.cap.undeclared')}</dd>
          <dt>{t('transcription.cap.formats')}</dt><dd>{profile.supported_formats.join(', ') || t('transcription.cap.undeclared')}</dd>
          <dt>{t('transcription.cap.timing')}</dt><dd>{profile.timestamp_modes.map(mode => t(`transcription.cap.timing.${mode}`)).join(', ') || t('transcription.cap.undeclared')}
            {!profile.timestamp_modes.includes('word') && <p className="cs-muted">{t('transcription.cap.noWord')}</p>}</dd>
          <dt>{t('transcription.cap.speakers')}</dt><dd>{yesNo(profile.supports_speaker_labels)}</dd>
          <dt>{t('transcription.cap.cost')}</dt><dd>{profile.cost_model}<p className="cs-muted">{t('transcription.cap.unquoted')}</p></dd>
          <dt>{t('transcription.cap.limits')}</dt><dd>{t('transcription.cap.limitValues', { seconds: profile.max_duration_ms / 1000, segments: profile.max_segments })}</dd>
          <dt>{t('transcription.cap.network')}</dt><dd>{yesNo(profile.requires_network)}</dd>
          <dt>{t('transcription.cap.credentials')}</dt><dd>{yesNo(profile.requires_credentials)}</dd>
        </dl>
      </li>)}</ul>
      {(catalog.unavailable?.length ?? 0) > 0 && <ul className="cs-capability-list">{catalog.unavailable!.map(provider => <li key={provider.provider_id}>
        <strong>{provider.provider_id}</strong><p className="cs-muted">{t('transcription.cap.providerUnavailable')}</p><code>{provider.code}</code>
      </li>)}</ul>}
    </>}
  </SurfaceSection>
}
