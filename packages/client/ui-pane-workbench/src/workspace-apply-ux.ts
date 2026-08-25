import {
  applyWorkspaceDraft,
  createApplyWorkspaceDraftIntent,
  validateApplyWorkspaceDraft,
} from './workspace-apply.js'
import {
  createPaneWorkspaceDraft,
  serializePaneWorkspaceDraft,
  type PaneWorkspaceDraftScopeV1,
  type PaneWorkspaceDraftV1,
  type PaneWorkspaceProviderPlacementV1,
} from './workspace-draft.js'
import {
  createPaneWorkspacePresetService,
  type PaneWorkspacePresetServiceV1,
} from './workspace-preset.js'
import type { PaneRegionId, PaneViewInstanceV1, PaneWorkspaceV1 } from './workspace.js'

export const WORKSPACE_APPLY_KEEP_IN_PLACE = 'keep-in-place' as const

export type WorkspaceApplyReceiptStatusV1 = 'accepted' | 'blocked' | 'unknown'
export type WorkspaceApplyActionV1 = 'apply' | 'save'
export type WorkspaceApplyChangeKindV1 = 'region' | 'placement' | 'rail' | 'motion' | 'scope'
export type WorkspaceApplyRiskKindV1 = 'dirty' | 'deny' | 'capability' | 'scope' | 'keep-in-place'
export type WorkspaceApplyViewLifecycleV1 = 'ready' | 'running' | 'approval_required'

export interface WorkspaceApplyChangeV1 {
  readonly kind: WorkspaceApplyChangeKindV1
  readonly path: string
  readonly before: string
  readonly after: string
}

export interface WorkspaceApplyDiffV1 {
  readonly changes: readonly WorkspaceApplyChangeV1[]
  readonly dirty: boolean
}

export interface WorkspaceApplyRiskV1 {
  readonly kind: WorkspaceApplyRiskKindV1
  readonly code: string
  readonly message: string
  readonly viewId?: string
  readonly keepInPlace: boolean
}

export interface WorkspaceApplyRiskReportV1 {
  readonly blockers: readonly WorkspaceApplyRiskV1[]
  readonly warnings: readonly WorkspaceApplyRiskV1[]
  readonly keepInPlace: readonly WorkspaceApplyRiskV1[]
  readonly canApply: boolean
}

export interface WorkspaceApplyReceiptV1 {
  readonly action: WorkspaceApplyActionV1
  readonly status: WorkspaceApplyReceiptStatusV1
  readonly reason?: string
  readonly generation?: number
}

export interface WorkspaceApplyRollbackEntryV1 {
  readonly id: string
  readonly workspace: PaneWorkspaceV1
  readonly autoRetry: false
}

export interface WorkspaceApplyUxOptionsV1 {
  readonly capabilities?: ReadonlySet<string>
  readonly allowedScopes?: readonly PaneWorkspaceDraftScopeV1[]
  readonly viewLifecycle?: Readonly<Record<string, WorkspaceApplyViewLifecycleV1>>
  readonly presetService?: PaneWorkspacePresetServiceV1
  readonly presetName?: string
}

export interface WorkspaceApplyUxV1 {
  readonly diff: WorkspaceApplyDiffV1
  readonly risks: WorkspaceApplyRiskReportV1
  readonly lastReceipt?: WorkspaceApplyReceiptV1
  readonly rollback?: WorkspaceApplyRollbackEntryV1
}

export interface WorkspaceApplySubmitResultV1 {
  readonly workspace: PaneWorkspaceV1
  readonly receipt: WorkspaceApplyReceiptV1
  readonly rollback: WorkspaceApplyRollbackEntryV1
  readonly diff: WorkspaceApplyDiffV1
  readonly risks: WorkspaceApplyRiskReportV1
}

const KEEP_IN_PLACE_PLACEMENT: PaneWorkspaceProviderPlacementV1 = {
  kind: WORKSPACE_APPLY_KEEP_IN_PLACE,
  region: 'right',
  role: 'content',
}

function encode(value: unknown): string {
  return JSON.stringify(value)
}

function cloneWorkspace(workspace: PaneWorkspaceV1): PaneWorkspaceV1 {
  return JSON.parse(JSON.stringify(workspace)) as PaneWorkspaceV1
}

function viewLifecycle(
  view: PaneViewInstanceV1,
  override?: Readonly<Record<string, WorkspaceApplyViewLifecycleV1>>,
): WorkspaceApplyViewLifecycleV1 {
  const hinted = override?.[view.id]
  if (hinted === 'running' || hinted === 'approval_required' || hinted === 'ready') return hinted
  const raw = view.metadata?.lifecycle ?? view.metadata?.status
  if (raw === 'running' || raw === 'approval_required') return raw
  return 'ready'
}

