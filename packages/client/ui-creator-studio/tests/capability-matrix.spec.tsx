// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import type { SonoraCapabilityMatrix } from '@yeisme/dsh-creator-studio-host/contracts'
import { CreatorCapabilityMatrix } from '../src/capability-matrix.tsx'
import { createCreatorStudioTranslator } from '../src/locales.ts'

const matrix: SonoraCapabilityMatrix = {
  schemaVersion: 'sonora.capability_matrix.v1',
  entries: [
    { family: 'speech', state: 'supported', reasonCode: 'owner_declared_configured', providers: [{ id: 'elevenlabs', kind: 'tts', status: 'configured' }], source: 'providers' },
    { family: 'voice_clone', state: 'unverified', reasonCode: 'clone_provider_not_configured', providers: [{ id: 'voicebox', kind: 'tts', status: 'credential_missing' }], source: 'providers' },
    { family: 'music', state: 'unverified', reasonCode: 'music_readiness_not_production', detail: 'elevenlabs:preview', providers: [{ id: 'elevenlabs', status: 'preview' }], source: 'music_providers' },
    { family: 'sfx', state: 'missing', reasonCode: 'owner_http_provider_description_absent', providers: [], source: 'providers' },
    { family: 'transcription', state: 'unverified', reasonCode: 'fixture_only_catalog', providers: [{ id: 'fixture', status: 'fixture' }], source: 'transcription_catalog' },
    { family: 'word_alignment', state: 'missing', reasonCode: 'segment_to_cue_only', detail: 'segment_to_cue_boundary', providers: [], source: 'transcription_catalog' },
    { family: 'subtitle_export', state: 'supported', reasonCode: 'owner_contract_srt_vtt', detail: 'formats:srt,vtt', providers: [], source: 'contract_audit' },
  ],
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it.each(['zh', 'en'] as const)('shows every family with owner-sourced states and stable reason codes (%s)', async locale => {
  const t = createCreatorStudioTranslator(locale)
  const runtime = { readCapabilityMatrix: vi.fn(async () => matrix) }
  const ui = render(<CreatorCapabilityMatrix runtime={runtime} t={t} />)
  await screen.findByText('elevenlabs (configured)')
  for (const family of matrix.entries) {
    const row = ui.container.querySelector(`[data-family="${family.family}"]`)
    expect(row?.getAttribute('data-state')).toBe(family.state)
    expect(row?.textContent).toContain(family.reasonCode)
  }
  expect(screen.getAllByText(t('capability.matrix.state.missing')).length).toBeGreaterThan(0)
  expect(screen.getByText(t('capability.matrix.family.sfx'))).toBeTruthy()
  // 契约核对来源显式标注，不冒充实时探测。
  expect(screen.getByText(t('capability.matrix.contractAudit'))).toBeTruthy()
  // 不出现任何费用数值。
  expect(ui.container.textContent).not.toMatch(/\d+(\.\d+)?\s*(USD|美元)/u)
})

it('marks a failed first read unavailable and a failed refresh stale with retention', async () => {
  const t = createCreatorStudioTranslator('en')
  const runtime = { readCapabilityMatrix: vi.fn().mockResolvedValueOnce(matrix).mockResolvedValueOnce(undefined) }
  render(<CreatorCapabilityMatrix runtime={runtime} t={t} />)
  await screen.findByText('elevenlabs (configured)')
  fireEvent.click(screen.getByRole('button', { name: t('state.refresh') }))
  await screen.findByText(t('capability.matrix.stale'))
  expect(screen.getByText('elevenlabs (configured)')).toBeTruthy()
  expect(runtime.readCapabilityMatrix).toHaveBeenCalledTimes(2)
})

it('shows an honest unavailable state without fabricating families', async () => {
  const t = createCreatorStudioTranslator('en')
  const runtime = { readCapabilityMatrix: vi.fn(async () => undefined) }
  const ui = render(<CreatorCapabilityMatrix runtime={runtime} t={t} />)
  await screen.findByText(t('capability.matrix.unavailable'))
  expect(ui.container.querySelectorAll('.cs-capability-row')).toHaveLength(0)
})

it('discards a late response after the context key changes', async () => {
  const t = createCreatorStudioTranslator('en')
  let resolve!: (value: SonoraCapabilityMatrix | undefined) => void
  const runtime = { readCapabilityMatrix: () => new Promise<SonoraCapabilityMatrix | undefined>(done => { resolve = done }) }
  const ui = render(<CreatorCapabilityMatrix key="first-project" runtime={runtime} t={t} />)
  await act(async () => { resolve(matrix) })
  await screen.findByText('elevenlabs (configured)')
  let resolveSecond!: (value: SonoraCapabilityMatrix | undefined) => void
  const second = { readCapabilityMatrix: () => new Promise<SonoraCapabilityMatrix | undefined>(done => { resolveSecond = done }) }
  ui.rerender(<CreatorCapabilityMatrix key="second-project" runtime={second} t={t} />)
  await act(async () => { resolveSecond(undefined) })
  await screen.findByText(t('capability.matrix.unavailable'))
  expect(screen.queryByText('elevenlabs (configured)')).toBeNull()
})
