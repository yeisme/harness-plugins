import type { BrowserPerformanceCollector } from './collector.ts'
import type { DevtoolsControllerState } from './controller.ts'
import type { DevtoolsExportV1 } from '../wire.ts'

const FORBIDDEN_KEY = /authorization|api.?key|password|cookie|secret|raw.?prompt|system.?prompt|provider.?payload|tool.?arguments?|private.?tool/i
const FORBIDDEN_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+\/-]+=*|\bsk-[A-Za-z0-9_-]{8,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|(?:^|[\s"'])\/(?:Users|home|workspaces|private|var|tmp)\/[^\s"']+)/i

export function containsForbiddenExportContent(value: unknown, seen = new Set<unknown>()): boolean {
  if (typeof value === 'string') return FORBIDDEN_VALUE.test(value)
  if (typeof value !== 'object' || value === null) return false
  if (seen.has(value)) return false
  seen.add(value)
  if (Array.isArray(value)) return value.some(item => containsForbiddenExportContent(item, seen))
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => FORBIDDEN_KEY.test(key) || containsForbiddenExportContent(item, seen))
}

export function createDevtoolsExport(state: DevtoolsControllerState, collector: BrowserPerformanceCollector, generatedAt = new Date()): DevtoolsExportV1 {
  if (state.status !== 'ready') throw new Error('DevTools snapshot is not ready')
  const value: DevtoolsExportV1 = {
    schemaVersion: 'dsh.devtools.export.v1',
    generatedAt: generatedAt.toISOString(),
    host: state.snapshot,
    browser: { capabilities: collector.capabilities, records: collector.snapshot() },
    clock: { offsetMs: state.clockOffsetMs, uncertaintyMs: state.clockUncertaintyMs, exactRpcCorrelation: state.snapshot.capabilities.exactRpcCorrelation },
    ...(state.cpuProfile?.ok === true ? { cpuProfile: state.cpuProfile } : {}),
    redaction: { enabled: true, policy: 'dsh-devtools-safe-v1' },
  }
  if (containsForbiddenExportContent(value)) throw new Error('Export blocked by the DevTools redaction policy')
  return value
}

export function downloadDevtoolsExport(value: DevtoolsExportV1): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `dsh-devtools-${value.generatedAt.replaceAll(':', '').replaceAll('-', '')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
