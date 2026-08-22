/** Pure safe projection from DSH-owned subagent catalogs into a Pane-safe view model. */

export type SubagentMode = 'one-shot' | 'continuable'
export type SubagentActivity = 'running' | 'inactive'
export type SubagentOutcome = 'completed' | 'failed' | 'cancelled' | 'interrupted'
export type SubagentStatus = 'running' | 'idle' | 'ready' | 'inactive' | 'unknown' | SubagentOutcome

export interface SubagentTokenUsageV1 {
  readonly input: number
  readonly output: number
  readonly cacheRead: number
  readonly cacheWrite: number
}

export interface SubagentPaneNodeV1 {
  readonly ref: string
  readonly parentRef?: string
  readonly label: string
  readonly mode: SubagentMode
  readonly status: SubagentStatus
  readonly hasChildren: boolean
  readonly depth: number
  readonly timingMs?: number
  readonly tokenUsage?: SubagentTokenUsageV1
  readonly updatedAt?: number
}

export interface SubagentPaneProjectionV1 {
  readonly rootSessionId: string
  readonly nodes: readonly SubagentPaneNodeV1[]
  readonly runningCount: number
  readonly totalTokens?: number
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly generation: number
}

export interface SubagentCatalogEntrySource {
  readonly id: string
  readonly kind: 'child' | 'diagnostic'
  readonly mode?: SubagentMode
  readonly label?: string
  readonly activity?: SubagentActivity
  readonly hasChildren?: boolean
  readonly outcome?: SubagentOutcome
}

export interface SubagentCatalogSource {
  readonly entries: readonly SubagentCatalogEntrySource[]
  readonly state?: 'loading' | 'ready' | 'error'
  readonly parentAvailable?: boolean
}

export interface SubagentSummarySource {
  readonly id: string
  readonly title?: string
  readonly displayTitle?: string
  readonly running?: boolean
  readonly outcome?: SubagentOutcome
  readonly projectionValues?: {
    readonly subagentTiming?: {
      readonly settledMs?: number
      readonly active?: { readonly since: number; readonly through?: number }
    }
    readonly tokenUsage?: {
      readonly uncachedInputTokens?: number
      readonly outputTokens?: number
      readonly cacheReadTokens?: number
      readonly cacheWriteTokens?: number
    }
  }
}

export interface SubagentProjectionSource {
  readonly rootSessionId: string
  readonly catalogs: Readonly<Record<string, SubagentCatalogSource>>
  readonly summaries: Readonly<Record<string, SubagentSummarySource>>
  readonly freshness: 'fresh' | 'stale' | 'unknown'
  readonly generation: number
}

const SAFE_ID = /^[a-z0-9][a-z0-9._:/-]*$/i
const UNSAFE_LABEL = /(?:^|[\s:])[/\\]|[A-Za-z]:[\\/]|^\\\\/

function safeRef(value: string): boolean {
  return value.length > 0 && value.length <= 512 && SAFE_ID.test(value)
}

function safeLabel(value: string): boolean {
  return value.length > 0 && value.length <= 160 && !UNSAFE_LABEL.test(value)
}

function labelOf(entry: SubagentCatalogEntrySource, summary: SubagentSummarySource | undefined): string {
  const candidate = entry.label ?? summary?.title ?? summary?.displayTitle ?? entry.id
  return safeLabel(candidate) ? candidate : entry.id
}

function statusOf(entry: SubagentCatalogEntrySource, summary: SubagentSummarySource | undefined): SubagentStatus {
  if (entry.kind === 'diagnostic') return 'unknown'
  if (entry.outcome !== undefined) return entry.outcome
  if (summary?.outcome !== undefined) return summary.outcome
  if (entry.activity === 'running' || summary?.running === true) return 'running'
  if (entry.activity === 'inactive' && summary?.running === false) return 'inactive'
  return 'ready'
}

function timingMsOf(summary: SubagentSummarySource | undefined): number | undefined {
  const timing = summary?.projectionValues?.subagentTiming
  if (timing === undefined) return undefined
  const settled = timing.settledMs ?? 0
  if (timing.active === undefined) return settled
  const end = timing.active.through ?? timing.active.since
  return settled + Math.max(0, end - timing.active.since)
}

function tokenUsageOf(summary: SubagentSummarySource | undefined): SubagentTokenUsageV1 | undefined {
  const usage = summary?.projectionValues?.tokenUsage
  if (usage === undefined) return undefined
  return {
    input: usage.uncachedInputTokens ?? 0,
    output: usage.outputTokens ?? 0,
    cacheRead: usage.cacheReadTokens ?? 0,
    cacheWrite: usage.cacheWriteTokens ?? 0,
  }
}

function tokenTotal(summary: SubagentSummarySource | undefined): number | undefined {
  const usage = summary?.projectionValues?.tokenUsage
  if (usage === undefined) return undefined
  return (usage.uncachedInputTokens ?? 0)
    + (usage.outputTokens ?? 0)
    + (usage.cacheReadTokens ?? 0)
    + (usage.cacheWriteTokens ?? 0)
}

function walk(
  rootSessionId: string,
  catalogs: Readonly<Record<string, SubagentCatalogSource>>,
  summaries: Readonly<Record<string, SubagentSummarySource>>,
  output: SubagentPaneNodeV1[],
  depth: number,
): void {
  const catalog = catalogs[rootSessionId]
  if (catalog === undefined || catalog.entries.length === 0) return
  for (const entry of catalog.entries) {
    if (!safeRef(entry.id)) continue
    const summary = summaries[entry.id]
    const timingMs = timingMsOf(summary)
    const tokenUsage = tokenUsageOf(summary)
    const node: SubagentPaneNodeV1 = {
      ref: entry.id,
      parentRef: rootSessionId,
      label: labelOf(entry, summary),
      mode: entry.mode ?? (entry.kind === 'child' ? 'one-shot' : 'one-shot'),
      status: statusOf(entry, summary),
      hasChildren: entry.kind === 'child' && entry.hasChildren === true,
      depth,
      ...(timingMs === undefined ? {} : { timingMs }),
      ...(tokenUsage === undefined ? {} : { tokenUsage }),
    }
    output.push(node)
    if (node.hasChildren) walk(entry.id, catalogs, summaries, output, depth + 1)
  }
}

/** Folds one DSH snapshot into a bounded, safe Pane projection. */
export function projectSubagentPane(source: SubagentProjectionSource): SubagentPaneProjectionV1 {
  const nodes: SubagentPaneNodeV1[] = []
  walk(source.rootSessionId, source.catalogs, source.summaries, nodes, 0)
  const runningCount = nodes.filter(node => node.status === 'running').length
  const totalTokens = nodes.reduce<number | undefined>((total, node) => {
    if (node.tokenUsage === undefined) return total
    const nodeTotal = node.tokenUsage.input + node.tokenUsage.output + node.tokenUsage.cacheRead + node.tokenUsage.cacheWrite
    return (total ?? 0) + nodeTotal
  }, undefined)
  return {
    rootSessionId: source.rootSessionId,
    nodes,
    runningCount,
    totalTokens,
    freshness: source.freshness,
    generation: source.generation,
  }
}
