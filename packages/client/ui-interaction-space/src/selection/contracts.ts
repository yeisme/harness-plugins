/**
 * Selection interaction V2 contracts。
 *
 * 统一选区上下文、typed 动作 descriptor、intent 与 capability 协商。所有字段
 * 有界、可本地化、fail-closed：descriptor 不允许 DOM/React callback、HTML、
 * URL、patch、provider payload 或 credential 形态的值进入 registry。
 *
 * @module @yeisme/dsh-client-ui-interaction-space/selection
 */

/** V2 宿主 capability 名（probe 用；旧宿主无此 capability 时走 V1 adapter）。 */
export const SELECTION_INTERACTION_CAPABILITY_V2 = 'selection.interaction.v2'

export const SELECTION_CONTEXT_KINDS_V2 = ['text', 'source', 'image-region', 'table-range', 'editable-control'] as const
export type SelectionContextKindV2 = (typeof SELECTION_CONTEXT_KINDS_V2)[number]

export const SELECTION_CONTEXT_SOURCES_V2 = ['conversation', 'file', 'markdown', 'image', 'table', 'editor'] as const
export type SelectionContextSourceV2 = (typeof SELECTION_CONTEXT_SOURCES_V2)[number]

/** 上下文稳定阈值：normalizer 的 debounce 下限（ms）。 */
export const SELECTION_STABLE_DEBOUNCE_MS = 120

/** 标签与 id 的有界上限。 */
export const SELECTION_LABEL_MAX_CHARS = 48
export const SELECTION_SHORT_LABEL_MAX_CHARS = 16
export const SELECTION_ID_MAX_CHARS = 96
export const SELECTION_CAPABILITIES_MAX = 32

/** 有界本地化标签：default 必填，zh/zh-CN 可选覆盖。 */
export interface LocalizedLabelV2 {
  readonly default: string
  readonly zh?: string
  readonly 'zh-CN'?: string
}

/**
 * V2 选区上下文。`contextId` 只在当前页面生命周期内有效；持久化一律走 V1
 * anchor/annotation owner。`stableForMs` 由 normalizer 计算，调用方不可伪造
 * 为稳定（小于稳定阈值即视为未稳定）。
 */
export interface SelectionContextV2 {
  readonly contextId: string
  readonly kind: SelectionContextKindV2
  readonly anchor?: Readonly<{ readonly anchorId?: string; readonly quotePreview?: string }>
  readonly source: SelectionContextSourceV2
  readonly stableForMs: number
  readonly capabilities: readonly string[]
  readonly hostOptOut?: boolean
  readonly sensitive: boolean
}

export const SELECTION_DANGER_LEVELS = ['safe', 'preview-first', 'confirm'] as const
export type SelectionDangerLevel = (typeof SELECTION_DANGER_LEVELS)[number]

export const SELECTION_ACTION_OWNERS = ['client', 'dsh', 'host'] as const
export type SelectionActionOwner = (typeof SELECTION_ACTION_OWNERS)[number]

export const SELECTION_PRESENTATIONS = ['local', 'composer', 'popover', 'pane'] as const
export type SelectionActionPresentation = (typeof SELECTION_PRESENTATIONS)[number]

export const SELECTION_DEFAULT_SLOTS = ['primary', 'secondary', 'more'] as const
export type SelectionDefaultSlot = (typeof SELECTION_DEFAULT_SLOTS)[number]

export const SELECTION_VISIBILITIES = ['default', 'optional'] as const
export type SelectionVisibility = (typeof SELECTION_VISIBILITIES)[number]

/** 有界快捷键描述：`Alt+Enter` 形态，最多三段修饰键 + 一个主键。 */
export interface ShortcutDescriptorV2 {
  readonly key: string
}

/** namespaced 动作 descriptor。只描述，不执行：handler 由 owner adapter 接收。 */
export interface SelectionActionDescriptorV2 {
  readonly id: string
  readonly aliases?: readonly string[]
  readonly label: LocalizedLabelV2
  readonly shortLabel?: LocalizedLabelV2
  readonly contexts: readonly SelectionContextKindV2[]
  readonly requires?: readonly string[]
  readonly priority: number
  readonly defaultSlot: SelectionDefaultSlot
  readonly visibility: SelectionVisibility
  readonly danger: SelectionDangerLevel
  readonly owner: SelectionActionOwner
  readonly presentation: SelectionActionPresentation
  readonly shortcut?: ShortcutDescriptorV2
  readonly disabledReason?: LocalizedLabelV2
}

