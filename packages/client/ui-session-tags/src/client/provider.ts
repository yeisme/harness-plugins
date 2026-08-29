/**
 * `yeisme.session-tags` 分组 provider：把 controller 的权威投影折叠为
 * SessionGroupingProviderV1Alpha1 快照（多对多分组 + 安全搜索词）。
 *
 * 投影不变量（spec dsh-session-tags；测试钉住）：
 * 1. 一个标签一个组；同一会话的多标签使其出现在每个对应组（组内按
 *    SessionId 去重，同一会话在一个组内只出现一次）。
 * 2. 无标签的会话进入本地化“未标记”组，且该组排在全部标签组之后；
 *    空组（含空“未标记”组）不产出。
 * 3. 标签组顺序 = 当前 locale 的稳定文本排序（Intl.Collator，
 *    numeric + variant sensitivity，大小写按 locale 规则）。
 * 4. `searchTermsBySession` 只含规范化标签文本——不暴露绝对路径、
 *    存储身份、版本号或任何 Host 内部字段。
 * 5. 快照在下一次通知前引用稳定；revision 单调，材料不变则不换快照。
 * 6. tag mutation 不提升 recency：provider 不产任何时间序/排序提示，
 *    分组成员顺序只由 SessionId 输入序与排序规则决定，与写入时间无关。
 * 7. 未过滤成员交给 Browser：未知/归档/subagent-only 会话由 DSH 过滤，
 *    provider 不自查可见性（不复制 Browser 状态，也不建第二份 store）。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/provider
 */

import type { SessionTagsController } from './controller.ts'

/** 上游 `SessionGroupingProviderV1Alpha1` 的结构镜像（seam 未发布前的本地合同）。 */
export interface SessionGroupingGroupV1Alpha1 {
  readonly id: string
  readonly label: string
  readonly sessionIds: readonly string[]
  /** Additive hierarchy hint; old Browsers ignore it. */
  readonly parentId?: string | undefined
  /** Semantic token name, never a raw color value. */
  readonly color?: string | undefined
}

export interface SessionGroupingSnapshotV1Alpha1 {
  readonly revision: string | number
  readonly groups: readonly SessionGroupingGroupV1Alpha1[]
  readonly searchTermsBySession?: Readonly<Record<string, readonly string[]>>
}

export interface SessionGroupingActionV1Alpha1 {
  readonly id: string
  readonly label: string | (() => string)
  open(sessionId: string): void
}

export interface SessionGroupingProviderV1Alpha1 {
  readonly id: string
  readonly label: string | (() => string)
  readonly order?: number
  getSnapshot(): SessionGroupingSnapshotV1Alpha1
  subscribe(listener: () => void): () => void
  readonly sessionActions?: readonly SessionGroupingActionV1Alpha1[]
}

/** provider id（固定；Browser 以 `provider:<id>:<group>` 命名空间化 manual order）。 */
export const SESSION_TAGS_PROVIDER_ID = 'yeisme.session-tags'

/** “管理标签”动作 id。 */
export const MANAGE_TAGS_ACTION_ID = 'yeisme.session-tags.manage'

/** “未标记”组的 provider 内 id（Browser 自行加 provider 命名空间）。 */
export const UNTAGGED_GROUP_ID = 'untagged'

/** 空快照（seam 仍要求稳定引用）。 */
const EMPTY_SNAPSHOT: SessionGroupingSnapshotV1Alpha1 = Object.freeze({
  revision: 0,
  groups: Object.freeze([]),
})

