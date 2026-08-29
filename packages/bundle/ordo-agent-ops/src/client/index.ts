/** Ordo Agent Ops browser runtime：官方 slot + Host Remote 的小型值班摘要。 */

import type { Context } from '@deepseek-ai/cordis'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { warnLegacyPackage } from '../legacy-warning.ts'
import { OrdoAgentOpsController } from './controller.ts'
import { en, NS, zh } from './locales.ts'
import { OrdoAgentOpsSidebar } from './sidebar.tsx'
import type { OrdoAgentOpsPanelFace } from './slots.ts'

export { OrdoAgentOpsController } from './controller.ts'
export { OrdoAgentOpsCursor } from './cursor.ts'
export { OrdoAgentOpsSidebar } from './sidebar.tsx'
export { OrdoAgentOpsToolView } from './toolview.tsx'
export { en, NS, zh } from './locales.ts'
export {
  createOrdoPopupItems,
  createOrdoPopupState,
  openOrdoPopup,
  applyOrdoPopupKey,
  selectOrdoPopupItem,
  canSubmitOrdoPopupMutation,
} from './popup.ts'
export type { OrdoAgentOpsSidebarProps } from './sidebar.tsx'
export type { OrdoAgentOpsToolViewProps } from './toolview.tsx'
export type { OrdoAgentOpsReadPhase, OrdoAgentOpsViewState } from './controller.ts'
export type { OrdoAgentOpsCursorDecision } from './cursor.ts'
export type { OrdoAgentOpsPanelFace } from './slots.ts'
export type { OrdoAgentOpsKey } from './locales.ts'
export type { OrdoAgentOpsSnapshot } from './contracts.ts'
export type { OrdoPopupCommandId, OrdoPopupItemV1, OrdoPopupStateV1, OrdoPopupKeyEventV1 } from './popup.ts'
export {
  GIT_REVIEW_EVIDENCE_CAPABILITY_V1,
  deriveGitFileReviewed,
  evaluateGitCommitReadiness,
  gitReviewEventNeedsSnapshot,
  gitReviewPaneReleasesLease,
  gitReviewRevisionDrift,
  sortGitReviewQueue,
} from './git-review.ts'
export type {
  GitCommitReadinessV1,
  GitReviewActionReceiptV1,
  GitReviewEvidenceCapabilityV1,
  GitReviewEvidenceEventV1,
  GitReviewEvidenceSnapshotV1,
  GitReviewFeedbackV1,
  GitReviewFreshnessV1,
  GitReviewHunkEvidenceV1,
  GitReviewQueueRowV1,
  GitReviewRiskV1,
  GitReviewWorktreeEvidenceV1,
  GitVerificationStateV1,
} from './git-review.ts'

/** browser entry 与其 root 贡献都需要的公开 DSH services。 */
export const inject = ['slots', 'remote', 'locale']

type FiberHandle = { dispose(): Promise<void> }
type SharedClientMount = { references: number; ready: Promise<void>; contribution?: FiberHandle }

const CLIENT_MOUNTS = Symbol.for('yeisme.dsh-ordo-agent-ops.client-mounts.v1')

function clientMounts(): WeakMap<object, SharedClientMount> {
  const globalStore = globalThis as typeof globalThis & Record<symbol, unknown>
  const existing = globalStore[CLIENT_MOUNTS]
  if (existing instanceof WeakMap) return existing as WeakMap<object, SharedClientMount>
  const created = new WeakMap<object, SharedClientMount>()
  globalStore[CLIENT_MOUNTS] = created
  return created
}

function installSidebar(ctx: ClientContext): void {
  let remote: ConstructorParameters<typeof OrdoAgentOpsController>[0] | undefined
  try {
    remote = ctx.get('remote.ordoAgentOps') as ConstructorParameters<typeof OrdoAgentOpsController>[0] | undefined
  } catch {
    remote = undefined
  }
  if (remote === undefined) return
  const controller = new OrdoAgentOpsController(remote)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ordo-agent-ops: dictionaries')
  ctx.effect(() => () => { controller.dispose() }, 'ordo-agent-ops: controller lifecycle')
  ctx.on('connection/reset', () => {
    controller.reset()
    void controller.refresh()
  })

  const openAgentsPane = (): boolean => {
    try {
      const pane = ctx.get('paneWorkbench' as never) as { openView?(request: unknown): void } | undefined
      const sessions = ctx.get('sessions' as never) as { list?: { getSnapshot(): { current?: string } } } | undefined
      const rootSessionId = sessions?.list?.getSnapshot().current
      if (typeof pane?.openView !== 'function' || rootSessionId === undefined) return false
      pane.openView({
        kind: 'subagent.monitor',
        resourceKey: `subagent:${rootSessionId}`,
        role: 'navigator',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
        pinned: true,
        title: 'Agents',
      })
      return true
    } catch {
      return false
    }
  }

  const injected = (): OrdoAgentOpsPanelFace => ({
    hooks: { state: controller.store },
    refresh: () => controller.refresh(),
    openAgentsPane,
  })

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'ordo-agent-ops',
    locale: NS,
    inject: injected,
  }, OrdoAgentOpsSidebar))
}

const sidebarContribution = {
  inject,
  apply: (ctx: Context): void => installSidebar(ctx as ClientContext),
}

/**
 * 根 Context 保存真实 slot contribution，外层 root/legacy client entry 只获得引用。
 * WeakMap 随 Context 可回收，最后一个 fiber dispose 后会销毁 slot、locale、listener
 * 与 controller；它不是永久 global boolean，也不依赖 bundle 加载先后顺序。
 */
async function acquireClient(ctx: ClientContext): Promise<() => Promise<void>> {
  const root = ctx.root
  const mounts = clientMounts()
  let mount = mounts.get(root)
  if (mount === undefined) {
    mount = { references: 0, ready: Promise.resolve() }
    mounts.set(root, mount)
  }
  mount.references += 1
  const current = mount
  const setup = current.ready.then(async () => {
    if (current.contribution === undefined) current.contribution = await root.plugin(sidebarContribution)
  })
  current.ready = setup
  try {
    await setup
  } catch (error) {
    await releaseClient(root, current)
    throw error
  }

  let released = false
  return async () => {
    if (released) return
    released = true
    await releaseClient(root, current)
  }
}

async function releaseClient(root: Context, mount: SharedClientMount): Promise<void> {
  if (mount.references > 0) mount.references -= 1
  if (mount.references !== 0) return
  const mounts = clientMounts()
  if (mounts.get(root) === mount) mounts.delete(root)
  await mount.ready.catch(() => undefined)
  await mount.contribution?.dispose()
}

/** 统一 package 的 browser entry。 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  return acquireClient(ctx)
}

/** 旧 client leaf 的 browser entry；仅额外发送一次迁移诊断。 */
export async function applyLegacyClient(ctx: ClientContext): Promise<() => Promise<void>> {
  warnLegacyPackage(ctx, '@yeisme/dsh-client-ui-ordo-agent-ops')
  return acquireClient(ctx)
}
