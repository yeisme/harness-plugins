/**
 * Local Ordo CLI read-only owner adapter.
 *
 * Host-only: invokes read-only `ordo team status --json`, `ordo doctor --json`,
 * and `ordo approval inspect <ref> --json`. Maps those envelopes into the
 * frozen Agent Ops / Team V1 projections and never creates a second ledger.
 * Missing binaries and failed commands become offline snapshots with a safe
 * reason — never demo rows, credentials, raw prompts, or absolute paths.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import type {
  OrdoAgentOpsActionDescriptor,
  OrdoAgentOpsCapacity,
  OrdoAgentOpsExpectedContext,
  OrdoAgentOpsRef,
  OrdoAgentOpsRunSummary,
  OrdoAgentOpsSnapshot,
} from './types.ts'
import type {
  OrdoTeamAssignmentV1,
  OrdoTeamCapabilityV1,
  OrdoTeamSnapshotV1,
  OrdoTeamTaskState,
  OrdoTeamTaskV1,
} from './team-projection.ts'
import { validateOrdoTeamSnapshot } from './team-projection.ts'
import { validateOrdoAgentOpsSnapshot } from './validation.ts'

const SCHEMA = 'ordo.agent_ops.snapshot.v1alpha1' as const
const TEAM_SCHEMA = 'ordo.team.snapshot.v1alpha1' as const
const OPAQUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u
const UNSAFE_TEXT = /(?:https?:\/\/|wss?:\/\/|\bBearer\b|\b(?:token|secret|credential|password|api[_-]?key)\b)|(?:^|[\s:=])(?:\/|[A-Z]:[\\/])/iu
const DEFAULT_CONTEXT: OrdoAgentOpsExpectedContext = Object.freeze({
  tenantRef: 'local' as OrdoAgentOpsRef,
  workspaceRef: 'local-workspace' as OrdoAgentOpsRef,
  principalRef: 'local-operator' as OrdoAgentOpsRef,
  contextRevision: 1,
  installationRef: 'dsh-ordo-agent-ops' as OrdoAgentOpsRef,
})

export interface OrdoCliExecResult {
  readonly status: number | null
  readonly stdout: string
  readonly errorCode?: string | undefined
}

export type OrdoCliExec = (argv: readonly string[]) => OrdoCliExecResult

export interface OrdoTeamOwnerSource {
  capability(): OrdoTeamCapabilityV1
  teamSnapshot(): OrdoTeamSnapshotV1 | undefined
}

export interface LocalOrdoCliOwner extends OrdoTeamOwnerSource {
  readonly expectedContext: OrdoAgentOpsExpectedContext
  snapshot(): OrdoAgentOpsSnapshot
}

export interface LocalOrdoCliOwnerOptions {
  readonly exec?: OrdoCliExec
  readonly expectedContext?: OrdoAgentOpsExpectedContext | undefined
  readonly now?: () => string
  readonly bin?: string
}

const TEAM_ARGV = ['team', 'status', '--json'] as const
const DOCTOR_ARGV = ['doctor', '--json'] as const

function approvalInspectArgv(previewRef: string): readonly string[] {
  return ['approval', 'inspect', previewRef, '--json']
}

export function spawnOrdoCli(argv: readonly string[], bin = process.env.ORDO_BIN ?? 'ordo'): OrdoCliExecResult {
  try {
    const result = spawnSync(bin, [...argv], {
      encoding: 'utf8',
      timeout: 8_000,
      maxBuffer: 1_048_576,
      cwd: process.cwd(),
      env: process.env,
    })
    const code = result.error !== undefined && 'code' in result.error
      ? String((result.error as NodeJS.ErrnoException).code ?? '')
      : undefined
    return {
      status: result.status,
      stdout: typeof result.stdout === 'string' ? result.stdout : '',
      errorCode: code === '' ? undefined : code,
    }
  } catch (error) {
    const code = error instanceof Error && 'code' in error
      ? String((error as NodeJS.ErrnoException).code ?? '')
      : undefined
    return { status: null, stdout: '', errorCode: code === '' ? undefined : code }
  }
}

export function createLocalOrdoCliOwner(options: LocalOrdoCliOwnerOptions = {}): LocalOrdoCliOwner {
  const expectedContext = options.expectedContext ?? DEFAULT_CONTEXT
  const exec = options.exec ?? ((argv) => spawnOrdoCli(argv, options.bin))
  const now = options.now ?? (() => new Date().toISOString())

  let cached: { at: number; value: { ops: OrdoAgentOpsSnapshot; team: OrdoTeamSnapshotV1 | undefined; capability: OrdoTeamCapabilityV1 } } | undefined
  const read = (): { ops: OrdoAgentOpsSnapshot; team: OrdoTeamSnapshotV1 | undefined; capability: OrdoTeamCapabilityV1 } => {
    const at = Date.now()
    if (cached !== undefined && at - cached.at < 250) return cached.value
    const teamResult = exec(TEAM_ARGV)
    const finish = (value: { ops: OrdoAgentOpsSnapshot; team: OrdoTeamSnapshotV1 | undefined; capability: OrdoTeamCapabilityV1 }) => {
      cached = { at, value }
      return value
    }
    if (teamResult.errorCode === 'ENOENT' || teamResult.errorCode === 'ENOTDIR') {
      return finish({
        ops: offlineSnapshot(expectedContext, now(), 'Local ordo CLI is not available.'),
        team: undefined,
        capability: { capability: 'ordo.team.v1', maturity: 'unavailable', reason: 'owner_service_missing' },
      })
    }
    if (teamResult.errorCode !== undefined || teamResult.status !== 0) {
      return finish({
        ops: offlineSnapshot(expectedContext, now(), 'Local ordo CLI read failed.'),
        team: undefined,
        capability: { capability: 'ordo.team.v1', maturity: 'unavailable', reason: 'owner_service_missing' },
      })
    }
    const teamEnvelope = parseEnvelope(teamResult.stdout)
    if (teamEnvelope === undefined) {
      return finish({
        ops: offlineSnapshot(expectedContext, now(), 'Local ordo CLI returned an unreadable projection.'),
        team: undefined,
        capability: { capability: 'ordo.team.v1', maturity: 'unavailable', reason: 'contract_mismatch' },
      })
    }
    if (teamEnvelope.failed) {
      return finish({
        ops: offlineSnapshot(expectedContext, now(), 'Local ordo CLI reported a failed read.'),
        team: undefined,
        capability: { capability: 'ordo.team.v1', maturity: 'unavailable', reason: 'owner_service_missing' },
      })
    }
    const doctor = parseOptionalEnvelope(exec(DOCTOR_ARGV))
    const previewRef = collectPreviewRef(teamEnvelope, doctor)
    const approval = previewRef === undefined
      ? undefined
      : parseOptionalEnvelope(exec(approvalInspectArgv(previewRef)))
    return finish(projectOwnerFacts(teamEnvelope, expectedContext, now(), doctor, approval))
  }

  return {
    expectedContext,
    snapshot(): OrdoAgentOpsSnapshot {
      return read().ops
    },
    capability(): OrdoTeamCapabilityV1 {
      return read().capability
    },
    teamSnapshot(): OrdoTeamSnapshotV1 | undefined {
      return read().team
    },
  }
}

function offlineSnapshot(
  context: OrdoAgentOpsExpectedContext,
  generatedAt: string,
  safeMessage: string,
): OrdoAgentOpsSnapshot {
  return {
    schemaVersion: SCHEMA,
    snapshotRef: 'ordo-cli:offline' as OrdoAgentOpsRef,
    snapshotVersion: 0,
    generatedAt,
    state: 'offline',
    freshness: 'offline',
    reasonCode: 'owner_projection_unavailable',
    source: 'owner-gated',
    safeMessage,
    context,
  }
}

function parseEnvelope(stdout: string): { failed: boolean; root: Record<string, unknown>; data: Record<string, unknown>; teams: readonly Record<string, unknown>[] } | undefined {
  const trimmed = stdout.trim()
  if (trimmed === '') return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    return undefined
  }
  const root = asRecord(parsed)
  if (root === undefined) return undefined
  const status = root.status
  const failed = status === 'failed' || status === 'error'
  const data = asRecord(root.data) ?? {}
  const teamsValue = data.teams
  const teams = Array.isArray(teamsValue)
    ? teamsValue.map(asRecord).filter((row): row is Record<string, unknown> => row !== undefined)
    : []
  const single = asRecord(data.team)
  if (single !== undefined && teams.every(row => row.team_id !== single.team_id)) teams.unshift(single)
  return { failed, root, data, teams }
}

function parseOptionalEnvelope(result: OrdoCliExecResult): ReturnType<typeof parseEnvelope> | undefined {
  if (result.errorCode === 'ENOENT' || result.errorCode === 'ENOTDIR') return undefined
  if (result.errorCode !== undefined) return undefined
  const parsed = parseEnvelope(result.stdout)
  if (parsed === undefined || parsed.failed) return undefined
  return parsed
}

function projectOwnerFacts(
  envelope: { root: Record<string, unknown>; data: Record<string, unknown>; teams: readonly Record<string, unknown>[] },
  expectedContext: OrdoAgentOpsExpectedContext,
  generatedAt: string,
  doctor?: ReturnType<typeof parseEnvelope>,
  approval?: ReturnType<typeof parseEnvelope>,
): { ops: OrdoAgentOpsSnapshot; team: OrdoTeamSnapshotV1 | undefined; capability: OrdoTeamCapabilityV1 } {
  const teamRow = envelope.teams.find(row => row.status === 'active') ?? envelope.teams[0]
  const evidenceRefs = collectEvidenceRefs(envelope, teamRow, doctor)
  const teamProjection = teamRow === undefined ? emptyTeamSnapshot(generatedAt) : projectTeamSnapshot(teamRow, generatedAt, evidenceRefs)
  if (teamRow !== undefined && teamProjection === undefined) {
    return {
      ops: offlineSnapshot(expectedContext, generatedAt, 'Ordo CLI projection did not match the DSH contract.'),
      team: undefined,
      capability: { capability: 'ordo.team.v1', maturity: 'unavailable', reason: 'contract_mismatch' },
    }
  }
  const validatedTeam = teamProjection === undefined ? undefined : validateOrdoTeamSnapshot(teamProjection)
  const run = teamRow === undefined ? undefined : projectRun(teamRow)
  const capacity = teamRow === undefined ? undefined : projectCapacity(teamRow)
  const actions = projectApprovalActions(approval, expectedContext, generatedAt)
  const opsCandidate: OrdoAgentOpsSnapshot = {
    schemaVersion: SCHEMA,
    snapshotRef: (opaque(String(teamRow?.team_id ?? 'ordo-cli:empty')) ?? 'ordo-cli:empty') as OrdoAgentOpsRef,
    snapshotVersion: 1,
    generatedAt,
    state: 'ready',
    freshness: 'fresh',
    reasonCode: 'owner_snapshot',
    source: 'owner',
    safeMessage: teamRow === undefined ? 'No Ordo team is registered.' : (safeText(String(teamRow.description ?? `Team ${String(teamRow.team_id)}`)) ?? 'Owner team projection.'),
    context: expectedContext,
    ...(run === undefined ? {} : { run }),
    ...(capacity === undefined ? {} : { capacity }),
    ...(actions.length > 0 ? { actions } : {}),
    ...(evidenceRefs.length > 0 ? { evidenceRefs } : {}),
  }
  const ops = validateOrdoAgentOpsSnapshot(opsCandidate) ?? offlineSnapshot(expectedContext, generatedAt, 'Ordo CLI projection did not match the DSH contract.')
  const live = ops.state === 'ready'
  return {
    ops,
    team: live ? validatedTeam : undefined,
    capability: live && validatedTeam !== undefined
      ? { capability: 'ordo.team.v1', maturity: 'readonly' }
      : { capability: 'ordo.team.v1', maturity: 'unavailable', reason: 'owner_service_missing' },
  }
}

function emptyTeamSnapshot(generatedAt: string): OrdoTeamSnapshotV1 {
  void generatedAt
  return {
    schemaVersion: TEAM_SCHEMA,
    teamRef: 'team:none',
    contextRevision: 1,
    generation: 1,
    cursor: 0,
    freshness: 'fresh',
    safeMessage: 'No Ordo team is registered.',
    tasks: [],
    assignments: [],
    actions: [],
  }
}

function projectTeamSnapshot(
  team: Record<string, unknown>,
  generatedAt: string,
  evidenceRefs: readonly string[] = [],
): OrdoTeamSnapshotV1 | undefined {
  void generatedAt
  const teamRef = opaque(String(team.team_id ?? ''))
  if (teamRef === undefined) return undefined
  const tasks = projectTasks(team)
  const assignments = projectAssignments(team, tasks)
  return {
    schemaVersion: TEAM_SCHEMA,
    teamRef,
    contextRevision: 1,
    generation: 1,
    cursor: 0,
    freshness: 'fresh',
    safeMessage: safeText(String(team.description ?? `Team ${teamRef}`)) ?? 'Owner team projection.',
    tasks,
    assignments,
    actions: [],
    ...(evidenceRefs.length > 0 ? { evidenceRefs } : {}),
  }
}

function collectPreviewRef(
  envelope: { root: Record<string, unknown>; data: Record<string, unknown>; teams: readonly Record<string, unknown>[] },
  doctor: ReturnType<typeof parseEnvelope> | undefined,
): string | undefined {
  const seen: string[] = []
  const push = (value: unknown): void => {
    if (typeof value !== 'string') return
    const ref = opaque(value)
    if (ref !== undefined && !seen.includes(ref)) seen.push(ref)
  }
  const walk = (record: Record<string, unknown> | undefined): void => {
    if (record === undefined) return
    push(record.preview_ref)
    const facts = asRecord(record.facts)
    if (facts !== undefined) push(facts.preview_ref)
    const data = asRecord(record.data)
    if (data !== undefined) {
      push(data.preview_ref)
      const nestedFacts = asRecord(data.facts)
      if (nestedFacts !== undefined) push(nestedFacts.preview_ref)
    }
  }
  walk(envelope.root)
  walk(envelope.data)
  for (const team of envelope.teams) {
    walk(team)
    if (Array.isArray(team.tasks)) {
      for (const row of team.tasks) walk(asRecord(row))
    }
  }
  if (doctor !== undefined) {
    walk(doctor.root)
    walk(doctor.data)
  }
  return seen[0]
}

function collectEvidenceRefs(
  envelope: { root: Record<string, unknown>; data: Record<string, unknown> },
  team: Record<string, unknown> | undefined,
  doctor: ReturnType<typeof parseEnvelope> | undefined,
): readonly OrdoAgentOpsRef[] {
  const refs: string[] = []
  const push = (value: unknown): void => {
    if (typeof value !== 'string') return
    const ref = opaque(value)
    if (ref !== undefined && !refs.includes(ref)) refs.push(ref)
  }
  const envelopeEvidence = envelope.root.evidence
  if (Array.isArray(envelopeEvidence)) for (const item of envelopeEvidence) push(item)
  if (team !== undefined && Array.isArray(team.evidence_refs)) for (const item of team.evidence_refs) push(item)
  const doctorEvidence = doctor?.data.evidence
  const doctorRecord = asRecord(doctorEvidence)
  if (typeof doctorRecord?.status === 'string') push(`evidence:${doctorRecord.status}`)
  if (Array.isArray(doctorEvidence)) for (const item of doctorEvidence) push(item)
  if (Array.isArray(doctor?.root.evidence)) for (const item of doctor.root.evidence) push(item)
  return refs.slice(0, 32) as OrdoAgentOpsRef[]
}

function projectApprovalActions(
  approval: ReturnType<typeof parseEnvelope> | undefined,
  expectedContext: OrdoAgentOpsExpectedContext,
  generatedAt: string,
): readonly OrdoAgentOpsActionDescriptor[] {
  void expectedContext
  if (approval === undefined) return []
  const facts = asRecord(approval.root.facts) ?? {}
  const data = approval.data
  const previewRef = opaque(String(facts.preview_ref ?? data.preview_ref ?? ''))
  if (previewRef === undefined) return []
  const expiresAt = typeof facts.expires_at === 'string' && Number.isFinite(Date.parse(facts.expires_at))
    ? facts.expires_at
    : generatedAt
  const digestSource = `${previewRef}:${String(facts.operation_id ?? 'approval')}:${expiresAt}`
  const digest = sha256Hex(digestSource)
  const safeEffect = safeText(String(facts.redacted_summary ?? facts.effect ?? 'Inspect owner approval preview.'))
    ?? 'Inspect owner approval preview.'
  const targetRef = opaque(String(facts.operation_id ?? previewRef)) ?? previewRef
  return [{
    actionType: 'ordo.approval.decide',
    decisionRef: previewRef as OrdoAgentOpsRef,
    targetRef: targetRef as OrdoAgentOpsRef,
    targetVersion: numberOr(facts.policy_revision, 1),
    ownerRef: 'ordo-cli' as OrdoAgentOpsRef,
    safeEffect,
    expiresAt,
    previewDigest: digest,
    contractDigest: digest,
  }]
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function projectTasks(team: Record<string, unknown>): readonly OrdoTeamTaskV1[] {
  const rows = Array.isArray(team.tasks) ? team.tasks : []
  const deliveryRef = opaque(String(team.team_id ?? 'team:none')) ?? 'team:none'
  const mapped: OrdoTeamTaskV1[] = []
  for (const row of rows) {
    const task = asRecord(row)
    if (task === undefined) continue
    const taskRef = opaque(String(task.task_id ?? ''))
    const title = safeText(String(task.subject ?? task.task_id ?? ''))
    if (taskRef === undefined || title === undefined) continue
    const status = String(task.status ?? 'pending')
    const state = mapTaskState(status)
    const assigneeRef = typeof task.assignee === 'string' ? opaque(slug(task.assignee)) : undefined
    const dependencies = Array.isArray(task.dependencies) ? task.dependencies : []
    mapped.push({
      taskRef,
      title,
      state,
      criticality: task.mode === 'write' ? 'critical' : 'normal',
      deliveryRef,
      blockerCount: Math.min(dependencies.length, 64),
      assigneeRef,
    })
  }
  return mapped
}

function projectAssignments(team: Record<string, unknown>, tasks: readonly OrdoTeamTaskV1[]): readonly OrdoTeamAssignmentV1[] {
  const members = Array.isArray(team.members) ? team.members : []
  const assignments: OrdoTeamAssignmentV1[] = []
  for (const row of members) {
    const member = asRecord(row)
    if (member === undefined) continue
    const agentRef = opaque(slug(String(member.name ?? '')))
    if (agentRef === undefined) continue
    const role = mapRole(String(member.role ?? ''))
    const assigned = tasks.filter(task => task.assigneeRef === agentRef)
    const targets = assigned.length > 0 ? assigned : tasks.slice(0, 1)
    if (targets.length === 0) continue
    for (const task of targets) {
      assignments.push({
        assignmentRef: opaque(`asg:${task.taskRef}:${agentRef}`) ?? `asg:${task.taskRef}`,
        agentRef,
        taskRef: task.taskRef,
        role,
        holder: task.assigneeRef === agentRef && role === 'writer',
      })
    }
  }
  return assignments.filter(assignment => opaque(assignment.assignmentRef) !== undefined && opaque(assignment.taskRef) !== undefined)
}

function projectRun(team: Record<string, unknown>): OrdoAgentOpsRunSummary | undefined {
  const runRef = opaque(String(team.team_id ?? ''))
  const safeTitle = safeText(String(team.description ?? team.team_id ?? ''))
  if (runRef === undefined || safeTitle === undefined) return undefined
  const tasks = Array.isArray(team.tasks) ? team.tasks : []
  const taskCount = tasks.length
  const completedTaskCount = tasks.filter((row) => asRecord(row)?.status === 'completed').length
  const attentionCount = tasks.filter((row) => {
    const status = asRecord(row)?.status
    return status === 'failed' || status === 'cancelled'
  }).length
  return {
    runRef: runRef as OrdoAgentOpsRef,
    state: team.status === 'archived' ? 'archived' : 'active',
    safeTitle,
    taskCount,
    completedTaskCount: Math.min(completedTaskCount, taskCount),
    attentionCount,
  }
}

function projectCapacity(team: Record<string, unknown>): OrdoAgentOpsCapacity | undefined {
  const policy = asRecord(team.policy)
  const members = Array.isArray(team.members) ? team.members : []
  const policyCap = numberOr(policy?.max_concurrent_members, numberOr(policy?.max_writers, members.length || 1))
  return {
    policyCap,
    observedOrRetained: members.length,
    qualifiedRoutes: members.filter((row) => {
      const status = asRecord(row)?.status
      return status === 'idle' || status === 'working'
    }).length,
    reservationState: 'not_reserved',
  }
}

function mapTaskState(status: string): OrdoTeamTaskState {
  if (status === 'completed') return 'completed'
  if (status === 'claimed') return 'assigned'
  if (status === 'in_progress' || status === 'in_flight') return 'running'
  if (status === 'failed' || status === 'cancelled') return 'blocked'
  return 'pending'
}

function mapRole(role: string): OrdoTeamAssignmentV1['role'] {
  const value = role.toLowerCase()
  if (value.includes('review')) return 'reviewer'
  if (value.includes('observe')) return 'observer'
  return 'writer'
}

function opaque(value: string): string | undefined {
  return OPAQUE.test(value) ? value : undefined
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^A-Za-z0-9._:-]+/gu, '-').replace(/^-+|-+$/gu, '')
}

function safeText(value: string): string | undefined {
  const trimmed = value.trim().slice(0, 512)
  if (trimmed.length === 0) return undefined
  if (/[\u0000-\u001f\u007f]/u.test(trimmed) || UNSAFE_TEXT.test(trimmed)) return undefined
  return trimmed
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}
