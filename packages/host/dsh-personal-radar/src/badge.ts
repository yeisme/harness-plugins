/**
 * Context badge model for the Drama Radar entry.
 *
 * The badge answers "how many fits today, how fresh" in one line. Every
 * state is expressed as text + icon + aria label; color is never the only
 * channel. The badge is visible for ready/degraded projections and degrades
 * to a read-only offline marker when the owner is unreachable.
 */

import type { RadarProjectionV1, RadarStatus } from './contracts.js'

export interface RadarBadgeModelV1 {
  readonly status: RadarStatus
  readonly text: string
  readonly icon: string
  readonly ariaLabel: string
  readonly action: 'open_pane' | 'read_only' | 'disabled'
  readonly reason?: string
}

const STATUS_ICONS: Readonly<Record<RadarStatus, string>> = {
  ready: '◉',
  empty: '○',
  degraded: '◔',
  stale: '◌',
  offline: '⛔',
  permission_denied: '🔒',
  contract_mismatch: '⚠',
  action_pending: '…',
  reconcile_required: '↻',
}

export const RADAR_STATUS_NEXT_ACTIONS: Readonly<Record<RadarStatus, string>> = {
  ready: 'open the Drama Radar pane to review fits',
  empty: 'run a radar refresh when new sources are available',
  degraded: 'open the pane; some lanes may be partial',
  stale: 'run /drama radar refresh to rebuild the edition',
  offline: 'offline; last safe projection is read-only until the owner returns',
  permission_denied: 'grant the radar lane permission, then retry',
  contract_mismatch: 'update short-drama-radar to a matching contract version',
  action_pending: 'an action is in flight; wait for the owner receipt',
  reconcile_required: 'reconcile the pending action by run ref before retrying',
}

function formatFreshness(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1) return 'fresh now'
  if (minutes < 60) return `fresh ${minutes}m`
  return `fresh ${Math.floor(minutes / 60)}h`
}

function formatObservedAt(observedAt: number): string {
  const date = new Date(observedAt)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function summarizeRadarBadge(projection: RadarProjectionV1): RadarBadgeModelV1 {
  const icon = STATUS_ICONS[projection.status]
  switch (projection.status) {
    case 'ready':
    case 'degraded': {
      const fits = projection.opportunities.length
      const newCount = projection.opportunities.filter(item => item.isNew).length
      const freshness = formatFreshness(projection.ageMs)
      const degradedSuffix = projection.status === 'degraded' ? ' · degraded' : ''
      return {
        status: projection.status,
        icon,
        text: `Radar · ${fits} fits · ${newCount} new · ${freshness}${degradedSuffix}`,
        ariaLabel: `Drama Radar: ${fits} fitting opportunities, ${newCount} new, ${freshness}${degradedSuffix}. ${RADAR_STATUS_NEXT_ACTIONS[projection.status]}.`,
        action: projection.status === 'ready' ? 'open_pane' : 'open_pane',
      }
    }
    case 'empty':
      return {
        status: 'empty',
        icon,
        text: 'Radar · no fits yet',
        ariaLabel: `Drama Radar: no fitting opportunities yet. ${RADAR_STATUS_NEXT_ACTIONS.empty}.`,
        action: 'open_pane',
      }
    case 'stale':
      return {
        status: 'stale',
        icon,
        text: `Radar · stale · ${formatFreshness(projection.ageMs)}`,
        ariaLabel: `Drama Radar: edition is stale. ${RADAR_STATUS_NEXT_ACTIONS.stale}.`,
        action: 'open_pane',
      }
    case 'offline':
      return {
        status: 'offline',
        icon,
        text: `Radar · offline · observed ${formatObservedAt(projection.observedAt)}`,
        ariaLabel: `Drama Radar is offline; showing the projection observed at ${formatObservedAt(projection.observedAt)}. Mutations are disabled. ${RADAR_STATUS_NEXT_ACTIONS.offline}.`,
        action: 'read_only',
      }
    case 'permission_denied':
      return {
        status: 'permission_denied',
        icon,
        text: 'Radar · permission denied',
        ariaLabel: `Drama Radar: lane permission denied. ${RADAR_STATUS_NEXT_ACTIONS.permission_denied}.`,
        action: 'disabled',
        reason: 'permission_denied',
      }
    case 'contract_mismatch':
      return {
        status: 'contract_mismatch',
        icon,
        text: 'Radar · contract mismatch',
        ariaLabel: `Drama Radar: owner contract mismatch. ${RADAR_STATUS_NEXT_ACTIONS.contract_mismatch}.`,
        action: 'disabled',
        reason: 'contract_mismatch',
      }
    default:
      return {
        status: projection.status,
        icon,
        text: `Radar · ${projection.status.replace(/_/gu, ' ')}`,
        ariaLabel: `Drama Radar: ${projection.status.replace(/_/gu, ' ')}. ${RADAR_STATUS_NEXT_ACTIONS[projection.status]}.`,
        action: 'disabled',
      }
  }
}

/** Badge visibility: summary for ready/degraded/empty, read-only marker for offline, hidden otherwise. */
export function isRadarBadgeVisible(status: RadarStatus): boolean {
  return status === 'ready' || status === 'degraded' || status === 'offline' || status === 'empty'
}
