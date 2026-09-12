import type { BoundedSummary, ProjectionFreshness } from './projection.js'
import { redactDshPluginSurfaceText } from './surface.js'

/**
 * 做剧可视化流水线工作台（dsh-creative-pipeline-visual-workbench-v1）的浏览器安全投影合同族。
 * pre-1.0、ADD-only：只新增字段/类型，不改既有字段语义。
 * 节点只携带 bounded summary、safe opaque ref、version、status 与 layout；
 * 绝不携带正文、凭据、provider payload、绝对路径或完整运行真相。
 * unknown/stale/blocked/needs_contract 只禁用 mutation 并要求 owner reconcile，
 * 绝不自动 retry 或替换 writer。
 */
export const CREATIVE_PIPELINE_CONTRACT_V1 = 'dsh.creative-pipeline.v1' as const

export type CreativePipelineContractVersionV1 = typeof CREATIVE_PIPELINE_CONTRACT_V1
export type CreativePipelineNodeKindV1 = 'asset' | 'character' | 'scene' | 'shot' | 'candidate'
export type CreativePipelineNodeStatusV1 = 'ready' | 'draft' | 'pending_review' | 'blocked' | 'stale' | 'unavailable'
export type CreativePipelineRunStateKindV1 = 'running' | 'paused' | 'blocked' | 'stale' | 'unknown' | 'needs_contract' | 'partial'
export type CreativePipelineRunActionKindV1 = 'pause' | 'resume' | 'reconcile'
export type CreativeWorkSurfaceKindV1 = 'agent' | 'workbench'

/** 节点布局：画布坐标与尺寸，纯几何，不携带渲染指令 */
export interface CreativePipelineNodeLayoutV1 {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface CreativePipelineNodeProjectionV1 {
  readonly id: string
  readonly kind: CreativePipelineNodeKindV1
  /** owner 签发的 opaque ref；禁止路径分隔符、相对遍历与控制字符 */
  readonly ref: string
  readonly summary: BoundedSummary
  readonly version: string
  readonly status: CreativePipelineNodeStatusV1
  /** status 为 unavailable 时的有界原因（已过 redaction） */
  readonly unavailable_reason?: string
  readonly layout: CreativePipelineNodeLayoutV1
  readonly freshness: ProjectionFreshness
}

/** reference 边：只表达关系与 label，绝不触发执行 */
export interface CreativePipelineReferenceEdgeV1 {
  readonly id: string
  readonly kind: 'reference'
  readonly source: string
  readonly target: string
  readonly label?: string
}

/** execution 边：携带 input purpose、output version 与 owner projection ref；不兼容时保留 draft 与原因，不隐式转换 */
export interface CreativePipelineExecutionEdgeV1 {
  readonly id: string
  readonly kind: 'execution'
  readonly source: string
  readonly target: string
  readonly input_purpose: string
  readonly output_version: string
  readonly owner_projection_ref: string
  /** 不兼容连接保留为草案，原因有界且已脱敏 */
  readonly draft?: { readonly reason: string }
}

export type CreativePipelineEdgeProjectionV1 = CreativePipelineReferenceEdgeV1 | CreativePipelineExecutionEdgeV1

/** 运行状态点：reason（原因）、impact（影响范围）、next_action（下一动作提示）均有界且已脱敏 */
export interface CreativePipelineRunStateV1 {
  readonly state: CreativePipelineRunStateKindV1
  readonly reason: string
  readonly impact: string
  readonly next_action: string
}

/** 可用动作投影：pause/resume/reconcile，server-authored；不可用时必须带 disabled reason code */
export interface CreativePipelineRunActionV1 {
  readonly action: CreativePipelineRunActionKindV1
  readonly available: boolean
  readonly disabled_reason_code?: string
  readonly action_ref: string
  readonly expected_revision: string
}

export interface CreativePipelineRunProgressV1 {
  readonly completed: number
  readonly total: number
}

/** 运行观察投影：状态点 + server-authored 动作 + 可选进度；不是运行真相 */
export interface CreativePipelineRunProjectionV1 {
  readonly run_ref: string
  readonly revision: string
  readonly freshness: ProjectionFreshness
  readonly state: CreativePipelineRunStateV1
  readonly actions: readonly CreativePipelineRunActionV1[]
  readonly progress?: CreativePipelineRunProgressV1
}

/** 胶囊展开菜单的安全摘要字段：当前项目、工作面、工作上下文、运行状态与下一步 */
export interface WorkSurfaceCapsuleMenuV1 {
  readonly project: BoundedSummary
  readonly surface: CreativeWorkSurfaceKindV1
  readonly work_context: BoundedSummary
  readonly run_state: CreativePipelineRunStateKindV1
  readonly next_action: BoundedSummary
}

/**
 * Agent⇄工作台胶囊：切换只改变当前工作面，不改变项目、选区、运行状态或权限。
 * 未保存布局草案显示小圆点（unsaved_draft）；运行中显示状态点/进度（run）；
 * Agent 草案显示待审阅（pending_review），不得自动进入执行。
 */
export interface WorkSurfaceCapsuleV1 {
  readonly contract_version: CreativePipelineContractVersionV1
  readonly project_ref: string
  readonly surface: CreativeWorkSurfaceKindV1
  readonly unsaved_draft: boolean
  readonly pending_review: boolean
  readonly run?: {
    readonly state: CreativePipelineRunStateKindV1
    readonly progress?: CreativePipelineRunProgressV1
  }
  readonly menu: WorkSurfaceCapsuleMenuV1
}

export type CreativePipelineDecodeErrorCodeV1 =
  | 'pipeline.invalid_shape'
  | 'pipeline.unknown_version'
  | 'pipeline.unknown_enum'
  | 'pipeline.out_of_bounds'
  | 'pipeline.sensitive_field'
  | 'pipeline.private_path'

export type CreativePipelineDecodeResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: CreativePipelineDecodeErrorCodeV1; readonly reason: string }

