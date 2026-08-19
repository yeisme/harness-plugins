/**
 * Ordo Agent Ops 的单一 DSH 安装面。
 * Host bridge、/ordo 与 browser client 均由此 package 发布；Ordo facts 与动作仍归 Ordo owner。
 */

import type { Context } from '@deepseek-ai/cordis'
import OrdoAgentOpsGateway from './host/bridge.ts'
import OrdoCommandsPlugin, { hasOrdoCommandRegistration } from './host/commands.ts'

export {
  ORDO_AGENT_OPS_EXPECTED_CONTEXT,
  ORDO_AGENT_OPS_ACTION_SOURCE,
  ORDO_AGENT_OPS_OWNER_SOURCE,
  OrdoAgentOpsGateway,
  OrdoAgentOpsEventCursor,
  needsContractSnapshot,
  ordoAgentOpsEventSchema,
  ordoAgentOpsExpectedContextSchema,
  ordoAgentOpsSnapshotSchema,
  validateOrdoAgentOpsExpectedContext,
  validateOrdoAgentOpsActionReceipt,
  validateOrdoAgentOpsActionResult,
  validateOrdoAgentOpsEvent,
  validateOrdoAgentOpsSnapshot,
} from './host/bridge.ts'
export type {
  OrdoAgentOpsCapacity,
  OrdoAgentOpsActionDescriptor,
  OrdoAgentOpsActionReceipt,
  OrdoAgentOpsActionRejection,
  OrdoAgentOpsActionResult,
  OrdoAgentOpsActionSource,
  OrdoAgentOpsContext,
  OrdoAgentOpsDecisionOutcome,
  OrdoAgentOpsExpectedContext,
  OrdoAgentOpsEvent,
  OrdoAgentOpsEventCursorAnchor,
  OrdoAgentOpsEventCursorDecision,
  OrdoAgentOpsEventCursorState,
  OrdoAgentOpsFreshness,
  OrdoAgentOpsOwnerSource,
  OrdoAgentOpsReasonCode,
  OrdoAgentOpsRef,
  OrdoAgentOpsReservationState,
  OrdoAgentOpsRunSummary,
  OrdoAgentOpsSnapshot,
  OrdoAgentOpsState,
} from './host/bridge.ts'
export {
  hasOrdoCommandRegistration,
  parseOrdoCommand,
  parseSafeOrdoRef,
} from './host/commands.ts'
export type { OrdoCommand, SafeOrdoRef } from './host/commands.ts'

type FiberHandle = { dispose(): Promise<void> }

type HostRequirement = {
  readonly bridge: boolean
  readonly commands: boolean
}

type SharedHostMount = {
  references: number
  /** 所有 mount/setup/teardown 都通过同一条 tail 串行化。 */
  tail: Promise<void>
  bridge?: FiberHandle | undefined
  commands?: FiberHandle | undefined
}

const HOST_MOUNTS = Symbol.for('yeisme.dsh-ordo-agent-ops.host-mounts.v1')

/** 根 package 的 Cordis plugin 名和完整运行面所需的 service。 */
export const name = 'ordo-agent-ops'
export const inject = ['commands']

function hostMounts(): WeakMap<object, SharedHostMount> {
  const globalStore = globalThis as typeof globalThis & Record<symbol, unknown>
  const existing = globalStore[HOST_MOUNTS]
  if (existing instanceof WeakMap) return existing as WeakMap<object, SharedHostMount>
  const created = new WeakMap<object, SharedHostMount>()
  globalStore[HOST_MOUNTS] = created
  return created
}

/**
 * 取得一个可共享的 Host 逻辑贡献。child fiber 固定挂在 Context root，外层新旧
 * Loader row 仅持有引用；最后一个引用释放时才反向销毁 command 与 Remote，避免
 * legacy/new mixed profile 的重复 service、重复命令和卸载悬挂。
 */
async function acquireHost(ctx: Context, requirement: HostRequirement): Promise<() => Promise<void>> {
  const root = ctx.root
  const mounts = hostMounts()
  let mount = mounts.get(root)
  if (mount === undefined) {
    mount = { references: 0, tail: Promise.resolve() }
    mounts.set(root, mount)
  }
  mount.references += 1

  const current = mount
  const setup = current.tail.then(async () => {
    // 允许一个还在兼容窗口中的外部 bridge 先挂载；统一 package 不抢占或复制它。
    if (requirement.bridge && current.bridge === undefined && root.get('ordoAgentOps') === undefined) {
      current.bridge = await root.plugin(OrdoAgentOpsGateway)
    }
    // command 本身有 fiber-scoped guard；这里同时避免不必要的第二个 child fiber。
    if (requirement.commands && current.commands === undefined && !hasOrdoCommandRegistration(root)) {
      current.commands = await root.plugin(OrdoCommandsPlugin)
    }
  })
  // 后续操作必须等待本次 setup，即使本次 setup 失败也不能永久堵塞 teardown/reacquire。
  current.tail = setup.catch(() => undefined)

  try {
    await setup
  } catch (error) {
    await releaseHost(root, current)
    throw error
  }

  let released = false
  return async () => {
    if (released) return
    released = true
    await releaseHost(root, current)
  }
}

async function releaseHost(root: Context, mount: SharedHostMount): Promise<void> {
  if (mount.references > 0) mount.references -= 1
  if (mount.references !== 0) return
  const teardown = mount.tail.then(async () => {
    // A new acquire can increment references while this queued teardown waits or disposes.
    // It is still safe to dispose the old generation because the next setup is queued after it.
    const commands = mount.commands
    const bridge = mount.bridge
    mount.commands = undefined
    mount.bridge = undefined
    await commands?.dispose()
    await bridge?.dispose()
    const mounts = hostMounts()
    if (mount.references === 0 && mounts.get(root) === mount) mounts.delete(root)
  })
  mount.tail = teardown.catch(() => undefined)
  await teardown
}

/** 挂载完整的 unified Host 面：Remote 与只读 `/ordo`。 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  return acquireHost(ctx, { bridge: true, commands: true })
}

/** 仅供旧 host leaf shim 使用，保留其原来的单一 bridge 安装语义。 */
export async function applyLegacyHostBridge(ctx: Context): Promise<() => Promise<void>> {
  return acquireHost(ctx, { bridge: true, commands: false })
}

/** 仅供旧 command leaf shim 使用；它仍等待旧语义要求的 bridge service。 */
export async function applyLegacyCommands(ctx: Context): Promise<() => Promise<void>> {
  return acquireHost(ctx, { bridge: false, commands: true })
}

const OrdoAgentOpsPlugin = { name, inject, apply }

export default OrdoAgentOpsPlugin
