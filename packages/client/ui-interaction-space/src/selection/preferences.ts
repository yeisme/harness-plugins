/**
 * Selection interaction 偏好：built-in / user / workspace 三层合并。
 *
 * `workspace > user > built-in`；只保存 canonical action id 与有界 UI 值
 * （visibility/order/shortcut/density/preset），不保存 anchor 内容、路径、
 * URL、会话状态或 owner payload。无效偏好 fail-closed 回退 built-in 并给
 * 出可读诊断。
 *
 * @module @yeisme/dsh-client-ui-interaction-space/selection
 */

import type { SelectionContextKindV2 } from './contracts.ts'

export type SelectionDensity = 'compact' | 'comfortable'
export type SelectionPreset = 'default' | 'review' | 'edit' | 'custom'

export interface SelectionActionPreference {
  /** canonical id；未注册/未知的 id 在合并时丢弃并记诊断。 */
  readonly id: string
  readonly visible?: boolean
}

export interface SelectionContextPreference {
  readonly actions?: readonly SelectionActionPreference[]
  /** canonical id 顺序（只重排，不突破 capability/danger 边界）。 */
  readonly order?: readonly string[]
  readonly shortcut?: string
  readonly density?: SelectionDensity
  readonly preset?: SelectionPreset
}

export interface SelectionInteractionPreferenceInput {
  readonly user?: Readonly<Partial<Record<SelectionContextKindV2, SelectionContextPreference>>>
  readonly workspace?: Readonly<Partial<Record<SelectionContextKindV2, SelectionContextPreference>>>
}

export interface MergedContextPreference {
  readonly order: readonly string[]
  readonly hiddenActionIds: ReadonlySet<string>
  readonly shortcut: string
  readonly density: SelectionDensity
  readonly preset: SelectionPreset
}

export interface PreferenceMergeDiagnostics {
  /** 丢弃的无效项：unknown-id / 越界值 / 冲突快捷键等，全部脱敏（无路径/URL）。 */
  readonly dropped: readonly string[]
}

export interface PreferenceMergeResult {
  readonly byContext: Readonly<Record<SelectionContextKindV2, MergedContextPreference>>
  readonly diagnostics: PreferenceMergeDiagnostics
}

export const DEFAULT_SELECTION_SHORTCUT = 'Alt+Enter'
export const DEFAULT_SELECTION_DENSITY: SelectionDensity = 'comfortable'
export const DEFAULT_SELECTION_PRESET: SelectionPreset = 'default'

const SHORTCUT_PATTERN = /^(?:Alt|Ctrl|Meta|Shift)(?:\+(?:Alt|Ctrl|Meta|Shift)){0,2}\+[A-Za-z][A-Za-z0-9]{0,11}$/
const ORDER_MAX = 24

function isContextKind(value: string): value is SelectionContextKindV2 {
  return value === 'text' || value === 'source' || value === 'image-region' || value === 'table-range' || value === 'editable-control'
}

function sanitizeOrder(order: readonly string[] | undefined, knownIds: ReadonlySet<string>, dropped: string[]): readonly string[] | undefined {
  if (order === undefined) return undefined
  if (!Array.isArray(order) || order.length > ORDER_MAX) {
    dropped.push('order:invalid-shape')
    return undefined
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of order) {
    if (typeof id !== 'string' || !knownIds.has(id)) {
      dropped.push(`order:unknown-id:${typeof id === 'string' && id.length <= 48 ? id : 'invalid'}`)
      continue
    }
    if (seen.has(id)) {
      dropped.push(`order:duplicate-id:${id}`)
      continue
    }
    seen.add(id)
    out.push(id)
  }
  // 全部项非法：fail-closed 整条丢弃，回退 built-in（不产出一个空顺序）。
  return out.length === 0 ? undefined : out
}

function sanitizeShortcut(shortcut: string | undefined, dropped: string[]): string | undefined {
  if (shortcut === undefined) return undefined
  if (typeof shortcut !== 'string' || !SHORTCUT_PATTERN.test(shortcut)) {
    dropped.push('shortcut:invalid')
    return undefined
  }
  return shortcut
}

/**
 * 三层合并。knownActionIds 为当前 registry 全量 canonical id；未知 id 的
 * visibility/order 项被丢弃（诊断记录），快捷键 workspace 层冲突时回退
 * user 层再回退 built-in（宿主/编辑器保留键由层侧 isShortcutReserved 兜底）。
 */
export function mergeSelectionPreferences(
  input: SelectionInteractionPreferenceInput,
  knownActionIds: ReadonlySet<string>,
  builtinOrders: Readonly<Record<SelectionContextKindV2, readonly string[]>>,
): PreferenceMergeResult {
  const dropped: string[] = []
  const byContext = {} as Record<SelectionContextKindV2, MergedContextPreference>
  const kinds: SelectionContextKindV2[] = ['text', 'source', 'image-region', 'table-range', 'editable-control']
  for (const kind of kinds) {
    const user = input.user?.[kind]
    const workspace = input.workspace?.[kind]
    // 无效 context 键直接丢弃（不猜测映射）。
    for (const [scope, layer] of [['user', input.user], ['workspace', input.workspace]] as const) {
      if (layer === undefined) continue
      for (const key of Object.keys(layer)) {
        if (!isContextKind(key)) dropped.push(`${scope}:unknown-context:${key.slice(0, 32)}`)
      }
    }
    const order = sanitizeOrder(workspace?.order ?? user?.order, knownActionIds, dropped)
      ?? builtinOrders[kind]
    const shortcut = sanitizeShortcut(workspace?.shortcut ?? user?.shortcut, dropped)
      ?? DEFAULT_SELECTION_SHORTCUT
    const density = workspace?.density === 'compact' || (workspace?.density === undefined && user?.density === 'compact')
      ? 'compact'
      : DEFAULT_SELECTION_DENSITY
    const preset = sanitizePreset(workspace?.preset ?? user?.preset, dropped)
    // 低优先层先应用，高优先层后应用（visible=true 覆盖 user hidden）。
    const hidden = new Set<string>()
    applyVisibility(user, knownActionIds, dropped, hidden)
    applyVisibility(workspace, knownActionIds, dropped, hidden)
    byContext[kind] = { order, hiddenActionIds: hidden, shortcut, density, preset }
  }
  return { byContext, diagnostics: { dropped: [...new Set(dropped)] } }
}

function sanitizePreset(preset: string | undefined, dropped: string[]): SelectionPreset {
  if (preset === undefined) return DEFAULT_SELECTION_PRESET
  if (preset === 'default' || preset === 'review' || preset === 'edit' || preset === 'custom') return preset
  dropped.push('preset:invalid')
  return DEFAULT_SELECTION_PRESET
}

/** 应用一层的动作可见性：visible=false 隐藏，visible=true 恢复（高优先层覆盖）。 */
function applyVisibility(
  layer: SelectionContextPreference | undefined,
  knownIds: ReadonlySet<string>,
  dropped: string[],
  hidden: Set<string>,
): void {
  for (const action of layer?.actions ?? []) {
    if (action === null || typeof action !== 'object' || typeof action.id !== 'string' || !knownIds.has(action.id)) {
      dropped.push('visibility:unknown-id')
      continue
    }
    if (action.visible === false) hidden.add(action.id)
    else if (action.visible === true) hidden.delete(action.id)
  }
}