const NODE_KINDS = new Set<CreativePipelineNodeKindV1>(['asset', 'character', 'scene', 'shot', 'candidate'])
const NODE_STATUSES = new Set<CreativePipelineNodeStatusV1>(['ready', 'draft', 'pending_review', 'blocked', 'stale', 'unavailable'])
const RUN_STATES = new Set<CreativePipelineRunStateKindV1>(['running', 'paused', 'blocked', 'stale', 'unknown', 'needs_contract', 'partial'])
const RUN_ACTIONS = new Set<CreativePipelineRunActionKindV1>(['pause', 'resume', 'reconcile'])
const SURFACES = new Set<CreativeWorkSurfaceKindV1>(['agent', 'workbench'])
const FRESHNESS = new Set<ProjectionFreshness>(['fresh', 'stale', 'unknown'])
const SENSITIVE_KEY = /(?:authorization|cookie|credential|password|provider_payload|raw_argv|raw_prompt|secret|system_prompt|token)/i
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|root|private|var|workspaces)(?:\/|$))/
/** opaque ref 禁路径分隔符、相对遍历、空白与控制字符 */
const UNSAFE_REF = /[\\/]|\.\.|\s|[\u0000-\u001F\u007F]/
const MAX_ID = 160
const MAX_TEXT = 4096
const MAX_ACTIONS = 8

class PipelineDecodeFailure extends Error {
  constructor(readonly code: CreativePipelineDecodeErrorCodeV1, message: string) {
    super(message)
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('pipeline.invalid_shape', `${path} must be an object`)
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (SENSITIVE_KEY.test(key)) fail('pipeline.sensitive_field', `${path}.${key} is sensitive`)
    if (!allowedSet.has(key)) fail('pipeline.invalid_shape', `${path}.${key} is not allowed`)
  }
}

