import { describe, expect, it } from 'vitest'
import { devtoolsRemoteContribution } from '../src/client/remote-contribution.ts'

describe('DevTools Remote contribution', () => {
  it('pins additive snapshot and CPU profile method ids', () => {
    expect(devtoolsRemoteContribution.descriptors.map(item => item.id)).toEqual([
      '@yeisme/dsh-devtools-host/devtools.snapshot@1',
      '@yeisme/dsh-devtools-host/devtools.captureCpuProfile@1',
    ])
    const snapshot = devtoolsRemoteContribution.descriptors[0]!.result.schema
    expect(snapshot.parse({ ok: true, specVersion: '1.0', extraFutureField: true })).toMatchObject({ ok: true, specVersion: '1.0' })
    expect(() => snapshot.parse({ ok: true, specVersion: '2.0' })).toThrow(/invalid envelope/)
  })
})