function pushChange(
  changes: WorkspaceApplyChangeV1[],
  kind: WorkspaceApplyChangeKindV1,
  path: string,
  before: unknown,
  after: unknown,
): void {
  const left = encode(before)
  const right = encode(after)
  if (left === right) return
  changes.push({ kind, path, before: left, after: right })
}

export function workspaceApplyAutoRetries(): false {
  return false
}

export function diffLiveWorkspaceAndDraft(
  live: PaneWorkspaceV1,
  draft: PaneWorkspaceDraftV1,
): WorkspaceApplyDiffV1 {
  const baseline = createPaneWorkspaceDraft(live)
  const changes: WorkspaceApplyChangeV1[] = []
  for (const region of ['right', 'bottom'] as const) {
    const liveRegion = live.regions[region]
    const draftRegion = draft.regions[region]
    pushChange(changes, 'region', `regions.${region}.visible`, liveRegion.visible, draftRegion.visible)
    pushChange(changes, 'region', `regions.${region}.size`, liveRegion.size, draftRegion.size)
    pushChange(changes, 'region', `regions.${region}.root`, liveRegion.root, draftRegion.root)
  }
  pushChange(changes, 'placement', 'providerPlacements', baseline.providerPlacements, draft.providerPlacements)
  pushChange(changes, 'rail', 'railOrder', baseline.railOrder, draft.railOrder)
  pushChange(changes, 'motion', 'motionPreference', baseline.motionPreference, draft.motionPreference)
  pushChange(changes, 'scope', 'scope', baseline.scope, draft.scope)
  return { changes, dirty: changes.length > 0 }
}

export function withKeepInPlaceDraft(draft: PaneWorkspaceDraftV1): PaneWorkspaceDraftV1 {
  if (draft.providerPlacements.some(placement => placement.kind === WORKSPACE_APPLY_KEEP_IN_PLACE)) {
    return serializePaneWorkspaceDraft(draft)
  }
  return serializePaneWorkspaceDraft({
    ...draft,
    providerPlacements: [...draft.providerPlacements, KEEP_IN_PLACE_PLACEMENT],
  })
}

function toRisk(
  kind: WorkspaceApplyRiskKindV1,
  code: string,
  message: string,
  keepInPlace: boolean,
  viewId?: string,
): WorkspaceApplyRiskV1 {
  return { kind, code, message, keepInPlace, viewId }
}

function wouldDropGroup(draft: PaneWorkspaceDraftV1, groupId: string): boolean {
  return draft.groups[groupId] === undefined
}

/**
 * running/approval_required 与 dirty/deny 默认 keep-in-place：只提示，不把关闭写进 Apply。
 */
export function collectWorkspaceApplyRisks(
  live: PaneWorkspaceV1,
  draft: PaneWorkspaceDraftV1,
  options: WorkspaceApplyUxOptionsV1 = {},
): WorkspaceApplyRiskReportV1 {
  const intent = createApplyWorkspaceDraftIntent(draft, live.generation)
  const report = validateApplyWorkspaceDraft(live, intent)
  const blockers: WorkspaceApplyRiskV1[] = []
  const warnings: WorkspaceApplyRiskV1[] = []
  const keepInPlace: WorkspaceApplyRiskV1[] = []

  for (const issue of report.blockers) {
    if (issue.code === 'dirty' || issue.code === 'deny') {
      const risk = toRisk(issue.code, issue.code, issue.message, true)
      keepInPlace.push(risk)
      warnings.push(risk)
      continue
    }
    blockers.push(toRisk(issue.code === 'scope' ? 'scope' : 'capability', issue.code, issue.message, false))
  }
  for (const issue of report.warnings) {
    warnings.push(toRisk('capability', issue.code, issue.message, false))
  }

  for (const view of Object.values(live.views)) {
    const lifecycle = viewLifecycle(view, options.viewLifecycle)
    const dropping = wouldDropGroup(draft, view.groupId)
    const message = dropping ? `${view.title} stays in place` : `${view.title} remains open`
    const reasons: Array<{ kind: WorkspaceApplyRiskKindV1; code: string }> = []
    if (view.dirty) reasons.push({ kind: 'dirty', code: 'dirty' })
    if (view.closePolicy === 'deny') reasons.push({ kind: 'deny', code: 'deny' })
    if (lifecycle === 'running' || lifecycle === 'approval_required') {
      reasons.push({ kind: 'keep-in-place', code: lifecycle })
    }
    for (const reason of reasons) {
      if (keepInPlace.some(item => item.viewId === view.id && item.code === reason.code)) continue
      const risk = toRisk(reason.kind, reason.code, message, true, view.id)
      keepInPlace.push(risk)
      warnings.push(risk)
    }
  }

  if (options.capabilities !== undefined) {
    for (const placement of draft.providerPlacements) {
      if (placement.kind === WORKSPACE_APPLY_KEEP_IN_PLACE) continue
      if (options.capabilities.has(placement.kind)) continue
      warnings.push(toRisk('capability', 'capability', `${placement.kind} is unavailable`, false))
    }
  }

  const allowedScopes = options.allowedScopes
  if (allowedScopes !== undefined && !allowedScopes.includes(draft.scope)) {
    blockers.push(toRisk('scope', 'scope', `${draft.scope} scope is not permitted`, false))
  }

  return {
    blockers,
    warnings,
    keepInPlace,
    canApply: blockers.length === 0,
  }
}

