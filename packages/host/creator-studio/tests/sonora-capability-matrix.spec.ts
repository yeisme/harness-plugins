import { describe, expect, it, vi } from 'vitest'
import { deriveSonoraCapabilityMatrix, SonoraCapabilityMatrixClient, validateSonoraCapabilityMatrix, type SonoraCapabilityConnection } from '../src/sonora-capability-matrix.ts'
import type { SonoraTranscriptionCatalog } from '../src/sonora-transcription-catalog.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = {
  tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', sessionRef: 's1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1',
  runtimeGeneration: 1, revision: 'r1',
} as never

function binding(overrides: Partial<SonoraCapabilityConnection> = {}): SonoraCapabilityConnection {
  return { baseURL: 'http://127.0.0.1:8921/', headers: {}, context, ...overrides }
}

const fixtureCatalog: SonoraTranscriptionCatalog = { validation_level: 'capability_probe', diagnostics_available: true, profiles: [{
  provider_id: 'fixture', model_ref: 'sonora://asr-model/fixture-v1', revision: 'fixture-asr.v1', readiness: 'first-support', fixture: true,
  supported_locales: ['zh-CN'], supported_formats: ['wav'], timestamp_modes: ['segment'], supports_speaker_labels: false,
  requires_network: false, requires_credentials: false, cost_model: 'free_fixture', max_duration_ms: 3000, max_segments: 10,
}] }

function providersBody(providers: unknown[]): unknown {
  return { providers }
}

function musicBody(providers: unknown[]): unknown {
  return { providers }
}

const ttsProvider = { provider_id: 'elevenlabs', provider_kind: 'tts', requires_network: true, requires_credentials: true,
  configured: true, status: 'configured', supported_locales: ['en-US'], supports_voice_clone: true, cost_model: 'external_runtime' }
const unconfiguredCloneProvider = { ...ttsProvider, provider_id: 'voicebox', configured: false, status: 'credential_missing' }

describe('deriveSonoraCapabilityMatrix (§2.2 owner-sourced states)', () => {
  it('marks configured provider families supported and keeps cost/fixture facts unexaggerated', () => {
    const matrix = deriveSonoraCapabilityMatrix({ providers: [ttsProvider], musicProviders: [], transcription: fixtureCatalog })
    const byFamily = Object.fromEntries(matrix.entries.map(entry => [entry.family, entry]))
    expect(byFamily.speech).toMatchObject({ state: 'supported', reasonCode: 'owner_declared_configured' })
    expect(byFamily.voice_clone).toMatchObject({ state: 'supported' })
    expect(byFamily.music).toMatchObject({ state: 'missing', reasonCode: 'owner_declared_no_providers' })
    // owner HTTP provider 描述面没有 SFX 条目：保留禁用入口与原因，不编造。
    expect(byFamily.sfx).toMatchObject({ state: 'missing', reasonCode: 'owner_http_provider_description_absent' })
    // fixture-only 目录 → 未验证；无词级声明 → 词级对齐显式 missing + 边界说明。
    expect(byFamily.transcription).toMatchObject({ state: 'unverified', reasonCode: 'fixture_only_catalog' })
    expect(byFamily.word_alignment).toMatchObject({ state: 'missing', reasonCode: 'segment_to_cue_only', detail: 'segment_to_cue_boundary' })
    expect(byFamily.subtitle_export).toMatchObject({ state: 'supported', source: 'contract_audit' })
    expect(JSON.stringify(matrix)).not.toContain('external_runtime')
  })

  it('keeps unconfigured clone providers and preview music readiness unverified', () => {
    const matrix = deriveSonoraCapabilityMatrix({
      providers: [unconfiguredCloneProvider],
      musicProviders: [{ provider_id: 'elevenlabs', provider_kind: 'remote_official_api', readiness: 'preview', requires_network: true, requires_credentials: true, cost_model: 'unknown_preview' }],
      transcription: fixtureCatalog,
    })
    const byFamily = Object.fromEntries(matrix.entries.map(entry => [entry.family, entry]))
    expect(byFamily.speech?.state).toBe('unverified')
    expect(byFamily.speech?.reasonCode).toBe('provider_not_configured')
    expect(byFamily.voice_clone).toMatchObject({ state: 'unverified', reasonCode: 'clone_provider_not_configured' })
    expect(byFamily.music).toMatchObject({ state: 'unverified', reasonCode: 'music_readiness_not_production' })
    expect(byFamily.music?.detail).toContain('preview')
  })

  it('treats a declared real word-level transcription profile as supported word alignment', () => {
    const wordCatalog: SonoraTranscriptionCatalog = { validation_level: 'capability_probe', profiles: [{
      provider_id: 'command-asr', model_ref: 'sonora://asr-model/whisper-1', revision: 'asr.v2', readiness: 'first-support', fixture: false,
      supported_locales: ['en-US'], supported_formats: ['wav'], timestamp_modes: ['segment', 'word'], supports_speaker_labels: false,
      requires_network: false, requires_credentials: false, cost_model: 'local_runtime', max_duration_ms: 60000, max_segments: 500,
    }] }
    const matrix = deriveSonoraCapabilityMatrix({ providers: [], musicProviders: [], transcription: wordCatalog })
    const byFamily = Object.fromEntries(matrix.entries.map(entry => [entry.family, entry]))
    expect(byFamily.transcription).toMatchObject({ state: 'supported' })
    expect(byFamily.word_alignment).toMatchObject({ state: 'supported', reasonCode: 'owner_declared_word_timestamps' })
  })

  it('round-trips through the browser-safe validator', () => {
    const matrix = deriveSonoraCapabilityMatrix({ providers: [ttsProvider], musicProviders: [], transcription: fixtureCatalog })
    expect(validateSonoraCapabilityMatrix(matrix)).toEqual(matrix)
    expect(validateSonoraCapabilityMatrix({ ...matrix, entries: matrix.entries.slice(0, 3) })).toBeUndefined()
    expect(validateSonoraCapabilityMatrix({ ...matrix, entries: matrix.entries.map(entry => ({ ...entry, state: 'invented' })) })).toBeUndefined()
  })
})