/** 动作激活时发出的 typed intent（contextId + canonical id + owner）。 */
export interface SelectionActionIntentV2 {
  readonly contextId: string
  readonly actionId: string
  /** 经 V1 alias 激活时记录来源；执行与 receipt 仍使用 canonical actionId。 */
  readonly aliasOf?: string
  readonly owner: SelectionActionOwner
  readonly approvalPolicy: 'local' | 'preview-first' | 'auto-apply'
  readonly anchor?: Readonly<{ readonly anchorId?: string }>
}

export type SelectionDescriptorRejection =
  | 'invalid_shape'
  | 'id_not_namespaced'
  | 'unknown_context'
  | 'label_too_long'
  | 'credential_shaped_field'
  | 'duplicate_id_or_alias'
  | 'duplicate_registration'

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

const NAMESPACED_ID = /^[a-z][a-z0-9-]{0,31}:[a-z][a-z0-9-]{0,47}$/
const ALIAS_ID = /^[a-z][a-z0-9-]{0,63}$/
const SHORTCUT = /^(?:Alt|Ctrl|Meta|Shift)(?:\+(?:Alt|Ctrl|Meta|Shift)){0,2}\+[A-Za-z][A-Za-z0-9]{0,11}$/
const CREDENTIAL_SHAPED = /(?:api[_-]?key|token|secret|password|credential|https?:\/\/)/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function boundedLabel(value: unknown, maxChars: number): value is LocalizedLabelV2 {
  if (!isRecord(value)) return false
  const def = value.default
  if (typeof def !== 'string' || def.length === 0 || def.length > maxChars) return false
  for (const locale of ['zh', 'zh-CN'] as const) {
    const entry = value[locale]
    if (entry !== undefined && (typeof entry !== 'string' || entry.length === 0 || entry.length > maxChars)) return false
  }
  return Object.keys(value).every(key => key === 'default' || key === 'zh' || key === 'zh-CN')
}

function stringArray(value: unknown, max: number, pattern?: RegExp): string[] | undefined {
  if (!Array.isArray(value) || value.length > max) return undefined
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > SELECTION_ID_MAX_CHARS) return undefined
    if (pattern !== undefined && !pattern.test(item)) return undefined
    out.push(item)
  }
  return out
}

function labelText(label: LocalizedLabelV2): string {
  return label.default
}

function labelRejection(label: unknown, maxChars: number): SelectionDescriptorRejection | undefined {
  if (boundedLabel(label, maxChars)) {
    if (CREDENTIAL_SHAPED.test(labelText(label as LocalizedLabelV2))) return 'credential_shaped_field'
    return undefined
  }
  return 'label_too_long'
}

export type DescriptorValidationResult =
  | { readonly ok: true; readonly descriptor: SelectionActionDescriptorV2 }
  | { readonly ok: false; readonly rejection: SelectionDescriptorRejection; readonly detail?: string }

/**
 * Fail-closed descriptor 校验：任何未知字段、越界 label、未命名空间 id、
 * credential/URL 形态或非法 capability 名直接拒绝，不影响已注册动作。
 */
