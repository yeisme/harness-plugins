import { describe, expect, it } from 'vitest'
import { decodeDshPluginActionReceiptV1, decodeDshPluginSurfaceContributionV1 } from '@yeisme/dsh-plugin-contracts'
import { applyExampleActionV1, createExampleStructuredSurfaceV1, previewExampleActionV1 } from '../src/index.js'
import { createExampleStructuredSurfaceV1 as createClientSurface } from '../src/client/index.js'

describe('structured host/client example', () => {
  it('publishes command + list/detail/diff + health on both structural surfaces', () => {
    const host = createExampleStructuredSurfaceV1()
    const client = createClientSurface()
    expect(client).toEqual(host)
    expect(decodeDshPluginSurfaceContributionV1(host)).toEqual({ ok: true, value: host })
    expect(host.views.map(view => view.kind)).toEqual(['list', 'detail', 'diff'])
    expect(host.health.status).toBe('available')
  })

  it('keeps a missing seam visible as disabled instead of inventing state', () => {
    const surface = createExampleStructuredSurfaceV1({ available: false })
    expect(surface.commands[0]).toMatchObject({ available: false, disabled_reason_code: 'example.source.unavailable' })
    expect(surface.actions[0]).toMatchObject({ available: false, disabled_reason_code: 'example.source.unavailable' })
    expect(surface.health.status).toBe('disabled')
  })

  it('requires preview refs and revision fencing for the example mutation', () => {
    const preview = previewExampleActionV1()
    const applied = applyExampleActionV1(preview)
    const stale = applyExampleActionV1({ ...preview, expected_revision: 'old' })
    expect(decodeDshPluginActionReceiptV1(applied)).toEqual({ ok: true, value: applied })
    expect(applied.status).toBe('applied')
    expect(stale).toMatchObject({ status: 'stale', reason_code: 'example.revision_mismatch' })
  })
})