describe('SonoraCapabilityMatrixClient', () => {
  it('combines the three owner description sources in one consistent read', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname
      if (path === '/api/v1/providers') return Response.json(providersBody([ttsProvider]))
      if (path === '/api/v1/music/providers') return Response.json(musicBody([{ provider_id: 'elevenlabs', provider_kind: 'remote_official_api', readiness: 'preview', requires_network: true, requires_credentials: true, cost_model: 'unknown_preview' }]))
      return new Response('', { status: 404 })
    })
    const client = new SonoraCapabilityMatrixClient(async () => binding(), fetcher as never)
    const result = await client.read(context, fixtureCatalog)
    expect(result).toMatchObject({ status: 'ready' })
    if (result.status !== 'ready') return
    const music = result.resource.entries.find(entry => entry.family === 'music')
    expect(music?.detail).toContain('preview')
  })

  it('degrades the whole matrix honestly when any description source fails', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname
      if (path === '/api/v1/providers') return Response.json(providersBody([ttsProvider]))
      return new Response('', { status: 500 })
    })
    const client = new SonoraCapabilityMatrixClient(async () => binding(), fetcher as never)
    expect(await client.read(context, fixtureCatalog)).toEqual({ status: 'unknown', reason: 'unconfirmed' })
    const offline = new SonoraCapabilityMatrixClient(async () => undefined)
    expect(await offline.read(context, fixtureCatalog)).toEqual({ status: 'rejected', reason: 'unavailable' })
  })

  it('keeps a context mismatch and non-loopback http from reaching the owner', async () => {
    const fetcher = vi.fn()
    const wrongProject = new SonoraCapabilityMatrixClient(async scope => binding({ context: { ...scope, projectRef: 'p2' } as never }), fetcher as never)
    expect(await wrongProject.read(context, fixtureCatalog)).toEqual({ status: 'rejected', reason: 'permission_denied' })
    const remote = new SonoraCapabilityMatrixClient(async () => binding({ baseURL: 'http://example.com/' }), fetcher as never)
    expect(await remote.read(context, fixtureCatalog)).toEqual({ status: 'rejected', reason: 'unavailable' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
