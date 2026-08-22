/** Safe Plan / Skills / Invocations projection. Never stores raw prompts or CoT. */

export type AgentContextTab = 'plan' | 'skills' | 'invocations'
export type AgentContextFreshness = 'fresh' | 'stale' | 'unknown'
export type PlanStepStatus = 'pending' | 'running' | 'blocked' | 'accepted' | 'rejected' | 'unknown'
export type SkillScope = 'agent' | 'session' | 'preset' | 'workspace'
export type SkillState = 'available' | 'active' | 'invoked' | 'missing' | 'disabled'

const SAFE_ID = /^[a-z0-9][a-z0-9._:/-]*$/i
const UNSAFE = /rawPrompt|privateArguments|providerPayload|authorization|cookie|token/i

export interface PlanStepV1 {
  readonly id: string
  readonly title: string
  readonly status: PlanStepStatus
  readonly requiredSkills: readonly string[]
  readonly recommendedSkills: readonly string[]
  readonly blocker?: string
}

export interface SkillRecordV1 {
  readonly id: string
  readonly label: string
  readonly source: string
  readonly version: string
  readonly scope: SkillScope
  readonly state: SkillState
}

export interface InvocationRecordV1 {
  readonly id: string
  readonly skillId: string
  readonly stepId?: string
  readonly status: 'running' | 'accepted' | 'rejected' | 'unknown'
  readonly summary: string
  readonly evidenceRef?: string
}

export interface AgentContextSource {
  readonly sessionRef: string
  readonly planMode?: string
  readonly steps?: readonly Partial<PlanStepV1>[]
  readonly skills?: readonly Partial<SkillRecordV1>[]
  readonly invocations?: readonly Partial<InvocationRecordV1>[]
  readonly freshness?: AgentContextFreshness
  readonly generation: number
}

export interface AgentContextProjectionV1 {
  readonly sessionRef: string
  readonly planMode: string
  readonly steps: readonly PlanStepV1[]
  readonly skills: readonly SkillRecordV1[]
  readonly invocations: readonly InvocationRecordV1[]
  readonly selectedStepId?: string
  readonly freshness: AgentContextFreshness
  readonly generation: number
}

function safeId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 && SAFE_ID.test(value) ? value : undefined
}

function safeLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 160 || UNSAFE.test(value)) return fallback
  return value
}

const STEP_STATUS: readonly PlanStepStatus[] = ['pending', 'running', 'blocked', 'accepted', 'rejected', 'unknown']
const SKILL_SCOPE: readonly SkillScope[] = ['agent', 'session', 'preset', 'workspace']
const SKILL_STATE: readonly SkillState[] = ['available', 'active', 'invoked', 'missing', 'disabled']
const INVOCATION_STATUS = ['running', 'accepted', 'rejected', 'unknown'] as const

function projectStep(input: Partial<PlanStepV1>, index: number): PlanStepV1 | undefined {
  const id = safeId(input.id) ?? `step:${index + 1}`
  if (UNSAFE.test(JSON.stringify(input))) return undefined
  const status = STEP_STATUS.includes(input.status as PlanStepStatus) ? input.status as PlanStepStatus : 'unknown'
  return {
    id,
    title: safeLabel(input.title, id),
    status,
    requiredSkills: (input.requiredSkills ?? []).filter(item => safeId(item) !== undefined),
    recommendedSkills: (input.recommendedSkills ?? []).filter(item => safeId(item) !== undefined),
    ...(typeof input.blocker === 'string' && input.blocker.length > 0 && input.blocker.length <= 200 ? { blocker: input.blocker } : {}),
  }
}

function projectSkill(input: Partial<SkillRecordV1>): SkillRecordV1 | undefined {
  const id = safeId(input.id)
  if (id === undefined || UNSAFE.test(JSON.stringify(input))) return undefined
  return {
    id,
    label: safeLabel(input.label, id),
    source: safeLabel(input.source, 'unknown'),
    version: safeLabel(input.version, 'unknown'),
    scope: SKILL_SCOPE.includes(input.scope as SkillScope) ? input.scope as SkillScope : 'session',
    state: SKILL_STATE.includes(input.state as SkillState) ? input.state as SkillState : 'available',
  }
}

function projectInvocation(input: Partial<InvocationRecordV1>, index: number): InvocationRecordV1 | undefined {
  const id = safeId(input.id) ?? `invocation:${index + 1}`
  const skillId = safeId(input.skillId)
  if (skillId === undefined || UNSAFE.test(JSON.stringify(input))) return undefined
  const status = INVOCATION_STATUS.includes(input.status as InvocationRecordV1['status'])
    ? input.status as InvocationRecordV1['status']
    : 'unknown'
  return {
    id,
    skillId,
    ...(safeId(input.stepId) === undefined ? {} : { stepId: input.stepId }),
    status,
    summary: safeLabel(input.summary, 'completed'),
    ...(safeId(input.evidenceRef) === undefined ? {} : { evidenceRef: input.evidenceRef }),
  }
}

/** Fold owner snapshots into a bounded Agent Context projection. */
export function projectAgentContext(source: AgentContextSource, selectedStepId?: string): AgentContextProjectionV1 {
  const steps = (source.steps ?? []).map(projectStep).filter((item): item is PlanStepV1 => item !== undefined).slice(0, 200)
  const skills = (source.skills ?? []).map(item => projectSkill(item)).filter((item): item is SkillRecordV1 => item !== undefined).slice(0, 200)
  const invocations = (source.invocations ?? []).map(projectInvocation).filter((item): item is InvocationRecordV1 => item !== undefined).slice(0, 200)
  const selected = selectedStepId !== undefined && steps.some(step => step.id === selectedStepId) ? selectedStepId : undefined
  return {
    sessionRef: safeId(source.sessionRef) ?? 'session:unknown',
    planMode: safeLabel(source.planMode, 'unknown'),
    steps,
    skills,
    invocations,
    ...(selected === undefined ? {} : { selectedStepId: selected }),
    freshness: source.freshness === 'fresh' || source.freshness === 'stale' ? source.freshness : 'unknown',
    generation: source.generation,
  }
}

export function highlightedSkills(projection: AgentContextProjectionV1): ReadonlySet<string> {
  const step = projection.steps.find(item => item.id === projection.selectedStepId)
  if (step === undefined) return new Set()
  return new Set([...step.requiredSkills, ...step.recommendedSkills])
}
