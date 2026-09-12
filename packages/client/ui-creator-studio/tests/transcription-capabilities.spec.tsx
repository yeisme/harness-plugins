// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SonoraTranscriptionCatalog } from '@yeisme/dsh-creator-studio-host/contracts'
import { CreatorTranscriptionCapabilities } from '../src/transcription-capabilities.tsx'
import { createCreatorStudioTranslator } from '../src/locales.ts'

const catalog: SonoraTranscriptionCatalog = { validation_level: 'capability_probe', diagnostics_available: true, profiles: [{
  provider_id: 'fixture', model_ref: 'sonora://asr-model/fixture-v1', revision: 'fixture-asr.v1', readiness: 'first-support', fixture: true,
  supported_locales: ['zh-CN', 'en-US'], supported_formats: ['wav'], timestamp_modes: ['segment'], supports_speaker_labels: false,
  requires_network: false, requires_credentials: false, cost_model: 'free_fixture', max_duration_ms: 3000, max_segments: 10,
}], unavailable: [{ provider_id: 'command-asr', code: 'transcription_capability_unavailable', fixture: false }] }
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it.each(['zh', 'en'] as const)('shows owner facts without implying recognition or zero-cost approval (%s)', async locale => {
  const t = createCreatorStudioTranslator(locale)
  const runtime = { readTranscriptionCatalog: vi.fn(async () => catalog) }
  const ui = render(<CreatorTranscriptionCapabilities runtime={runtime} t={t} />)
  await screen.findByText('sonora://asr-model/fixture-v1')
  expect(screen.getByText(t('transcription.cap.fixture'))).toBeTruthy()
  expect(screen.getByText(t('transcription.cap.noWord'))).toBeTruthy()
  expect(screen.getByText(t('transcription.cap.unquoted'))).toBeTruthy()
  expect(screen.getByText('command-asr')).toBeTruthy()
  expect(screen.getByText(t('transcription.cap.providerUnavailable'))).toBeTruthy()
  expect(ui.container.textContent).not.toContain('0 USD')
  expect(screen.getAllByRole('button')).toHaveLength(1)
})

it('marks retained information stale after a failed refresh', async () => {
  const t = createCreatorStudioTranslator('en')
  const runtime = { readTranscriptionCatalog: vi.fn().mockResolvedValueOnce(catalog).mockResolvedValueOnce(undefined) }
  render(<CreatorTranscriptionCapabilities runtime={runtime} t={t} />)
  await screen.findByText('fixture')
  fireEvent.click(screen.getByRole('button', { name: t('state.refresh') }))
  await screen.findByText(t('transcription.cap.stale'))
  expect(screen.getByText('fixture')).toBeTruthy()
  expect(runtime.readTranscriptionCatalog).toHaveBeenCalledTimes(2)
})

it('keeps missing diagnostics distinct from an empty verified failure list', async () => {
  const t = createCreatorStudioTranslator('en')
  render(<CreatorTranscriptionCapabilities runtime={{ readTranscriptionCatalog: async () => ({ validation_level: 'capability_probe', profiles: [] }) }} t={t} />)
  await screen.findByText(t('transcription.cap.diagnosticsUnknown'))
  expect(screen.getByText(t('transcription.cap.empty'))).toBeTruthy()
})

it('does not show an old project response after remount', async () => {
  const t = createCreatorStudioTranslator('en')
  let resolve!: (value: SonoraTranscriptionCatalog) => void
  const runtime = { readTranscriptionCatalog: () => new Promise<SonoraTranscriptionCatalog>(done => { resolve = done }) }
  const ui = render(<CreatorTranscriptionCapabilities key="first-project" runtime={runtime} t={t} />)
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  ui.rerender(<CreatorTranscriptionCapabilities key="second-project" runtime={{ readTranscriptionCatalog: async () => undefined }} t={t} />)
  await act(async () => { resolve(catalog) })
  await screen.findByText(t('transcription.cap.unavailable'))
  expect(screen.queryByText('fixture')).toBeNull()
})