/** provider 工厂依赖。 */
export interface SessionTagsProviderDeps {
  readonly controller: SessionTagsController
  /** 当前全部已知 SessionId（快照式读取；可见性过滤归 Browser）。 */
  readonly allSessionIds: () => readonly string[]
  /**
   * 会话集合外部变化通知（可选）：sessions.list 是独立 store，其变化不经
   * controller 事件；提供者据此触发重投影，避免晚到的会话列表把视图钉死在
   * 空快照。返回退订函数。
   */
  readonly onSessionsChanged?: (listener: () => void) => () => void
  /** BCP-47 locale（缺省用运行时默认）。 */
  readonly locale?: string
  /** 标签文案。 */
  readonly labels?: SessionTagsProviderLabels
  /** “管理标签”动作回调（打开编辑器）。 */
  readonly onManageTags: (sessionId: string) => void
}

/** provider 文案（本地化注入；缺省英文）。 */
export interface SessionTagsProviderLabels {
  /** 视图菜单项（“按标签”）。 */
  readonly menuLabel?: string
  /** “未标记”组标签。 */
  readonly untaggedLabel?: string
  /** “管理标签”动作标签。 */
  readonly manageActionLabel?: string
}

interface Projection {
  readonly snapshot: SessionGroupingSnapshotV1Alpha1
}

/**
 * 组装 tags 分组 provider。订阅 controller；controller 进入非 ready 态
 * （loading/error）时产出空快照——宁可无分组，不可伪造标签。
 */
export function createSessionTagsProvider(deps: SessionTagsProviderDeps): SessionGroupingProviderV1Alpha1 {
  const collator = new Intl.Collator(deps.locale ?? undefined, {
    numeric: true,
    sensitivity: 'variant',
  })
  const labels = {
    menuLabel: deps.labels?.menuLabel ?? 'By tags',
    untaggedLabel: deps.labels?.untaggedLabel ?? 'Untagged',
    manageActionLabel: deps.labels?.manageActionLabel ?? 'Manage tags',
  }
  const listeners = new Set<() => void>()
  let projection: Projection = { snapshot: EMPTY_SNAPSHOT }

  const rebuild = (): void => {
    const state = deps.controller.getSnapshot()
    if (state.status !== 'ready') {
      if (projection.snapshot !== EMPTY_SNAPSHOT) {
        projection = { snapshot: EMPTY_SNAPSHOT }
        notify()
      }
      return
    }
    const next = projectSnapshot(state, deps.allSessionIds(), collator, labels, projection.snapshot)
    if (next !== projection.snapshot) {
      projection = { snapshot: next }
      notify()
    }
  }

  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }

  deps.controller.subscribe(rebuild)
  deps.onSessionsChanged?.(rebuild)
  rebuild()

  return {
    id: SESSION_TAGS_PROVIDER_ID,
    label: () => labels.menuLabel,
    order: 100,
    // 惰性重算：会话列表可能晚于注册到达（sessions.list 是独立 store，
    // 其变化不触发 controller subscribe）。getSnapshot 时重投影，相等时
    // 保持引用稳定（projectSnapshot 已做相等性短路），React 不会多余渲染。
    getSnapshot: () => {
      rebuild()
      return projection.snapshot
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    sessionActions: [
      {
        id: MANAGE_TAGS_ACTION_ID,
        label: () => labels.manageActionLabel,
        open(sessionId: string): void {
          deps.onManageTags(sessionId)
        },
      },
    ],
  }
}

/** 组 id 前缀：标签文本直接进 id 会与 untagged 冲突，统一加前缀。 */
const TAG_GROUP_PREFIX = 'tag:'

/**
 * 纯投影：ready 态 entries → 分组快照。
 * 材料（组集合 + 成员 + 搜索词）不变时原样返回上一快照——引用稳定与
 * revision 稳定同时成立（不变量 5）。
 */
