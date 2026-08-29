/**
 * Regenerates the canonical V2 bridge conformance fixtures.
 *
 * Run after deliberate contract changes only (the fixture version must then
 * be bumped): `node scripts/generate-bridge-fixtures.mjs`. Fixtures are the
 * cross-repository gate — Workbench consumers read the same files.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BRIDGE_V2_FIXTURE_VERSION,
  buildBridgeFixtureEnvelope,
} from '../lib/index.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(here, '..', 'fixtures', 'dsh-workbench-ai-drama-bridge-v2')
const caseDir = join(fixtureDir, 'cases')
mkdirSync(caseDir, { recursive: true })

const OWNER_CURRENT = { resourceExists: true, principalAuthorized: true, ownerResourceVersion: 'r42', ownerContextRevision: 7 }

/** Deep-clone with overrides applied at the top level of `envelope`. */
function envelope(overrides = {}) {
  return JSON.parse(JSON.stringify(buildBridgeFixtureEnvelope(overrides)))
}

const cases = []

function add(id, kind, actor, category, describe, given, expect) {
  cases.push({ id, kind, actor, category, describe, given, expect })
}

/* --- intent → lens mapping (design §8 row 1) --- */
const INTENTS = [
  ['open_show', 'creative_production', 'show_overview'],
  ['open_episode', 'creative_production', 'episode_timeline'],
  ['open_artifact', 'creative_production', 'referenced_artifact'],
  ['open_review', 'review', 'review_context'],
  ['open_evidence', 'evidence', 'evidence_context'],
]
for (const [intent, lens, focus] of INTENTS) {
  add(
    `intent-${intent.replace(/_/g, '-')}`,
    'ingress',
    'both',
    'intent_mapping',
    `intent ${intent} opens the ${lens} lens focused on ${focus}`,
    { envelope: envelope({ presentationIntent: intent }), owner: OWNER_CURRENT },
    { ok: true, state: 'opened', lens, focus },
  )
}

/* --- closed-schema validation (design §8 row 2) --- */
// Negative payloads stay synthetic and secret-free per repo policy; URL /
// credential / absolute-path rejection is proven by unit tests, not by
// embedding those shapes in published fixture files.
add('reject-unknown-key', 'validate', 'both', 'closed_schema',
  'an envelope key outside the closed schema is rejected',
  { envelope: { ...envelope(), tracking: 'unexpected' } },
  { ok: false, reason: 'malformed' })
add('reject-oversized-ref', 'validate', 'both', 'closed_schema',
  'a ref beyond the 160-character bound is rejected',
  { envelope: envelope({ workspaceRef: `ws:${'x'.repeat(200)}` }) },
  { ok: false, reason: 'malformed' })
add('reject-missing-required-key', 'validate', 'both', 'closed_schema',
  'dropping a required field is rejected',
  { envelope: (() => { const copy = envelope(); delete copy.resourceRef; return copy })() },
  { ok: false, reason: 'malformed' })
add('reject-nonce-uppercase', 'validate', 'both', 'nonce',
  'a nonce that is not lowercase hex is a contract mismatch',
  { envelope: envelope({ nonce: 'ABCDEF0123456789ABCDEF0123456789' }) },
  { ok: false, reason: 'contract_mismatch' })
add('reject-nonce-short', 'validate', 'both', 'nonce',
  'a nonce shorter than 32 hex chars is a contract mismatch',
  { envelope: envelope({ nonce: '0123456789abcdef' }) },
  { ok: false, reason: 'contract_mismatch' })
add('reject-expired-envelope', 'validate', 'both', 'expiry',
  'an expiry in the past is terminal expired',
  { envelope: envelope({ expiresAtUnixMs: 1_799_999_999_000 }), nowMs: 1_800_000_000_000 },
  { ok: false, reason: 'expired' })
add('reject-wrong-direction', 'validate', 'both', 'direction',
  'any direction other than dsh_to_workbench is a contract mismatch',
  { envelope: envelope({ direction: 'workbench_to_dsh' }) },
  { ok: false, reason: 'contract_mismatch' })
add('reject-wrong-target-surface', 'validate', 'both', 'target_surface',
  'a target surface other than workbench.agent.spatial is a contract mismatch',
  { envelope: envelope({ targetSurfaceId: 'workbench.show-control-room' }) },
  { ok: false, reason: 'contract_mismatch' })
add('reject-unknown-intent', 'ingress', 'both', 'intent_enum',
  'an intent outside the closed enum is never approximated with a nearby lens',
  { envelope: envelope({ presentationIntent: 'open_bts' }), owner: OWNER_CURRENT },
  { ok: false, state: 'contract_mismatch', reason: 'contract_mismatch' })
add('reject-digest-tamper', 'validate', 'both', 'digest',
  'a corrupted canonical digest is rejected as malformed',
  { envelope: { ...envelope(), contractDigest: '0'.repeat(64) } },
  { ok: false, reason: 'malformed' })

add('reject-raw-route-input', 'ingress', 'consumer', 'ingress_input',
  'a browser-composed route string is never parsed as an envelope',
  { envelope: '/agent?lens=creative-production&ref=show:101', owner: OWNER_CURRENT },
  { ok: false, state: 'contract_mismatch', reason: 'contract_mismatch' })

/* --- owner version reconcile (design §8 row 3) --- */
add('version-match-opens', 'ingress', 'consumer', 'version',
  'matching resourceVersion and contextRevision open the lens',
  { envelope: envelope(), owner: OWNER_CURRENT },
  { ok: true, state: 'opened', lens: 'creative_production', focus: 'referenced_artifact' })
