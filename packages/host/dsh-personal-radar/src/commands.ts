/**
 * `/drama radar` command parser.
 *
 * Parsing only produces typed intents; the host adapter revalidates
 * capability, lane, scope, and idempotency before any dispatch. Unknown
 * subcommands and missing refs return usage guidance instead of guessing.
 */

import {
  RADAR_INTENT_KINDS,
  RADAR_INTENT_SCHEMA,
  isSafeRadarRef,
  type RadarIntentKind,
  type RadarIntentV1,
} from './contracts.js'

export const RADAR_COMMAND_USAGE = [
  '/drama radar',
  '/drama radar open <opportunity-ref>',
  '/drama radar save <opportunity-ref>',
  '/drama radar dismiss <opportunity-ref>',
  '/drama radar compare <ref-a> <ref-b>',
  '/drama radar proposal <opportunity-ref>',
  '/drama radar workbench <opportunity-or-edition-ref>',
  '/drama radar refresh',
] as const

export type RadarParseResult =
  | { readonly ok: true; readonly intent: RadarIntentV1 }
  | { readonly ok: false; readonly usage: boolean; readonly reason: string }

/** Deterministic idempotency key: identical input replays dedupe naturally. */
export function radarIdempotencyKey(kind: RadarIntentKind, refs: readonly string[], editionRef?: string): string {
  return `radar-${kind}-${[...refs, ...(editionRef === undefined ? [] : [editionRef])].join('.')}`
}

function buildIntent(
  kind: RadarIntentKind,
  refs: readonly string[],
  options: { readonly editionRef?: string; readonly confirmed?: boolean } = {},
): RadarIntentV1 {
  return {
    schema: RADAR_INTENT_SCHEMA,
    kind,
    opportunityRefs: refs,
    ...(options.editionRef === undefined ? {} : { editionRef: options.editionRef }),
    idempotencyKey: radarIdempotencyKey(kind, refs, options.editionRef),
    confirmed: options.confirmed ?? false,
  }
}

const SUBCOMMAND_REF_RULES: Readonly<Record<string, { readonly min: number; readonly max: number }>> = {
  open: { min: 0, max: 1 },
  save: { min: 1, max: 1 },
  dismiss: { min: 1, max: 1 },
  compare: { min: 2, max: 2 },
  proposal: { min: 1, max: 1 },
  workbench: { min: 1, max: 1 },
  refresh: { min: 0, max: 0 },
}

function usageError(reason: string): RadarParseResult {
  return { ok: false, usage: true, reason }
}

/**
 * Parse a raw `/drama radar ...` line. `refresh` requires the user to type
 * the confirmation word (`refresh confirm`) before the host dispatches
 * `edition_build`; parsing alone never marks an intent confirmed.
 */
export function parseRadarCommand(raw: string): RadarParseResult {
  const tokens = raw.trim().split(/\s+/u).filter(token => token.length > 0)
  if (tokens.length === 0 || tokens[0] !== '/drama' || (tokens[1] !== undefined && tokens[1] !== 'radar')) {
    return usageError('command must start with /drama radar')
  }
  if (tokens.length === 1) {
    return { ok: true, intent: buildIntent('open', []) }
  }
  if (tokens.length === 2) {
    // Bare `/drama radar` opens the on-demand pane on the current projection.
    return { ok: true, intent: buildIntent('open', []) }
  }

  const subcommand = tokens[2]!.toLowerCase()
  if (!RADAR_INTENT_KINDS.includes(subcommand as RadarIntentKind)) {
    return usageError(`unknown radar subcommand ${JSON.stringify(tokens[2])}`)
  }
  const kind = subcommand as RadarIntentKind
  if (kind === 'refresh') {
    const extra = tokens.slice(3)
    if (extra.length === 0) return { ok: true, intent: buildIntent('refresh', []) }
    if (extra.length === 1 && extra[0] === 'confirm') {
      return { ok: true, intent: buildIntent('refresh', [], { confirmed: true }) }
    }
    return usageError('refresh accepts no refs; use "refresh confirm" after reviewing the pane summary')
  }

  const rule = SUBCOMMAND_REF_RULES[kind]
  const refs = tokens.slice(3)
  if (rule === undefined) return usageError(`unknown radar subcommand ${JSON.stringify(subcommand)}`)
  if (refs.length < rule.min || refs.length > rule.max) {
    return usageError(`${subcommand} needs ${rule.min === rule.max ? `${rule.min}` : `${rule.min}..${rule.max}`} ref(s), got ${refs.length}`)
  }
  for (const ref of refs) {
    if (!isSafeRadarRef(ref)) {
      return usageError(`ref ${JSON.stringify(ref)} failed the safety check`)
    }
  }
  if (kind === 'workbench' && refs.length === 1 && refs[0]!.startsWith('edition:')) {
    return { ok: true, intent: buildIntent('workbench', [], { editionRef: refs[0] }) }
  }
  return { ok: true, intent: buildIntent(kind, refs) }
}