function projectSnapshot(
  state: { readonly entries: readonly { readonly sessionId: string; readonly row: { readonly tags: readonly string[] } }[] },
  allSessionIds: readonly string[],
  collator: Intl.Collator,
  labels: { readonly untaggedLabel: string },
  previous: SessionGroupingSnapshotV1Alpha1,
): SessionGroupingSnapshotV1Alpha1 {
  const tagsBySession = new Map<string, readonly string[]>()
  const tagTexts = new Set<string>()
  for (const entry of state.entries) {
    if (entry.row.tags.length === 0) continue
    tagsBySession.set(entry.sessionId, entry.row.tags)
    for (const tag of entry.row.tags) tagTexts.add(tag)
  }

  // 组内成员：同组重复 SessionId 只保留一次；成员顺序 = allSessionIds 的
  // 输入序（Browser 侧再按 manual/updated 排），与标签写入时间无关。
  const membersByTag = new Map<string, string[]>()
  for (const sessionId of allSessionIds) {
    const tags = tagsBySession.get(sessionId)
    if (tags === undefined) continue
    for (const tag of tags) {
      let members = membersByTag.get(tag)
      if (members === undefined) {
        members = []
        membersByTag.set(tag, members)
      }
      if (!members.includes(sessionId)) members.push(sessionId)
    }
  }

  const groups: SessionGroupingGroupV1Alpha1[] = []
  const searchTermsBySession: Record<string, readonly string[]> = {}
  const sortedTags = [...membersByTag.keys()].sort((a, b) => collator.compare(a, b))
  for (const tag of sortedTags) {
    const members = membersByTag.get(tag)
    if (members === undefined || members.length === 0) continue
    groups.push(Object.freeze({
      id: `${TAG_GROUP_PREFIX}${tag}`,
      label: tag,
      sessionIds: Object.freeze([...members]),
    }))
    for (const sessionId of members) {
      const existing = searchTermsBySession[sessionId]
      if (existing === undefined) searchTermsBySession[sessionId] = Object.freeze([tag])
      else if (!existing.includes(tag)) searchTermsBySession[sessionId] = Object.freeze([...existing, tag])
    }
  }

  // “未标记”组：所有已知会话中没有任何标签的那些；排在标签组之后。
  const untagged = allSessionIds.filter(sessionId => !tagsBySession.has(sessionId))
  if (untagged.length > 0) {
    groups.push(Object.freeze({
      id: UNTAGGED_GROUP_ID,
      label: labels.untaggedLabel,
      sessionIds: Object.freeze([...untagged]),
    }))
  }

  const revision = Number.isFinite(previous.revision) ? (previous.revision as number) + 1 : 0
  const next: SessionGroupingSnapshotV1Alpha1 = Object.freeze({
    revision,
    groups: Object.freeze(groups),
    ...(Object.keys(searchTermsBySession).length === 0 ? {} : { searchTermsBySession: Object.freeze(searchTermsBySession) }),
  })
  return snapshotMaterialEqual(next, previous) ? previous : next
}

/** 材料比较：组/成员/搜索词逐项一致即视为未变化（忽略 revision 本身）。 */
function snapshotMaterialEqual(
  a: SessionGroupingSnapshotV1Alpha1,
  b: SessionGroupingSnapshotV1Alpha1,
): boolean {
  if (a.groups.length !== b.groups.length) return false
  for (let i = 0; i < a.groups.length; i += 1) {
    const ga = a.groups[i]
    const gb = b.groups[i]
    if (ga === undefined || gb === undefined) return false
    if (ga.id !== gb.id || ga.label !== gb.label) return false
    if (ga.sessionIds.length !== gb.sessionIds.length) return false
    for (let j = 0; j < ga.sessionIds.length; j += 1) {
      if (ga.sessionIds[j] !== gb.sessionIds[j]) return false
    }
  }
  const sa = a.searchTermsBySession ?? {}
  const sb = b.searchTermsBySession ?? {}
  const ka = Object.keys(sa)
  const kb = Object.keys(sb)
  if (ka.length !== kb.length) return false
  for (const key of ka) {
    const va = sa[key]
    const vb = sb[key]
    if (va === undefined || vb === undefined) return false
    if (va.length !== vb.length) return false
    for (let i = 0; i < va.length; i += 1) {
      if (va[i] !== vb[i]) return false
    }
  }
  return true
}