add('version-behind-reconciles', 'ingress', 'consumer', 'version',
  'a handoff version behind owner state requires reconcile without overwrite',
  { envelope: envelope({ resourceVersion: 'r41' }), owner: OWNER_CURRENT },
  { ok: false, state: 'reconcile_required', reason: 'reconcile_required' })
add('version-ahead-reconciles', 'ingress', 'consumer', 'version',
  'a handoff version ahead of owner state requires reconcile without overwrite',
  { envelope: envelope({ resourceVersion: 'r43' }), owner: OWNER_CURRENT },
  { ok: false, state: 'reconcile_required', reason: 'reconcile_required' })
add('resource-missing-reconciles', 'ingress', 'consumer', 'version',
  'a resource that no longer exists requires reconcile',
  { envelope: envelope(), owner: { ...OWNER_CURRENT, resourceExists: false } },
  { ok: false, state: 'reconcile_required', reason: 'reconcile_required' })

/* --- replay and permissions (design §8 row 4) --- */
add('replay-identical-idempotent', 'ingress', 'consumer', 'replay',
  'resubmitting the identical envelope returns the original consumption result',
  { envelope: envelope(), owner: OWNER_CURRENT, replayBefore: [{ envelope: envelope() }] },
  { ok: true, state: 'opened', lens: 'creative_production', focus: 'referenced_artifact' })
add('replay-conflict', 'ingress', 'consumer', 'replay',
  'the same nonce with a different canonical payload is a replay conflict',
  {
    envelope: envelope(),
    owner: OWNER_CURRENT,
    replayBefore: [{ envelope: envelope({ resourceRef: 'artifact:shot-boards-13' }) }],
  },
  { ok: false, state: 'replay_conflict', reason: 'replay_conflict' })
add('principal-denied', 'ingress', 'consumer', 'permission',
  'an unauthorized principal gets denied without resource disclosure',
  { envelope: envelope(), owner: { ...OWNER_CURRENT, principalAuthorized: false } },
  { ok: false, state: 'denied', reason: 'denied' })

/* --- capability selection (design §8 row 5) --- */
add('capability-v2-preferred', 'issue', 'provider', 'capability',
  'a fresh V2-capable consumer gets a V2 launch descriptor',
  { target: 'default', enabled: true },
  { ok: true, mode: 'v2' })
add('capability-legacy-only-fallback', 'issue', 'provider', 'capability',
  'a legacy-only consumer gets the explicitly labeled legacy bridge',
  { target: 'legacy-only', enabled: true },
  { ok: true, mode: 'legacy_bridge' })
add('capability-stale-disabled', 'issue', 'provider', 'capability',
  'a stale capability probe disables launch with a stable reason',
  { target: 'stale', enabled: true },
  { ok: false, reason: 'stale' })
add('capability-no-consumer', 'issue', 'provider', 'capability',
  'no registered target disables launch as target unavailable',
  { target: null, enabled: true },
  { ok: false, reason: 'target_unavailable' })
add('capability-incompatible-consumer', 'issue', 'provider', 'capability',
  'a consumer advertising no compatible contract is a contract mismatch',
  { target: 'incompatible', enabled: true },
  { ok: false, reason: 'contract_mismatch' })

/* --- provider lifecycle (issue/consume semantics + rollback) --- */
add('consume-launched', 'consume', 'provider', 'lifecycle',
  'a fresh launchRef consumes to launched',
  {},
  { ok: true, state: 'launched' })
add('consume-expired', 'consume', 'provider', 'lifecycle',
  'an expired launchRef consumes to expired without owner mutation',
  { advanceMs: 300_001 },
  { ok: false, state: 'expired', reason: 'expired' })
add('consume-unknown-ref', 'consume', 'provider', 'lifecycle',
  'an unknown launchRef consumes to unknown with no auto-retry',
  { launchRef: 'lref-000000000000000000000000' },
  { ok: false, state: 'unknown', reason: 'unknown' })
add('rollback-v2-disabled-legacy', 'issue', 'provider', 'rollback',
  'disabling the V2 flag stops V2 issuance and uses the labeled legacy bridge',
  { target: 'default', enabled: false },
  { ok: true, mode: 'legacy_bridge' })
add('issue-duplicate-canonical-idempotent', 'issue', 'provider', 'replay',
  'issuing the same canonical request twice returns one launchRef',
  { target: 'default', enabled: true, request: { nonce: '0123456789abcdef0123456789abcdef' }, repeat: 2 },
  { ok: true, mode: 'v2' })
add('issue-conflicting-replay-rejected', 'issue', 'provider', 'replay',
  'the same nonce with a different payload is rejected as a replay conflict',
  {
    target: 'default',
    enabled: true,
    request: { nonce: '0123456789abcdef0123456789abcdef' },
    conflictRequest: { nonce: '0123456789abcdef0123456789abcdef', resourceRef: 'artifact:other' },
  },
  { ok: false, reason: 'replay_conflict' })

/* --- materialize --- */
const manifest = {
  fixtureVersion: BRIDGE_V2_FIXTURE_VERSION,
  contract: 'dsh.workbench_ai_drama_bridge.v2',
  description: 'Canonical DSH → Workbench AI drama bridge V2 conformance fixtures. DSH executes provider and both cases; the Workbench consumer implements the same outcomes for consumer and both cases against this exact fixture version.',
  cases: [],
}

for (const fixture of cases) {
  const file = `cases/${fixture.id}.json`
  writeFileSync(join(fixtureDir, file), `${JSON.stringify(fixture, null, 2)}\n`)
  manifest.cases.push({ id: fixture.id, file, kind: fixture.kind, actor: fixture.actor })
}

writeFileSync(join(fixtureDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`wrote ${cases.length} fixture cases at fixtureVersion ${BRIDGE_V2_FIXTURE_VERSION}`)
