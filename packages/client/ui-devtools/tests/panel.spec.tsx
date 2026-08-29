import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DevtoolsPanel } from '../src/client/panel.tsx'

const ready = {
  status: 'ready' as const,
  clockOffsetMs: 0,
  clockUncertaintyMs: 2,
  snapshot: {
    ok: true as const, specVersion: '1.0' as const, bootId: 'boot', serverTime: 1, nextSeq: 2, truncated: false,
    capabilities: { logger: true, sessionTimeline: true, hostMetrics: true, cpuProfile: true, exactRpcCorrelation: false },
    summary: { uptimeMs: 100, records: 2, logs: 1, spans: 0, samples: 0, findings: 1, errors: 0 },
    records: [
      { seq: 1, ts: 1, type: 'log' as const, severity: 'info' as const, source: 'runtime', fingerprint: 'sha256:x', summary: 'details redacted' },
      { seq: 2, ts: 2, type: 'finding' as const, code: 'web.api_slow', severity: 'warn' as const, summary: 'API slow', evidenceSeqs: [1] },
    ],
  },
}

afterEach(cleanup)

describe('DevtoolsPanel', () => {
  it('renders diagnostics tabs and actions', () => {
    const capture = vi.fn()
    const exportData = vi.fn()
    render(<DevtoolsPanel state={ready} browserRecords={[]} onCaptureCpu={capture} onExport={exportData} />)
    expect(screen.getByText('Top findings')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'logs' }))
    expect(screen.getByText('sha256:x')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'CPU Profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(capture).toHaveBeenCalledOnce()
    expect(exportData).toHaveBeenCalledOnce()
  })

  it('shows the Host unavailable state', () => {
    render(<DevtoolsPanel state={{ status: 'error', message: 'missing' }} browserRecords={[]} onCaptureCpu={() => undefined} onExport={() => undefined} />)
    expect(screen.getByRole('alert').textContent).toContain('missing')
    expect(screen.getByRole('button', { name: 'Export' }).hasAttribute('disabled')).toBe(true)
  })
})
