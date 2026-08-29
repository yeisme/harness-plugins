import { describe, expect, it, vi } from 'vitest'
import { DevtoolsController } from '../src/client/controller.ts'
import type { DevtoolsRemoteFace } from '../src/wire.ts'

describe('DevtoolsController', () => {
  it('folds incremental records and estimates clock uncertainty', async () => {
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(120).mockReturnValueOnce(200).mockReturnValueOnce(240)
    let call = 0
    const remote: DevtoolsRemoteFace = {
      async snapshot() {
        call += 1
        return { ok: true, specVersion: '1.0', bootId: 'boot', serverTime: call === 1 ? 115 : 225, nextSeq: call, truncated: false, capabilities: { logger: true, sessionTimeline: true, hostMetrics: true, cpuProfile: false, exactRpcCorrelation: false }, summary: { uptimeMs: 1, records: call, logs: 0, spans: 0, samples: 0, findings: 0, errors: 0 }, records: [{ seq: call, ts: call, type: 'lifecycle', event: 'devtools.ready', severity: 'info', summary: 'ready' }] }
      },
      async captureCpuProfile() { return { ok: false, specVersion: '1.0', error: { code: 'not_local', message: 'local only', retryable: false } } },
    }
    const controller = new DevtoolsController(remote, now)
    await controller.refresh()
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', clockOffsetMs: 5, clockUncertaintyMs: 20, snapshot: { records: [{ seq: 1 }, { seq: 2 }] } })
  })
})
