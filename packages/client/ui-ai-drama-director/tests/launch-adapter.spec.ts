import { describe, expect, it, vi } from 'vitest'
import {
  BRIDGE_V2_LENS_MAP,
} from '@yeisme/dsh-ai-drama-director'
import {
  bridgeLensPreview,
  createWorkbenchLaunchAdapter,
  describeWorkbenchLaunch,
  validateWorkbenchLaunchDescriptor,
} from '../src/client/launch-adapter.js'

const NOW = 1_800_000_000_000
const now = () => NOW

function descriptor(overrides: Record<string, unknown> = {}) {
  return {
    launchRef: 'lref-0123456789abcdef01234567',
    targetApplication: 'yeisme-workbench',
    targetSurfaceId: 'workbench.agent.spatial',
    presentationIntent: 'open_artifact',
    expiresAtUnixMs: NOW + 300_000,
    capabilityVersion: 'wb-2026.08',
    ...overrides,
  }
}

function v2Issuance(desc: unknown) {
  return { ok: true, mode: 'v2', descriptor: desc }
}

describe('Workbench launch descriptor validation', () => {
  it('accepts the closed safe projection and rejects everything else', () => {
    expect(validateWorkbenchLaunchDescriptor(descriptor())).toBeDefined()
    expect(validateWorkbenchLaunchDescriptor(descriptor({ launchRef: 'https://wb.example' }))).toBeUndefined()
    expect(validateWorkbenchLaunchDescriptor(descriptor({ launchRef: 'lref-NOHEX' }))).toBeUndefined()
    expect(validateWorkbenchLaunchDescriptor(descriptor({ targetApplication: 'other-app' }))).toBeUndefined()
    expect(validateWorkbenchLaunchDescriptor(descriptor({ targetSurfaceId: 'workbench.show-control-room' }))).toBeUndefined()
    expect(validateWorkbenchLaunchDescriptor(descriptor({ presentationIntent: 'open_bts' }))).toBeUndefined()
    expect(validateWorkbenchLaunchDescriptor(descriptor({ origin: 'https://wb.example' }))).toBeUndefined()
    expect(validateWorkbenchLaunchDescriptor(descriptor({ nonce: '0123456789abcdef0123456789abcdef' }))).toBeUndefined()
  })
})

describe('Workbench launch adapter activation', () => {
  it('launches through the approved descriptor with lens, contract version, and expiry', async () => {
    const requestLaunch = vi.fn().mockResolvedValue(v2Issuance(descriptor()))
    const adapter = createWorkbenchLaunchAdapter({ requestLaunch, now })
    const activation = await adapter.activate('open_artifact')
    expect(requestLaunch).toHaveBeenCalledWith({ intent: 'open_artifact' })
    expect(activation).toMatchObject({
      state: 'launched',
      legacy: false,
      contractVersion: 'dsh.workbench_ai_drama_bridge.v2',
      intent: 'open_artifact',
      lens: 'creative_production',
      lensLabel: 'Creative Production',
      capabilityVersion: 'wb-2026.08',
    })
    expect(describeWorkbenchLaunch(activation, now)).toContain('Creative Production lens')
    expect(describeWorkbenchLaunch(activation, now)).toContain('dsh.workbench_ai_drama_bridge.v2')
    expect(describeWorkbenchLaunch(activation, now)).toContain('expires in 300s')
  })

  it('previews all five lens intents without composing routes', () => {
    for (const intent of Object.keys(BRIDGE_V2_LENS_MAP) as (keyof typeof BRIDGE_V2_LENS_MAP)[]) {
      const preview = bridgeLensPreview(intent)
      expect(preview.lens).toBe(BRIDGE_V2_LENS_MAP[intent].lens)
      expect(JSON.stringify(preview)).not.toMatch(/https?:|\/agent|route/)
    }
  })

  it('labels the legacy bridge explicitly and never claims V2 consumption', async () => {
    const adapter = createWorkbenchLaunchAdapter({
      requestLaunch: vi.fn().mockResolvedValue({
        ok: true,
        mode: 'legacy_bridge',
        legacy: { mode: 'legacy_bridge', signed: { handoff: {}, digest: 'x' } },
      }),
      now,
    })
    const activation = await adapter.activate('open_show')
    expect(activation).toMatchObject({ state: 'legacy_bridge', legacy: true })
    expect(describeWorkbenchLaunch(activation, now)).toContain('[legacy_bridge]')
    expect(describeWorkbenchLaunch(activation, now)).toContain('legacy V1 contract')
  })

  it('disables with the stable host reason instead of guessing a URL', async () => {
    for (const disabledReason of ['target_unavailable', 'stale', 'contract_mismatch', 'legacy_bridge']) {
      const adapter = createWorkbenchLaunchAdapter({
        requestLaunch: vi.fn().mockResolvedValue({ ok: false, disabledReason, detail: 'redacted' }),
        now,
      })
      const activation = await adapter.activate('open_review')
      expect(activation).toMatchObject({ state: 'disabled', disabledReason })
      expect(describeWorkbenchLaunch(activation, now)).not.toMatch(/https?:|\/agent\?/)
    }
  })

  it('treats unknown, malformed, and thrown outcomes as unknown with no auto-retry', async () => {
    for (const response of [undefined, null, { something: 'else' }, v2Issuance(descriptor({ launchRef: 'bad' }))]) {
      const adapter = createWorkbenchLaunchAdapter({ requestLaunch: vi.fn().mockResolvedValue(response), now })
      const activation = await adapter.activate('open_evidence')
      expect(activation).toMatchObject({ state: 'unknown', legacy: false })
      expect(adapter.canRetry()).toBe(false)
      expect(describeWorkbenchLaunch(activation, now)).toContain('no automatic retry')
    }
    const throwing = createWorkbenchLaunchAdapter({
      requestLaunch: vi.fn().mockRejectedValue(new Error('transport dropped')),
      now,
    })
    expect(await throwing.activate('open_show')).toMatchObject({ state: 'unknown' })
  })
})
