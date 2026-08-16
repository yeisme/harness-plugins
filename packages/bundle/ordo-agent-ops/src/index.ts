/**
 * Ordo Agent Ops 的单一 DSH 安装面。
 * Host bridge、/ordo 与 browser client 均由此 package 发布；Ordo facts 与动作仍归 Ordo owner。
 */

import type { Context } from '@deepseek-ai/cordis'
import OrdoAgentOpsGateway from './host/bridge.ts'
import OrdoCommandsPlugin, { hasOrdoCommandRegistration } from './host/commands.ts'

export {
  ORDO_AGENT_OPS_EXPECTED_CONTEXT,
  ORDO_AGENT_OPS_OWNER_SOURCE,
  OrdoAgentOpsGateway,
  needsContractSnapshot,
  ordoAgentOpsExpectedContextSchema,
  ordoAgentOpsSnapshotSchema,
  validateOrdoAgentOpsExpectedContext,
  validateOrdoAgentOpsSnapshot,
} from './host/bridge.ts'
export type {
  OrdoAgentOpsCapacity,
  OrdoAgentOpsContext,
  OrdoAgentOpsExpectedContext,
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
  ready: Promise<void>
  bridge?: FiberHandle
  commands?: FiberHandle
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
    mount = { references: 0, ready: Promise.resolve() }
    mounts.set(root, mount)
  }
  mount.references += 1

  const current = mount
  const setup = current.ready.then(async () => {
    // 允许一个还在兼容窗口中的外部 bridge 先挂载；统一 package 不抢占或复制它。
    if (requirement.bridge && current.bridge === undefined && root.get('ordoAgentOps') === undefined) {
      current.bridge = await root.plugin(OrdoAgentOpsGateway)
    }
    // command 本身有 fiber-scoped guard；这里同时避免不必要的第二个 child fiber。
    if (requirement.commands && current.commands === undefined && !hasOrdoCommandRegistration(root)) {
      current.commands = await root.plugin(OrdoCommandsPlugin)
    }
  })
  current.ready = setup

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
  const mounts = hostMounts()
  if (mounts.get(root) === mount) mounts.delete(root)
  await mount.ready.catch(() => undefined)
  await mount.commands?.dispose()
  await mount.bridge?.dispose()
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
