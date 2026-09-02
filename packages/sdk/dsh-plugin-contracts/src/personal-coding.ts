import { DSH_PLUGIN_SURFACE_CONTRACT_V1 } from './surface.js'

export const PERSONAL_CODING_PARITY_VERSION_V1 = 'dsh.personal-coding.parity.v1' as const
export const ORDO_RUN_LAUNCH_UNAVAILABLE_REASON_V1 = 'ordo.run_launch.unavailable' as const

export interface PersonalCodingCommandFixtureV1 {
  readonly id: string
  readonly canonical_name: string
  readonly aliases: readonly string[]
  readonly owner: string
  readonly action_kind: string
  readonly available: boolean
  readonly disabled_reason_code?: string
}

export interface PersonalCodingViewFixtureV1 {
  readonly id: string
  readonly owner: string
  readonly kind: 'status' | 'list' | 'table' | 'detail' | 'timeline' | 'diff'
  readonly presentation: 'available' | 'retained-next'
}

export interface PersonalCodingActionFixtureV1 {
  readonly id: string
  readonly owner: string
  readonly effect: 'read' | 'mutation' | 'external_write' | 'danger'
  readonly risk: 'low' | 'medium' | 'high' | 'critical'
  readonly expected_revision: string
  readonly action_ref: string
}

export interface PersonalCodingContractFixtureV1 {
  readonly fixture_version: typeof PERSONAL_CODING_PARITY_VERSION_V1
  readonly contract_version: typeof DSH_PLUGIN_SURFACE_CONTRACT_V1
  readonly commands: readonly PersonalCodingCommandFixtureV1[]
  readonly views: readonly PersonalCodingViewFixtureV1[]
  readonly actions: readonly PersonalCodingActionFixtureV1[]
  readonly sample_preview: { readonly preview_ref: string; readonly revision: string; readonly digest: string }
  readonly sample_receipt: { readonly receipt_ref: string; readonly status: 'applied'; readonly revision: string }
}

const BASE_COMMANDS: readonly Omit<PersonalCodingCommandFixtureV1, 'available' | 'disabled_reason_code'>[] = [
  { id: 'candidate.diff', canonical_name: '/diff', aliases: [], owner: 'dsh-tui', action_kind: 'candidate.inspect' },
  { id: 'candidate.review', canonical_name: '/review', aliases: [], owner: 'dsh-tui', action_kind: 'candidate.review' },
  { id: 'session.resume', canonical_name: '/resume', aliases: ['/r'], owner: 'dsh', action_kind: 'session.resume' },
  { id: 'session.manage', canonical_name: '/session', aliases: ['/sessions'], owner: 'dsh', action_kind: 'session.manage' },
  { id: 'plugins.inspect', canonical_name: '/plugins', aliases: [], owner: 'harness-plugins', action_kind: 'plugins.inspect' },
  { id: 'ordo.run.launch', canonical_name: '/ordo run launch', aliases: [], owner: 'ordo', action_kind: 'ordo.run.launch' },
]

export function createPersonalCodingContractFixtureV1(options: { readonly ordo_run_launch_available: boolean; readonly web_views_available?: boolean }): PersonalCodingContractFixtureV1 {
  return {
    fixture_version: PERSONAL_CODING_PARITY_VERSION_V1,
    contract_version: DSH_PLUGIN_SURFACE_CONTRACT_V1,
    commands: BASE_COMMANDS.map(command => command.id === 'ordo.run.launch'
      ? {
          ...command,
          available: options.ordo_run_launch_available,
          ...(options.ordo_run_launch_available ? {} : { disabled_reason_code: ORDO_RUN_LAUNCH_UNAVAILABLE_REASON_V1 }),
        }
      : { ...command, available: true }),
    views: [
      { id: 'candidate.status', owner: 'dsh-tui', kind: 'status', presentation: options.web_views_available === true ? 'available' : 'retained-next' },
      { id: 'candidate.files', owner: 'dsh-tui', kind: 'list', presentation: options.web_views_available === true ? 'available' : 'retained-next' },
      { id: 'candidate.diff', owner: 'dsh-tui', kind: 'diff', presentation: options.web_views_available === true ? 'available' : 'retained-next' },
    ],
    actions: [{
      id: 'candidate.apply',
      owner: 'dsh-tui',
      effect: 'mutation',
      risk: 'high',
      expected_revision: 'candidate-r1',
      action_ref: 'action:candidate-apply:r1',
    }],
    sample_preview: { preview_ref: 'preview:candidate:r1', revision: 'candidate-r1', digest: 'sha256:fixture' },
    sample_receipt: { receipt_ref: 'receipt:candidate:r2', status: 'applied', revision: 'candidate-r2' },
  }
}

export interface PersonalCodingParityIssueV1 {
  readonly section: 'commands' | 'views' | 'actions'
  readonly id: string
  readonly field: string
}

/** 比较语义字段；presentation 可不同，因此不比较 Web/TUI 的渲染可用度。 */
export function comparePersonalCodingContractSemanticsV1(left: PersonalCodingContractFixtureV1, right: PersonalCodingContractFixtureV1): readonly PersonalCodingParityIssueV1[] {
  const issues: PersonalCodingParityIssueV1[] = []
  compareRows('commands', left.commands, right.commands, ['canonical_name', 'aliases', 'owner', 'action_kind', 'available', 'disabled_reason_code'], issues)
  compareRows('views', left.views, right.views, ['owner', 'kind'], issues)
  compareRows('actions', left.actions, right.actions, ['owner', 'effect', 'risk', 'expected_revision', 'action_ref'], issues)
  return issues
}

function compareRows(
  section: PersonalCodingParityIssueV1['section'],
  left: readonly { readonly id: string }[],
  right: readonly { readonly id: string }[],
  fields: readonly string[],
  issues: PersonalCodingParityIssueV1[],
): void {
  const rightById = new Map(right.map(row => [row.id, row]))
  for (const leftRow of left) {
    const rightRow = rightById.get(leftRow.id)
    if (rightRow === undefined) {
      issues.push({ section, id: leftRow.id, field: 'missing' })
      continue
    }
    for (const field of fields) {
      if (JSON.stringify((leftRow as Record<string, unknown>)[field]) !== JSON.stringify((rightRow as Record<string, unknown>)[field])) {
        issues.push({ section, id: leftRow.id, field })
      }
    }
  }
  const leftIds = new Set(left.map(row => row.id))
  for (const rightRow of right) if (!leftIds.has(rightRow.id)) issues.push({ section, id: rightRow.id, field: 'unexpected' })
}
