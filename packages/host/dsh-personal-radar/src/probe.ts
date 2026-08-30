/**
 * Capability probe for the Drama Radar entry points.
 *
 * Probes four things before any badge/command/pane is enabled:
 *   1. the configured Radar binary is reachable,
 *   2. the owner handoff contract matches `radar.mcp.handoff.v1`,
 *   3. `radar mcp capabilities` reports the required capabilities ready,
 *   4. the official DSH Pane slot is available.
 * Any gap disables the entry with a stable reason instead of faking ready.
 */

import { RADAR_HANDOFF_SPEC, type RadarDisabledReason } from './contracts.js'
import { isSafeRadarBinary } from './adapter.js'

export interface RadarCapabilitiesOutputV1 {
  readonly spec: string
  readonly capabilities: Readonly<Record<string, string>>
}

export interface RadarProbeInputV1 {
  /** Bare executable name from user-level config. */
  readonly binary: string
  /** Reachability check for the binary (injected; no shell here). */
  readonly checkBinary: (binary: string) => Promise<boolean>
  /** Handoff contract spec reported by the owner (undefined when unreachable). */
  readonly handoffSpec?: string
  /** Output of `radar mcp capabilities` (undefined when unavailable). */
  readonly capabilities?: RadarCapabilitiesOutputV1
  /** Official Pane slot presence from the DSH host. */
  readonly paneSlotAvailable: boolean
  /** Capabilities the Radar surface must report as ready. */
  readonly requiredCapabilities?: readonly string[]
}

export interface RadarProbeCheckV1 {
  readonly ok: boolean
  readonly reason?: RadarDisabledReason
  readonly detail: string
}

export interface RadarCapabilityProbeResultV1 {
  readonly ready: boolean
  readonly reason?: RadarDisabledReason
  readonly detail: string
  readonly binary: RadarProbeCheckV1
  readonly contract: RadarProbeCheckV1
  readonly capabilities: RadarProbeCheckV1
  readonly paneSlot: RadarProbeCheckV1
}

const DEFAULT_REQUIRED = ['personal_profile_feedback', 'opportunity_edition', 'mcp_stdio_lanes'] as const

export async function probeRadarCapability(input: RadarProbeInputV1): Promise<RadarCapabilityProbeResultV1> {
  const required = input.requiredCapabilities ?? DEFAULT_REQUIRED

  const binary: RadarProbeCheckV1 = await (async () => {
    if (!isSafeRadarBinary(input.binary)) {
      return { ok: false, reason: 'needs_radar', detail: 'configured radar binary failed the safe-name check' }
    }
    const reachable = await input.checkBinary(input.binary)
    return reachable
      ? { ok: true, detail: `radar binary ${input.binary} is reachable` }
      : { ok: false, reason: 'needs_radar', detail: 'radar binary is not reachable; install short-drama-radar to enable the Drama Radar entry' }
  })()

  const contract: RadarProbeCheckV1 = (() => {
    if (!binary.ok) return { ok: false, reason: 'needs_radar', detail: 'contract check skipped: radar binary unreachable' }
    if (input.handoffSpec === undefined) {
      return { ok: false, reason: 'contract_mismatch', detail: 'owner handoff spec is unavailable' }
    }
    return input.handoffSpec === RADAR_HANDOFF_SPEC
      ? { ok: true, detail: `handoff contract ${input.handoffSpec}` }
      : { ok: false, reason: 'contract_mismatch', detail: `handoff spec ${input.handoffSpec} does not match ${RADAR_HANDOFF_SPEC}` }
  })()

  const capabilities: RadarProbeCheckV1 = (() => {
    if (!binary.ok) return { ok: false, reason: 'needs_radar', detail: 'capabilities check skipped: radar binary unreachable' }
    if (!contract.ok) return { ok: false, reason: 'contract_mismatch', detail: 'capabilities check skipped: contract mismatch' }
    if (input.capabilities === undefined) {
      return { ok: false, reason: 'capability_blocked', detail: 'radar mcp capabilities output is unavailable' }
    }
    const blocked = required.filter(name => input.capabilities!.capabilities[name] !== 'ready')
    return blocked.length === 0
      ? { ok: true, detail: `capabilities ready: ${required.join(', ')}` }
      : { ok: false, reason: 'capability_blocked', detail: `radar capabilities not ready: ${blocked.join(', ')}` }
  })()

  const paneSlot: RadarProbeCheckV1 = input.paneSlotAvailable
    ? { ok: true, detail: 'official Pane slot is available' }
    : { ok: false, reason: 'seam_unavailable', detail: 'the current DSH host does not expose the official Pane slot; the Drama Radar pane stays disabled' }

  const checks = [binary, contract, capabilities, paneSlot]
  const failed = checks.find(check => !check.ok)
  const ready = failed === undefined
  return {
    ready,
    ...(failed?.reason === undefined ? {} : { reason: failed.reason }),
    detail: ready ? 'drama radar capability is ready' : failed?.detail ?? 'probe failed',
    binary,
    contract,
    capabilities,
    paneSlot,
  }
}