export function validateSelectionActionDescriptor(input: unknown): DescriptorValidationResult {
  if (!isRecord(input)) return { ok: false, rejection: 'invalid_shape', detail: 'descriptor must be an object' }
  // 严格形状：未知字段（callback/HTML/URL 注入面）一律拒绝，不做静默忽略。
  const knownKeys = new Set(['id', 'aliases', 'label', 'shortLabel', 'contexts', 'requires', 'priority', 'defaultSlot', 'visibility', 'danger', 'owner', 'presentation', 'shortcut', 'disabledReason'])
  for (const key of Object.keys(input)) {
    if (!knownKeys.has(key)) return { ok: false, rejection: 'invalid_shape', detail: `unknown field ${key}` }
  }
  const { id, aliases, label, shortLabel, contexts, requires, priority, defaultSlot, visibility, danger, owner, presentation, shortcut, disabledReason } = input
  if (typeof id !== 'string' || !NAMESPACED_ID.test(id)) {
    return { ok: false, rejection: 'id_not_namespaced', detail: 'id must be `<namespace>:<action>` lowercase' }
  }
  if (CREDENTIAL_SHAPED.test(id)) return { ok: false, rejection: 'credential_shaped_field', detail: 'id must not look like a credential or URL' }
  const aliasList = aliases === undefined ? [] : stringArray(aliases, 8, ALIAS_ID)
  if (aliases !== undefined && aliasList === undefined) {
    return { ok: false, rejection: 'invalid_shape', detail: 'aliases must be bounded lowercase ids' }
  }
  for (const alias of aliasList ?? []) {
    if (CREDENTIAL_SHAPED.test(alias)) return { ok: false, rejection: 'credential_shaped_field', detail: 'alias must not look like a credential or URL' }
  }
  const labelRejection2 = labelRejection(label, SELECTION_LABEL_MAX_CHARS)
  if (labelRejection2 !== undefined) return { ok: false, rejection: labelRejection2, detail: 'label' }
  if (shortLabel !== undefined) {
    const shortRejection = labelRejection(shortLabel, SELECTION_SHORT_LABEL_MAX_CHARS)
    if (shortRejection !== undefined) return { ok: false, rejection: shortRejection, detail: 'shortLabel' }
  }
  if (disabledReason !== undefined) {
    const reasonRejection = labelRejection(disabledReason, SELECTION_LABEL_MAX_CHARS)
    if (reasonRejection !== undefined) return { ok: false, rejection: reasonRejection, detail: 'disabledReason' }
  }
  const contextList = stringArray(contexts, SELECTION_CONTEXT_KINDS_V2.length)
  if (contextList === undefined || contextList.length === 0) {
    return { ok: false, rejection: 'invalid_shape', detail: 'contexts must be a non-empty bounded array' }
  }
  for (const context of contextList) {
    if (!(SELECTION_CONTEXT_KINDS_V2 as readonly string[]).includes(context)) {
      return { ok: false, rejection: 'unknown_context', detail: `unknown context ${context}` }
    }
  }
  const requireList = requires === undefined ? [] : stringArray(requires, SELECTION_CAPABILITIES_MAX)
  if (requires !== undefined && requireList === undefined) {
    return { ok: false, rejection: 'invalid_shape', detail: 'requires must be bounded capability names' }
  }
  for (const capability of requireList ?? []) {
    if (CREDENTIAL_SHAPED.test(capability)) {
      return { ok: false, rejection: 'credential_shaped_field', detail: 'capability name must not look like a credential or URL' }
    }
  }
  if (typeof priority !== 'number' || !Number.isInteger(priority) || priority < 0 || priority > 100) {
    return { ok: false, rejection: 'invalid_shape', detail: 'priority must be an integer in [0,100]' }
  }
  if (!(SELECTION_DEFAULT_SLOTS as readonly string[]).includes(defaultSlot as string)) {
    return { ok: false, rejection: 'invalid_shape', detail: 'unknown defaultSlot' }
  }
  if (!(SELECTION_VISIBILITIES as readonly string[]).includes(visibility as string)) {
    return { ok: false, rejection: 'invalid_shape', detail: 'unknown visibility' }
  }
  if (!(SELECTION_DANGER_LEVELS as readonly string[]).includes(danger as string)) {
    return { ok: false, rejection: 'invalid_shape', detail: 'unknown danger' }
  }
  if (!(SELECTION_ACTION_OWNERS as readonly string[]).includes(owner as string)) {
    return { ok: false, rejection: 'invalid_shape', detail: 'unknown owner' }
  }
  if (!(SELECTION_PRESENTATIONS as readonly string[]).includes(presentation as string)) {
    return { ok: false, rejection: 'invalid_shape', detail: 'unknown presentation' }
  }
  if (shortcut !== undefined) {
    if (!isRecord(shortcut) || typeof shortcut.key !== 'string' || !SHORTCUT.test(shortcut.key)) {
      return { ok: false, rejection: 'invalid_shape', detail: 'shortcut must look like `Alt+Enter`' }
    }
  }
  const descriptor: SelectionActionDescriptorV2 = {
    id,
    ...(aliasList === undefined || aliasList.length === 0 ? {} : { aliases: aliasList }),
    label: label as LocalizedLabelV2,
    ...(shortLabel === undefined ? {} : { shortLabel: shortLabel as LocalizedLabelV2 }),
    contexts: contextList as unknown as SelectionContextKindV2[],
    ...(requireList === undefined || requireList.length === 0 ? {} : { requires: requireList }),
    priority,
    defaultSlot: defaultSlot as SelectionDefaultSlot,
    visibility: visibility as SelectionVisibility,
    danger: danger as SelectionDangerLevel,
    owner: owner as SelectionActionOwner,
    presentation: presentation as SelectionActionPresentation,
    ...(shortcut === undefined ? {} : { shortcut: shortcut as unknown as ShortcutDescriptorV2 }),
    ...(disabledReason === undefined ? {} : { disabledReason: disabledReason as LocalizedLabelV2 }),
  }
  return { ok: true, descriptor }
}