function string(value: unknown, path: string, max = MAX_TEXT): string {
  if (typeof value !== 'string' || value.length === 0) fail('pipeline.invalid_shape', `${path} must be a non-empty string`)
  if (value.length > max) fail('pipeline.out_of_bounds', `${path} exceeds ${max} characters`)
  if (ABSOLUTE_PATH.test(value)) fail('pipeline.private_path', `${path} contains a private absolute path`)
  return value
}

function optionalString(value: unknown, path: string, max = MAX_TEXT): string | undefined {
  return value === undefined ? undefined : string(value, path, max)
}

function opaqueRef(value: unknown, path: string): string {
  const ref = string(value, path, MAX_ID)
  if (UNSAFE_REF.test(ref)) fail('pipeline.private_path', `${path} is not a safe opaque ref`)
  return ref
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail('pipeline.invalid_shape', `${path} must be boolean`)
  return value
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('pipeline.invalid_shape', `${path} must be a finite number`)
  return value
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail('pipeline.invalid_shape', `${path} must be a non-negative integer`)
  return value
}

function enumValue<T extends string>(value: unknown, values: ReadonlySet<T>, path: string): T {
  if (typeof value !== 'string' || !values.has(value as T)) fail('pipeline.unknown_enum', `${path} is not supported`)
  return value as T
}

function summary(value: unknown, path: string): BoundedSummary {
  const input = record(value, path)
  exactKeys(input, ['text', 'truncated'], path)
  return { text: string(input.text, `${path}.text`), truncated: boolean(input.truncated, `${path}.truncated`) }
}

function progress(value: unknown, path: string): CreativePipelineRunProgressV1 {
  const input = record(value, path)
  exactKeys(input, ['completed', 'total'], path)
  const completed = nonNegativeInteger(input.completed, `${path}.completed`)
  const total = nonNegativeInteger(input.total, `${path}.total`)
  if (completed > total) fail('pipeline.invalid_shape', `${path}.completed exceeds ${path}.total`)
  return { completed, total }
}

function layout(value: unknown, path: string): CreativePipelineNodeLayoutV1 {
  const input = record(value, path)
  exactKeys(input, ['x', 'y', 'width', 'height'], path)
  const width = finiteNumber(input.width, `${path}.width`)
  const height = finiteNumber(input.height, `${path}.height`)
  if (width <= 0 || height <= 0) fail('pipeline.invalid_shape', `${path} size must be positive`)
  return { x: finiteNumber(input.x, `${path}.x`), y: finiteNumber(input.y, `${path}.y`), width, height }
}

function decodeNode(input: unknown): CreativePipelineNodeProjectionV1 {
  const value = record(input, 'node')
  exactKeys(value, ['id', 'kind', 'ref', 'summary', 'version', 'status', 'unavailable_reason', 'layout', 'freshness'], 'node')
  const unavailableReason = optionalString(value.unavailable_reason, 'node.unavailable_reason')
  const status = enumValue(value.status, NODE_STATUSES, 'node.status')
  if (status === 'unavailable' && unavailableReason === undefined) fail('pipeline.invalid_shape', 'node.unavailable_reason is required when status is unavailable')
  return {
    id: string(value.id, 'node.id', MAX_ID),
    kind: enumValue(value.kind, NODE_KINDS, 'node.kind'),
    ref: opaqueRef(value.ref, 'node.ref'),
    summary: summary(value.summary, 'node.summary'),
    version: string(value.version, 'node.version', MAX_ID),
    status,
    ...(unavailableReason !== undefined ? { unavailable_reason: redactCreativePipelineText(unavailableReason) } : {}),
    layout: layout(value.layout, 'node.layout'),
    freshness: enumValue(value.freshness, FRESHNESS, 'node.freshness'),
  }
}

