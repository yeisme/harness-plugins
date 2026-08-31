import { describe, expect, it } from 'vitest'
import { resolveDshSeamCompatibility, dshSeamAllowsLiveMount } from '../src/client/seam-compat.ts'

/** V3 7.3 old-seam/new-seam fixture tests: capability check + honest degradation. */
describe('DSH peer-floor capability gating (V3 7.3 fixtures)', () => {
  it('new-seam (compatible probe) allows live mount', () => {
    const result = resolveDshSeamCompatibility({ previewProbe: { seamVersion: 'v1' } })
    expect(result).toEqual({ level: 'compatible', reason: 'ok', liveMountAllowed: true })
    expect(dshSeamAllowsLiveMount({ previewProbe: {} })).toBe(true)
  })

  it('old-seam (disabled probe) blocks live mount with preview_seam_disabled', () => {
    const result = resolveDshSeamCompatibility({ previewProbe: { disabledReason: 'official seam not published' } })
    expect(result).toEqual({ level: 'old-seam', reason: 'preview_seam_disabled', liveMountAllowed: false })
  })

  it('missing seam blocks live mount with preview_seam_absent', () => {
    expect(resolveDshSeamCompatibility({ previewProbe: undefined })).toEqual({ level: 'missing', reason: 'preview_seam_absent', liveMountAllowed: false })
    expect(resolveDshSeamCompatibility({})).toEqual({ level: 'missing', reason: 'preview_seam_absent', liveMountAllowed: false })
    expect(dshSeamAllowsLiveMount({})).toBe(false)
  })

  it('compatibility reason strings stay redacted — no URLs, tokens, or host paths', () => {
    for (const probe of [undefined, { disabledReason: 'see https://internal/seam' }]) {
      const result = resolveDshSeamCompatibility({ previewProbe: probe })
      expect(result.reason).not.toMatch(/https?:\/\//)
      expect(result.reason).toBeOneOf(['ok', 'preview_seam_disabled', 'preview_seam_absent'])
    }
  })
})
