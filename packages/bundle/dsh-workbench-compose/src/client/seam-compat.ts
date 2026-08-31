/**
 * DSH peer-floor capability gating (V3 7.3 fixture layer).
 *
 * The composed workbench probes the peer's terminal and preview seams before
 * mounting any live surface. A missing or old seam surfaces an honest
 * compatibility error — never an overlay, raw URL, or fake terminal. These
 * fixtures drive both the old-seam (absent/partial) and new-seam paths.
 *
 * @module @yeisme/dsh-workbench-compose/client
 */

export type DshSeamCompatibilityLevel = 'compatible' | 'old-seam' | 'missing'

export interface DshSeamCompatibilityV1 {
  readonly level: DshSeamCompatibilityLevel
  /** Honest, redacted message for the compatibility error surface. */
  readonly reason: 'ok' | 'preview_seam_disabled' | 'preview_seam_absent'
  /** Live surfaces may mount only when level is compatible. */
  readonly liveMountAllowed: boolean
}

/**
 * Derives the peer floor from the two seam probes. This is the single
 * decision point; callers render the compatibility error from `reason` and
 * must not substitute overlays, raw URLs, or fake terminals.
 */
export function resolveDshSeamCompatibility(input: { readonly previewProbe?: unknown }): DshSeamCompatibilityV1 {
  const probe = input.previewProbe
  if (probe === undefined) {
    return { level: 'missing', reason: 'preview_seam_absent', liveMountAllowed: false }
  }
  if (typeof probe === 'object' && probe !== null && 'disabledReason' in (probe as Record<string, unknown>)) {
    return { level: 'old-seam', reason: 'preview_seam_disabled', liveMountAllowed: false }
  }
  return { level: 'compatible', reason: 'ok', liveMountAllowed: true }
}

/** Convenience gate used by the composed surface; mirrors the contract above. */
export function dshSeamAllowsLiveMount(input: { readonly previewProbe?: unknown }): boolean {
  return resolveDshSeamCompatibility(input).liveMountAllowed
}

