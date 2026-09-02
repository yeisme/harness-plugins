/**
 * `SelectionActionRegistryV2`：typed descriptor 注册、alias 解析与确定性动作
 * 投影。扩展只注册安全描述——id/label/contexts/requires/priority/slot/danger/
 * owner/presentation——不注册渲染回调或执行函数。非法 descriptor fail-closed
 * 拒绝且不影响其他已注册动作。
 *
 * @module @yeisme/dsh-client-ui-interaction-space/selection
 */

import type { SelectionActionDescriptorV2 } from './contracts.ts'
import {
  resolveV1ActionAlias,
  validateSelectionActionDescriptor,
  type LocalizedLabelV2,
  type SelectionContextV2,
  type SelectionDescriptorRejection,
} from './contracts.ts'

export interface RegistrationResult {
  readonly ok: boolean
  readonly handle?: { dispose(): void }
  readonly rejection?: SelectionDescriptorRejection | 'duplicate_id_or_alias' | 'duplicate_registration'
  readonly detail?: string
}

export interface ResolvedActionView {
  readonly descriptor: SelectionActionDescriptorV2
  readonly slot: 'primary' | 'secondary' | 'more'
  readonly disabled: boolean
  readonly disabledReason?: LocalizedLabelV2
}

export interface ResolvedActions {
  readonly primary: ResolvedActionView | undefined
  readonly secondary: readonly ResolvedActionView[]
  /** 更多动作：可用与 disabled-with-reason 并存，按确定性顺序。 */
  readonly more: readonly ResolvedActionView[]
}

export interface ResolveOptions {
  /** 用户/工作区偏好中显式隐藏的 canonical action id（visibility=optional 之外的手动隐藏）。 */
  readonly hiddenActionIds?: ReadonlySet<string>
  /** 用户自定义顺序（canonical id 列表）；只重排可用动作，不突破 context/capability/danger 边界。 */
  readonly customOrder?: readonly string[]
}

export interface RegistryEntry {
  readonly descriptor: SelectionActionDescriptorV2
  readonly installOrder: number
}

const GENERIC_UNAVAILABLE: LocalizedLabelV2 = { default: 'capability unavailable' }

/**
 * Registry。实例由 singleton 交互层持有；重复注册同一 id（未先 dispose）
 * 拒绝为 duplicate_registration。
 */
export class SelectionActionRegistryV2 {
  private readonly entries = new Map<string, RegistryEntry>()
  private readonly aliasIndex = new Map<string, string>()
  private readonly listeners = new Set<() => void>()
  private nextInstallOrder = 0
  private disposed = false

  register(input: unknown): RegistrationResult {
    if (this.disposed) return { ok: false, rejection: 'invalid_shape', detail: 'registry disposed' }
    const validated = validateSelectionActionDescriptor(input)
    if (!validated.ok) {
      return validated.detail === undefined
        ? { ok: false, rejection: validated.rejection }
        : { ok: false, rejection: validated.rejection, detail: validated.detail }
    }
    const descriptor: SelectionActionDescriptorV2 = validated.descriptor
    if (this.entries.has(descriptor.id)) {
      return { ok: false, rejection: 'duplicate_registration', detail: `id ${descriptor.id} already registered` }
    }
    for (const alias of descriptor.aliases ?? []) {
      if (this.entries.has(alias) || this.aliasIndex.has(alias)) {
        return { ok: false, rejection: 'duplicate_id_or_alias', detail: `alias ${alias} collides` }
      }
    }
    const entry: RegistryEntry = { descriptor, installOrder: this.nextInstallOrder++ }
    this.entries.set(descriptor.id, entry)
    for (const alias of descriptor.aliases ?? []) this.aliasIndex.set(alias, descriptor.id)
    this.emit()
    let active = true
    return {
      ok: true,
      handle: {
        dispose: () => {
          if (!active || this.disposed) return
          active = false
          this.entries.delete(descriptor.id)
          for (const alias of descriptor.aliases ?? []) this.aliasIndex.delete(alias)
          this.emit()
        },
      },
    }
  }