function decodeEdge(input: unknown): CreativePipelineEdgeProjectionV1 {
  const value = record(input, 'edge')
  const id = string(value.id, 'edge.id', MAX_ID)
  const source = string(value.source, 'edge.source', MAX_ID)
  const target = string(value.target, 'edge.target', MAX_ID)
  if (value.kind === 'reference') {
    exactKeys(value, ['id', 'kind', 'source', 'target', 'label'], 'edge')
    const label = optionalString(value.label, 'edge.label', MAX_ID)
    return { id, kind: 'reference', source, target, ...(label !== undefined ? { label } : {}) }
  }
  if (value.kind === 'execution') {
    exactKeys(value, ['id', 'kind', 'source', 'target', 'input_purpose', 'output_version', 'owner_projection_ref', 'draft'], 'edge')
    let draft: { readonly reason: string } | undefined
    if (value.draft !== undefined) {
      const draftInput = record(value.draft, 'edge.draft')
      exactKeys(draftInput, ['reason'], 'edge.draft')
      draft = { reason: redactCreativePipelineText(string(draftInput.reason, 'edge.draft.reason')) }
    }
    return {
      id,
      kind: 'execution',
      source,
      target,
      input_purpose: string(value.input_purpose, 'edge.input_purpose', MAX_ID),
      output_version: string(value.output_version, 'edge.output_version', MAX_ID),
      owner_projection_ref: opaqueRef(value.owner_projection_ref, 'edge.owner_projection_ref'),
      ...(draft !== undefined ? { draft } : {}),
    }
  }
  fail('pipeline.unknown_enum', 'edge.kind is not supported')
}

function decodeRunState(input: unknown): CreativePipelineRunStateV1 {
  const value = record(input, 'run.state')
  exactKeys(value, ['state', 'reason', 'impact', 'next_action'], 'run.state')
  return {
    state: enumValue(value.state, RUN_STATES, 'run.state.state'),
    reason: redactCreativePipelineText(string(value.reason, 'run.state.reason')),
    impact: redactCreativePipelineText(string(value.impact, 'run.state.impact')),
    next_action: redactCreativePipelineText(string(value.next_action, 'run.state.next_action')),
  }
}

function decodeRunAction(value: unknown, path: string): CreativePipelineRunActionV1 {
  const input = record(value, path)
  exactKeys(input, ['action', 'available', 'disabled_reason_code', 'action_ref', 'expected_revision'], path)
  const available = boolean(input.available, `${path}.available`)
  const disabledReasonCode = optionalString(input.disabled_reason_code, `${path}.disabled_reason_code`, MAX_ID)
  if (!available && disabledReasonCode === undefined) fail('pipeline.invalid_shape', `${path}.disabled_reason_code is required when unavailable`)
  return {
    action: enumValue(input.action, RUN_ACTIONS, `${path}.action`),
    available,
    ...(disabledReasonCode !== undefined ? { disabled_reason_code: disabledReasonCode } : {}),
    action_ref: opaqueRef(input.action_ref, `${path}.action_ref`),
    expected_revision: string(input.expected_revision, `${path}.expected_revision`, MAX_ID),
  }
}

function decodeRunProjection(input: unknown): CreativePipelineRunProjectionV1 {
  const value = record(input, 'run')
  exactKeys(value, ['run_ref', 'revision', 'freshness', 'state', 'actions', 'progress'], 'run')
  if (!Array.isArray(value.actions)) fail('pipeline.invalid_shape', 'run.actions must be an array')
  if (value.actions.length > MAX_ACTIONS) fail('pipeline.out_of_bounds', `run.actions exceeds ${MAX_ACTIONS} items`)
  return {
    run_ref: opaqueRef(value.run_ref, 'run.run_ref'),
    revision: string(value.revision, 'run.revision', MAX_ID),
    freshness: enumValue(value.freshness, FRESHNESS, 'run.freshness'),
    state: decodeRunState(value.state),
    actions: value.actions.map((item, index) => decodeRunAction(item, `run.actions[${index}]`)),
    ...(value.progress !== undefined ? { progress: progress(value.progress, 'run.progress') } : {}),
  }
}

