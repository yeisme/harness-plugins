/**
 * Pure snapshot assembly. Never derives context remaining from a
 * process ledger or remaining ratio from a balance amount.
 */

import { parseSafeSessionRef, parseSessionStatusSnapshot } from './schema.ts'
import {
  SESSION_STATUS_LIMIT_BOUND,
  SESSION_STATUS_SCHEMA_VERSION,
  type SessionContextStatusV1,
  type SessionIdentityV1,
  type SessionLimitWindowV1,
  type SessionRuntimeSummaryV1,
  type SessionStatusOverall,
  type SessionStatusSnapshotV1,
  type SourceStatus,
} from './types.ts'

export interface TokenMeterFacts {
  readonly usedTokens: number
  readonly limitTokens: number
  readonly updatedAt?: string
}

export interface ProviderLimitAdapter {
  readonly id: string
  snapshot(sessionRef: string): SessionLimitWindowV1 | null
}

export interface SessionStatusSources {
  readonly session: SessionIdentityV1
  readonly runtime?: SessionRuntimeSummaryV1 | undefined
  readonly tokenMeter?: TokenMeterFacts | undefined
  readonly ownerContext?: SessionContextStatusV1 | undefined
  readonly adapters?: readonly ProviderLimitAdapter[]
  readonly generatedAt?: string
  readonly revision?: number
}

function remainingRatio(used: number, limit: number): number | undefined {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return undefined
  }
  const ratio = (limit - used) / limit
  if (!Number.isFinite(ratio)) return undefined
  return Math.min(1, Math.max(0, ratio))
}

function overallStatus(input: {
  readonly sessionReady: boolean
  readonly context: SessionContextStatusV1
  readonly limits: readonly SessionLimitWindowV1[]
}): SessionStatusOverall {
  if (!input.sessionReady) return 'unavailable'
  const contextReady = input.context.status === 'ready' || input.context.status === 'stale'
  const anyLimitReady = input.limits.some(limit => limit.status === 'ready' || limit.status === 'stale')
  if (contextReady && (input.limits.length === 0 || anyLimitReady)) {
    return input.context.status === 'stale' ? 'partial' : 'ready'
  }
  if (input.sessionReady) return 'partial'
  return 'unavailable'
}

export function projectContext(input: {
  readonly tokenMeter?: TokenMeterFacts | undefined
  readonly ownerContext?: SessionContextStatusV1 | undefined
}): SessionContextStatusV1 {
  if (input.ownerContext !== undefined) {
    return input.ownerContext
  }
  const meter = input.tokenMeter
  if (meter === undefined) {
    return {
      status: 'unavailable',
      source: 'none',
      safeMessage: 'Context remaining is unavailable; process token usage is not a substitute',
    }
  }
  const ratio = remainingRatio(meter.usedTokens, meter.limitTokens)
  if (ratio === undefined) {
    return {
      status: 'unavailable',
      source: 'token-meter',
      safeMessage: 'Token meter facts were incomplete',
    }
  }
  return {
    status: 'ready',
    usedTokens: meter.usedTokens,
    limitTokens: meter.limitTokens,
    remainingRatio: ratio,
    ...(meter.updatedAt === undefined ? {} : { updatedAt: meter.updatedAt }),
    source: 'token-meter',
    safeMessage: 'Context remaining from owner token meter',
  }
}

export function collectLimits(
  sessionRef: string,
  adapters: readonly ProviderLimitAdapter[] = [],
): SessionLimitWindowV1[] {
  const windows: SessionLimitWindowV1[] = []
  for (const adapter of adapters) {
    if (windows.length >= SESSION_STATUS_LIMIT_BOUND) break
    const window = adapter.snapshot(sessionRef)
    if (window === null) continue
    windows.push(window)
  }
  return windows
}

export function assembleSessionStatusSnapshot(sources: SessionStatusSources): SessionStatusSnapshotV1 {
  const sessionRef = parseSafeSessionRef(sources.session.sessionRef)
  const context = projectContext({
    tokenMeter: sources.tokenMeter,
    ownerContext: sources.ownerContext,
  })
  const limits = collectLimits(sessionRef, sources.adapters)
  const status = overallStatus({
    sessionReady: sources.session.lifecycle !== 'unknown',
    context,
    limits,
  })
  const freshness = status === 'unavailable'
    ? 'unknown'
    : context.status === 'stale' || limits.some(limit => limit.status === 'stale')
      ? 'stale'
      : 'fresh'
  const snapshot: SessionStatusSnapshotV1 = {
    schemaVersion: SESSION_STATUS_SCHEMA_VERSION,
    revision: sources.revision ?? 1,
    generatedAt: sources.generatedAt ?? new Date(0).toISOString(),
    freshness,
    status,
    session: { ...sources.session, sessionRef },
    ...(sources.runtime === undefined ? {} : { runtime: sources.runtime }),
    context,
    limits,
  }
  return parseSessionStatusSnapshot(snapshot)
}

export function unavailableSnapshot(sessionRef: string, reason: string, generatedAt = new Date(0).toISOString()): SessionStatusSnapshotV1 {
  return assembleSessionStatusSnapshot({
    session: {
      sessionRef,
      label: 'Session',
      lifecycle: 'unknown',
    },
    ownerContext: {
      status: 'unavailable',
      source: 'none',
      safeMessage: reason,
    },
    generatedAt,
    revision: 0,
  })
}

export function contextTone(remainingRatio: number | undefined, status: SourceStatus): 'neutral' | 'warning' | 'critical' {
  if (status === 'unavailable' || status === 'unsupported' || remainingRatio === undefined) {
    return 'neutral'
  }
  if (remainingRatio <= 0.10) return 'critical'
  if (remainingRatio <= 0.25) return 'warning'
  return 'neutral'
}