  /** V1/alias → canonical id；未知 id 原样返回（调用方 fail-closed 处理）。 */
  resolveCanonical(actionId: string): string {
    return this.aliasIndex.get(actionId) ?? resolveV1ActionAlias(actionId)
  }

  lookup(actionId: string): SelectionActionDescriptorV2 | undefined {
    return this.entries.get(this.resolveCanonical(actionId))?.descriptor
  }

  list(): readonly SelectionActionDescriptorV2[] {
    return [...this.entries.values()].map(entry => entry.descriptor)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  dispose(): void {
    this.disposed = true
    this.entries.clear()
    this.aliasIndex.clear()
    this.listeners.clear()
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener()
  }

  /**
   * 确定性解析（design §Deterministic resolution）：
   * 1) context 过滤；2) optional+隐藏过滤；3) 缺 capability 只进 More disabled；
   * 4) priority DESC → install order → id ASC；5) primary 1 + secondary ≤2 + More；
   * 6) 同一动作不重复出现；danger=confirm 永不占 primary/secondary。
   * 自定义顺序只重排可用动作，不能把隐藏/不可用动作拉回主槽位。
   */
  resolve(context: Pick<SelectionContextV2, 'kind' | 'capabilities'>, options: ResolveOptions = {}): ResolvedActions {
    const hidden = options.hiddenActionIds ?? new Set<string>()
    const applicable: ResolvedActionView[] = []
    for (const entry of this.entries.values()) {
      const { descriptor } = entry
      if (!descriptor.contexts.includes(context.kind)) continue
      if (descriptor.visibility === 'optional' && hidden.has(descriptor.id)) continue
      if (hidden.has(descriptor.id) && descriptor.visibility !== 'optional') continue
      const missing = (descriptor.requires ?? []).filter(capability => !context.capabilities.includes(capability))
      if (missing.length > 0) {
        applicable.push({
          descriptor,
          slot: 'more',
          disabled: true,
          disabledReason: descriptor.disabledReason ?? GENERIC_UNAVAILABLE,
        })
        continue
      }
      applicable.push({ descriptor, slot: 'more', disabled: false })
    }

    const orderKey = (view: ResolvedActionView): string => {
      const index = options.customOrder?.indexOf(view.descriptor.id) ?? -1
      return index >= 0 ? `0:${String(index).padStart(4, '0')}` : `1:${String(100 - view.descriptor.priority).padStart(4, '0')}`
    }
    // 稳定排序：自定义顺序优先段；其余 priority DESC → install order → id ASC。
    const installOrderById = new Map([...this.entries.values()].map(entry => [entry.descriptor.id, entry.installOrder] as const))
    const sorted = [...applicable].sort((a, b) => {
      const ka = orderKey(a)
      const kb = orderKey(b)
      if (ka !== kb) return ka < kb ? -1 : 1
      const ia = installOrderById.get(a.descriptor.id) ?? 0
      const ib = installOrderById.get(b.descriptor.id) ?? 0
      return ia !== ib ? ia - ib : a.descriptor.id < b.descriptor.id ? -1 : 1
    })

    const primary: ResolvedActionView[] = []
    const secondary: ResolvedActionView[] = []
    const more: ResolvedActionView[] = []
    for (const view of sorted) {
      if (view.disabled) {
        more.push(view)
        continue
      }
      // danger=confirm 始终留在 More：自定义顺序不得把确认级动作推进主槽位。
      if (view.descriptor.danger === 'confirm') {
        more.push(view)
        continue
      }
      if (primary.length === 0) {
        primary.push({ ...view, slot: 'primary' })
        continue
      }
      if (secondary.length < 2) {
        secondary.push({ ...view, slot: 'secondary' })
        continue
      }
      more.push({ ...view, slot: 'more' })
    }
    return { primary: primary[0], secondary, more }
  }
}