function decodeCapsule(input: unknown): WorkSurfaceCapsuleV1 {
  const value = record(input, 'capsule')
  exactKeys(value, ['contract_version', 'project_ref', 'surface', 'unsaved_draft', 'pending_review', 'run', 'menu'], 'capsule')
  if (value.contract_version !== CREATIVE_PIPELINE_CONTRACT_V1) fail('pipeline.unknown_version', 'capsule.contract_version is not supported')
  let run: WorkSurfaceCapsuleV1['run']
  if (value.run !== undefined) {
    const runInput = record(value.run, 'capsule.run')
    exactKeys(runInput, ['state', 'progress'], 'capsule.run')
    run = {
      state: enumValue(runInput.state, RUN_STATES, 'capsule.run.state'),
      ...(runInput.progress !== undefined ? { progress: progress(runInput.progress, 'capsule.run.progress') } : {}),
    }
  }
  const menuInput = record(value.menu, 'capsule.menu')
  exactKeys(menuInput, ['project', 'surface', 'work_context', 'run_state', 'next_action'], 'capsule.menu')
  return {
    contract_version: CREATIVE_PIPELINE_CONTRACT_V1,
    project_ref: opaqueRef(value.project_ref, 'capsule.project_ref'),
    surface: enumValue(value.surface, SURFACES, 'capsule.surface'),
    unsaved_draft: boolean(value.unsaved_draft, 'capsule.unsaved_draft'),
    pending_review: boolean(value.pending_review, 'capsule.pending_review'),
    ...(run !== undefined ? { run } : {}),
    menu: {
      project: summary(menuInput.project, 'capsule.menu.project'),
      surface: enumValue(menuInput.surface, SURFACES, 'capsule.menu.surface'),
      work_context: summary(menuInput.work_context, 'capsule.menu.work_context'),
      run_state: enumValue(menuInput.run_state, RUN_STATES, 'capsule.menu.run_state'),
      next_action: summary(menuInput.next_action, 'capsule.menu.next_action'),
    },
  }
}

function fail(code: CreativePipelineDecodeErrorCodeV1, message: string): never {
  throw new PipelineDecodeFailure(code, message)
}

function decode<T>(fn: () => T): CreativePipelineDecodeResultV1<T> {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    if (error instanceof PipelineDecodeFailure) return { ok: false, code: error.code, reason: error.message }
    return { ok: false, code: 'pipeline.invalid_shape', reason: 'pipeline decoding failed' }
  }
}

export function decodeCreativePipelineNodeProjectionV1(input: unknown): CreativePipelineDecodeResultV1<CreativePipelineNodeProjectionV1> {
  return decode(() => decodeNode(input))
}

export function decodeCreativePipelineEdgeProjectionV1(input: unknown): CreativePipelineDecodeResultV1<CreativePipelineEdgeProjectionV1> {
  return decode(() => decodeEdge(input))
}

export function decodeCreativePipelineRunStateV1(input: unknown): CreativePipelineDecodeResultV1<CreativePipelineRunStateV1> {
  return decode(() => decodeRunState(input))
}

export function decodeCreativePipelineRunProjectionV1(input: unknown): CreativePipelineDecodeResultV1<CreativePipelineRunProjectionV1> {
  return decode(() => decodeRunProjection(input))
}

export function decodeWorkSurfaceCapsuleV1(input: unknown): CreativePipelineDecodeResultV1<WorkSurfaceCapsuleV1> {
  return decode(() => decodeCapsule(input))
}

/** 输出原因/影响/提示等文本前移除凭据形态、私有路径与多行内容。 */
export function redactCreativePipelineText(input: string): string {
  return redactDshPluginSurfaceText(input)
}