// ---------------------------------------------------------------------------
// V1 alias 映射（兼容窗口：receipt 记 canonical id + alias 来源）
// ---------------------------------------------------------------------------

/** V1 toolbar action id → V2 canonical id。`agent-edit` 与 `edit` 同归编辑。 */
export const V1_ACTION_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ask: 'dsh:ask',
  comment: 'dsh:comment',
  edit: 'dsh:edit',
  'agent-edit': 'dsh:edit',
  'copy-quote': 'dsh:copy-quote',
  'add-to-batch': 'dsh:add-to-batch',
  'open-full': 'dsh:open-full',
})

/** 把 V1 action id 解析为 canonical id；未知 id 原样返回（fail-closed 由调用方处理）。 */
export function resolveV1ActionAlias(actionId: string): string {
  return V1_ACTION_ALIASES[actionId] ?? actionId
}

// ---------------------------------------------------------------------------
// 上下文校验（normalizer 输出侧同样 fail-closed）
// ---------------------------------------------------------------------------

export type ContextValidation =
  | { readonly ok: true; readonly context: SelectionContextV2 }
  | { readonly ok: false; readonly reason: 'invalid_shape' | 'unstable' | 'opt_out' | 'sensitive' | 'invalid_capabilities' }

/** 校验 normalizer 产出的上下文：不稳定、opt-out、敏感或越界 capabilities 拒绝。 */
export function validateSelectionContextV2(input: unknown): ContextValidation {
  if (!isRecord(input)) return { ok: false, reason: 'invalid_shape' }
  const { contextId, kind, source, stableForMs, capabilities, hostOptOut, sensitive, anchor } = input
  if (typeof contextId !== 'string' || contextId.length === 0 || contextId.length > 128) return { ok: false, reason: 'invalid_shape' }
  if (typeof kind !== 'string' || !(SELECTION_CONTEXT_KINDS_V2 as readonly string[]).includes(kind)) return { ok: false, reason: 'invalid_shape' }
  if (typeof source !== 'string' || !(SELECTION_CONTEXT_SOURCES_V2 as readonly string[]).includes(source)) return { ok: false, reason: 'invalid_shape' }
  if (typeof stableForMs !== 'number' || !Number.isFinite(stableForMs)) return { ok: false, reason: 'invalid_shape' }
  if (stableForMs < SELECTION_STABLE_DEBOUNCE_MS) return { ok: false, reason: 'unstable' }
  if (hostOptOut === true) return { ok: false, reason: 'opt_out' }
  if (sensitive === true) return { ok: false, reason: 'sensitive' }
  const capabilityList = stringArray(capabilities, SELECTION_CAPABILITIES_MAX)
  if (capabilityList === undefined) return { ok: false, reason: 'invalid_capabilities' }
  if (anchor !== undefined) {
    if (!isRecord(anchor)) return { ok: false, reason: 'invalid_shape' }
    if (anchor.anchorId !== undefined && typeof anchor.anchorId !== 'string') return { ok: false, reason: 'invalid_shape' }
    if (anchor.quotePreview !== undefined && (typeof anchor.quotePreview !== 'string' || anchor.quotePreview.length > 512)) {
      return { ok: false, reason: 'invalid_shape' }
    }
  }
  return {
    ok: true,
    context: {
      contextId,
      kind: kind as SelectionContextKindV2,
      source: source as SelectionContextSourceV2,
      stableForMs,
      capabilities: capabilityList,
      sensitive: false,
      ...(anchor === undefined ? {} : { anchor: anchor as NonNullable<SelectionContextV2['anchor']> }),
    },
  }
}