export function inspectWorkspaceApplyUx(
  live: PaneWorkspaceV1,
  draft: PaneWorkspaceDraftV1,
  options: WorkspaceApplyUxOptionsV1 = {},
  extras: Pick<WorkspaceApplyUxV1, 'lastReceipt' | 'rollback'> = {},
): WorkspaceApplyUxV1 {
  return {
    diff: diffLiveWorkspaceAndDraft(live, draft),
    risks: collectWorkspaceApplyRisks(live, draft, options),
    lastReceipt: extras.lastReceipt,
    rollback: extras.rollback,
  }
}

export function createWorkspaceApplyRollback(live: PaneWorkspaceV1): WorkspaceApplyRollbackEntryV1 {
  return {
    id: `rollback:${live.generation}`,
    workspace: cloneWorkspace(live),
    autoRetry: false,
  }
}

export function restoreWorkspaceFromRollback(entry: WorkspaceApplyRollbackEntryV1): PaneWorkspaceV1 {
  return cloneWorkspace(entry.workspace)
}

export function submitWorkspaceApply(
  live: PaneWorkspaceV1,
  draft: PaneWorkspaceDraftV1,
  options: WorkspaceApplyUxOptionsV1 = {},
): WorkspaceApplySubmitResultV1 {
  const diff = diffLiveWorkspaceAndDraft(live, draft)
  const risks = collectWorkspaceApplyRisks(live, draft, options)
  const rollback = createWorkspaceApplyRollback(live)
  if (!risks.canApply) {
    return {
      workspace: live,
      receipt: {
        action: 'apply',
        status: 'blocked',
        reason: risks.blockers[0]?.code ?? 'apply_blocked',
        generation: live.generation,
      },
      rollback,
      diff,
      risks,
    }
  }

  // keep-in-place 只注入 Apply intent，不改用户 draft，也不对 unknown/blocked 自动重试。
  const intent = createApplyWorkspaceDraftIntent(withKeepInPlaceDraft(draft), live.generation)
  const applied = applyWorkspaceDraft(live, intent)
  if (applied.accepted) {
    return {
      workspace: applied.state,
      receipt: { action: 'apply', status: 'accepted', reason: applied.reason, generation: applied.state.generation },
      rollback,
      diff,
      risks,
    }
  }
  return {
    workspace: live,
    receipt: {
      action: 'apply',
      status: applied.reason === undefined ? 'unknown' : 'blocked',
      reason: applied.reason ?? 'unknown',
      generation: live.generation,
    },
    rollback,
    diff,
    risks,
  }
}

export async function saveWorkspaceDraftWithUx(
  draft: PaneWorkspaceDraftV1,
  options: WorkspaceApplyUxOptionsV1 = {},
): Promise<WorkspaceApplyReceiptV1> {
  const allowedScopes = options.allowedScopes
  if (allowedScopes !== undefined && !allowedScopes.includes(draft.scope)) {
    return { action: 'save', status: 'blocked', reason: 'scope' }
  }
  const service = options.presetService ?? createPaneWorkspacePresetService()
  try {
    const result = await service.create(options.presetName ?? 'Workspace draft', draft.scope, draft)
    if (result.status === 'ok') return { action: 'save', status: 'accepted', reason: result.action }
    if (result.status === 'rejected' || result.status === 'permission_denied') {
      return { action: 'save', status: 'blocked', reason: result.status }
    }
    return { action: 'save', status: 'unknown', reason: result.status }
  } catch {
    return { action: 'save', status: 'unknown', reason: 'unknown' }
  }
}
