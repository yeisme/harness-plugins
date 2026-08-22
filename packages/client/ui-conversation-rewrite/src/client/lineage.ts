/** Child-session lineage labels. Does not change fork RPC or session ownership. */

export interface RewriteLineageSource {
  readonly sessionId: string
  readonly parentSessionId?: string
  readonly origin?: 'edit' | 'retry' | 'fork'
}

export interface RewriteLineageLabel {
  readonly sessionId: string
  readonly parentSessionId?: string
  readonly origin: 'edit' | 'retry' | 'fork' | 'unknown'
  readonly text: string
}

export function lineageLabel(source: RewriteLineageSource): RewriteLineageLabel {
  const origin = source.origin ?? 'unknown'
  const parent = source.parentSessionId
  const text = parent === undefined
    ? origin === 'unknown' ? 'Original session' : `Branched by ${origin}`
    : `From ${parent} · ${origin}`
  return {
    sessionId: source.sessionId,
    ...(parent === undefined ? {} : { parentSessionId: parent }),
    origin,
    text,
  }
}

export interface SessionLineageRow {
  readonly sessionId: string
  readonly parentSessionId?: string | undefined
  readonly origin?: 'edit' | 'retry' | 'fork' | undefined
}

/** Map a session-list row onto a lineage label without inventing fork RPC state. */
export function sessionLineageLabel(row: SessionLineageRow): RewriteLineageLabel {
  return lineageLabel({
    sessionId: row.sessionId,
    ...(row.parentSessionId === undefined ? {} : { parentSessionId: row.parentSessionId }),
    ...(row.origin === undefined ? {} : { origin: row.origin }),
  })
}
