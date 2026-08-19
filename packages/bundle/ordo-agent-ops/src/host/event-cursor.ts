import type {
  OrdoAgentOpsEvent,
  OrdoAgentOpsEventCursorAnchor,
  OrdoAgentOpsExpectedContext,
  OrdoAgentOpsRef,
} from './types.ts'

/** Host 事件增量消费的 fail-closed 结论。 */
export type OrdoAgentOpsEventCursorDecision =
  | 'not_established'
  | 'advance'
  | 'duplicate'
  | 'reconcile_required'
  | 'drift'

/** 可供诊断/测试读取的游标状态；不包含 event payload 或 owner 私有字段。 */
export interface OrdoAgentOpsEventCursorState {
  readonly streamRef: OrdoAgentOpsRef
  readonly sequence: number
  readonly cursor: OrdoAgentOpsRef
  readonly lastEventRef: OrdoAgentOpsRef | undefined
  readonly context: OrdoAgentOpsExpectedContext
  readonly membershipRevision: number
  readonly pluginReleaseDigest: string
  readonly ordoContractDigest: string
  readonly runtimeGeneration: OrdoAgentOpsRef
}

type MutableState = {
  streamRef: OrdoAgentOpsRef
  sequence: number
  cursor: OrdoAgentOpsRef
  lastEventRef: OrdoAgentOpsRef | undefined
  context: OrdoAgentOpsExpectedContext
  membershipRevision: number
  pluginReleaseDigest: string
  ordoContractDigest: string
  runtimeGeneration: OrdoAgentOpsRef
  seenEventRefs: Set<string>
  seenEventOrder: string[]
  entityVersions: Map<string, number>
  entityOrder: string[]
}

const DEFAULT_MAX_REMEMBERED = 128
const MAX_REMEMBERED = 1024

/**
 * 只消费已通过 `validateOrdoAgentOpsEvent` 的 owner event。它不产生事实、不重试
 * transport，也不替代真实 event source；gap 或 authority drift 会清空本地游标，
 * 等待下一次 authoritative snapshot 建立新锚点。
 */
export class OrdoAgentOpsEventCursor {
  private readonly maxRemembered: number
  private stateValue: MutableState | undefined

  constructor(maxRemembered = DEFAULT_MAX_REMEMBERED) {
    if (!Number.isInteger(maxRemembered) || maxRemembered < 1 || maxRemembered > MAX_REMEMBERED) {
      throw new RangeError(`maxRemembered must be an integer between 1 and ${MAX_REMEMBERED}`)
    }
    this.maxRemembered = maxRemembered
  }

  /** 用 authoritative snapshot 的 stream/cursor/context 建立新 generation 锚点。 */
  seed(anchor: OrdoAgentOpsEventCursorAnchor): void {
    const seenEventRefs = new Set<string>()
    const seenEventOrder: string[] = []
    if (anchor.eventRef !== undefined) {
      seenEventRefs.add(anchor.eventRef)
      seenEventOrder.push(anchor.eventRef)
    }
    this.stateValue = {
      streamRef: anchor.streamRef,
      sequence: anchor.sequence,
      cursor: anchor.cursor,
      lastEventRef: anchor.eventRef,
      context: freezeContext(anchor.context),
      membershipRevision: anchor.membershipRevision,
      pluginReleaseDigest: anchor.pluginReleaseDigest,
      ordoContractDigest: anchor.ordoContractDigest,
      runtimeGeneration: anchor.runtimeGeneration,
      seenEventRefs,
      seenEventOrder,
      entityVersions: new Map(),
      entityOrder: [],
    }
  }

  /** 应用一个已校验 event；返回 duplicate 时保持当前 projection 不变。 */
  apply(event: OrdoAgentOpsEvent): OrdoAgentOpsEventCursorDecision {
    const state = this.stateValue
    if (state === undefined) return 'not_established'
    if (event.streamRef !== state.streamRef || !matchesAuthority(state, event)) {
      this.reset()
      return 'drift'
    }
    if (state.seenEventRefs.has(event.eventRef)) return 'duplicate'
    if (event.sequence <= state.sequence || event.sequence > state.sequence + 1) {
      this.reset()
      return 'reconcile_required'
    }
    const previousEntityVersion = state.entityVersions.get(event.entityRef)
    if (previousEntityVersion !== undefined && event.entityVersion <= previousEntityVersion) {
      this.reset()
      return 'reconcile_required'
    }

    state.sequence = event.sequence
    state.cursor = event.cursor
    state.lastEventRef = event.eventRef
    remember(state.seenEventRefs, state.seenEventOrder, event.eventRef, this.maxRemembered)
    rememberEntity(state, event.entityRef, event.entityVersion, this.maxRemembered)
    return 'advance'
  }

  /** 连接代际切换、tenant switch、卸载或 reconcile 时丢弃全部增量状态。 */
  reset(): void {
    this.stateValue = undefined
  }

  getState(): OrdoAgentOpsEventCursorState | undefined {
    const state = this.stateValue
    if (state === undefined) return undefined
    return Object.freeze({
      streamRef: state.streamRef,
      sequence: state.sequence,
      cursor: state.cursor,
      lastEventRef: state.lastEventRef,
      context: state.context,
      membershipRevision: state.membershipRevision,
      pluginReleaseDigest: state.pluginReleaseDigest,
      ordoContractDigest: state.ordoContractDigest,
      runtimeGeneration: state.runtimeGeneration,
    })
  }
}

function matchesAuthority(state: MutableState, event: OrdoAgentOpsEvent): boolean {
  return event.context.tenantRef === state.context.tenantRef
    && event.context.workspaceRef === state.context.workspaceRef
    && event.context.principalRef === state.context.principalRef
    && event.context.contextRevision === state.context.contextRevision
    && event.context.installationRef === state.context.installationRef
    && event.membershipRevision === state.membershipRevision
    && event.pluginReleaseDigest === state.pluginReleaseDigest
    && event.ordoContractDigest === state.ordoContractDigest
    && event.runtimeGeneration === state.runtimeGeneration
}

function freezeContext(context: OrdoAgentOpsExpectedContext): OrdoAgentOpsExpectedContext {
  return Object.freeze({
    tenantRef: context.tenantRef,
    workspaceRef: context.workspaceRef,
    principalRef: context.principalRef,
    contextRevision: context.contextRevision,
    installationRef: context.installationRef,
  })
}

function remember(set: Set<string>, order: string[], value: string, max: number): void {
  set.add(value)
  order.push(value)
  while (order.length > max) {
    const oldest = order.shift()
    if (oldest !== undefined) set.delete(oldest)
  }
}

function rememberEntity(state: MutableState, entityRef: string, version: number, max: number): void {
  if (!state.entityVersions.has(entityRef)) state.entityOrder.push(entityRef)
  state.entityVersions.set(entityRef, version)
  while (state.entityOrder.length > max) {
    const oldest = state.entityOrder.shift()
    if (oldest !== undefined) state.entityVersions.delete(oldest)
  }
}
