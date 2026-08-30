import { describe, expect, it } from 'vitest'
import { probeRadarCapability } from '../src/probe.js'
import { createFakeRadarProvider } from '../src/provider.js'

describe('radar capability probe', () => {
  it('reports ready when binary, contract, capabilities, and pane slot all probe', async () => {
    const fake = createFakeRadarProvider()
    const result = await probeRadarCapability({
      binary: 'radar',
      checkBinary: async () => true,
      handoffSpec: fake.handoffSpec,
      capabilities: fake.capabilitiesOutput,
      paneSlotAvailable: true,
    })
    expect(result.ready).toBe(true)
    expect(result.detail).toContain('ready')
  })

  it('disables with needs_radar when the binary is unreachable', async () => {
    const result = await probeRadarCapability({
      binary: 'radar',
      checkBinary: async () => false,
      paneSlotAvailable: true,
    })
    expect(result.ready).toBe(false)
    expect(result.reason).toBe('needs_radar')
    expect(result.binary.detail).toContain('install short-drama-radar')
  })

  it('rejects unsafe binary names as needs_radar', async () => {
    const result = await probeRadarCapability({
      binary: '/tmp/radar',
      checkBinary: async () => true,
      paneSlotAvailable: true,
    })
    expect(result.ready).toBe(false)
    expect(result.reason).toBe('needs_radar')
  })

  it('disables with contract_mismatch on a stale handoff spec', async () => {
    const result = await probeRadarCapability({
      binary: 'radar',
      checkBinary: async () => true,
      handoffSpec: 'radar.mcp.handoff.v0',
      paneSlotAvailable: true,
    })
    expect(result.ready).toBe(false)
    expect(result.reason).toBe('contract_mismatch')
  })

  it('disables with capability_blocked when required capabilities are not ready', async () => {
    const fake = createFakeRadarProvider()
    const result = await probeRadarCapability({
      binary: 'radar',
      checkBinary: async () => true,
      handoffSpec: fake.handoffSpec,
      capabilities: { spec: fake.handoffSpec, capabilities: { ...fake.capabilitiesOutput.capabilities, personal_profile_feedback: 'blocked' } },
      paneSlotAvailable: true,
    })
    expect(result.ready).toBe(false)
    expect(result.reason).toBe('capability_blocked')
    expect(result.capabilities.detail).toContain('personal_profile_feedback')
  })

  it('disables with seam_unavailable when the official pane slot is missing', async () => {
    const fake = createFakeRadarProvider()
    const result = await probeRadarCapability({
      binary: 'radar',
      checkBinary: async () => true,
      handoffSpec: fake.handoffSpec,
      capabilities: fake.capabilitiesOutput,
      paneSlotAvailable: false,
    })
    expect(result.ready).toBe(false)
    expect(result.reason).toBe('seam_unavailable')
    expect(result.paneSlot.detail).toContain('Pane slot')
  })
})
