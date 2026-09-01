/** Workspace → function hierarchy projection for the additive grouping seam. */

import type { Disposable } from '@yeisme/dsh-plugin-contracts'
import type { SessionOrganizationController } from './organization-controller.ts'
import type { SessionGroupingProviderV1Alpha1, SessionGroupingSnapshotV1Alpha1 } from './provider.ts'

export const SESSION_FUNCTIONS_PROVIDER_ID = 'yeisme.session-functions'
export const MANAGE_ORGANIZATION_ACTION_ID = 'yeisme.session-organization.manage'

const EMPTY: SessionGroupingSnapshotV1Alpha1 = Object.freeze({ revision: 0, groups: Object.freeze([]) })

export interface OrganizationSessionRef {
  readonly sessionId: string
  readonly workspaceRef: string
  readonly workspaceName?: string | undefined
}

export function createSessionFunctionsProvider(input: {
  readonly controller: SessionOrganizationController
  readonly sessions: () => readonly OrganizationSessionRef[]
  readonly onManage: (sessionId: string) => void
  readonly labels?: { readonly menu?: string; readonly unclassified?: string; readonly manage?: string } | undefined
}): SessionGroupingProviderV1Alpha1 & Disposable {
  const listeners = new Set<() => void>()
  let previous: SessionGroupingSnapshotV1Alpha1 = EMPTY
  let revision = 0
  const build = (): SessionGroupingSnapshotV1Alpha1 => {
    const state = input.controller.getSnapshot()
    if (state.status !== 'ready') return EMPTY
    const assignments = new Map(state.snapshot.assignments.map(item => [item.sessionId, item]))
    const functions = new Map(state.snapshot.functionTypes.map(item => [item.id, item]))
    const workspaces = new Map<string, OrganizationSessionRef[]>()
    for (const session of input.sessions()) {
      const rows = workspaces.get(session.workspaceRef) ?? []
      rows.push(session)
      workspaces.set(session.workspaceRef, rows)
    }
    const groups: SessionGroupingSnapshotV1Alpha1['groups'][number][] = []
    const searchTermsBySession: Record<string, readonly string[]> = {}
    for (const [workspaceRef, sessions] of workspaces) {
      const parentId = `workspace:${workspaceRef}`
      groups.push(Object.freeze({ id: parentId, label: sessions[0]?.workspaceName ?? workspaceRef, sessionIds: Object.freeze([]) }))
      const byFunction = new Map<string, string[]>()
      for (const session of sessions) {
        const functionId = assignments.get(session.sessionId)?.functionTypeId ?? 'unclassified'
        const members = byFunction.get(functionId) ?? []
        members.push(session.sessionId)
        byFunction.set(functionId, members)
        const label = functions.get(functionId)?.name ?? input.labels?.unclassified ?? 'Unclassified'
        searchTermsBySession[session.sessionId] = Object.freeze([label])
      }
      const sorted = [...byFunction.entries()].sort(([a], [b]) => (functions.get(a)?.order ?? 999) - (functions.get(b)?.order ?? 999))
      for (const [functionId, sessionIds] of sorted) {
        const functionType = functions.get(functionId)
        groups.push(Object.freeze({
          id: `${parentId}:function:${functionId}`,
          parentId,
          label: functionType?.name ?? input.labels?.unclassified ?? 'Unclassified',
          color: functionType?.color ?? 'muted',
          sessionIds: Object.freeze(sessionIds),
        }))
      }
    }
    const material = JSON.stringify({ groups, searchTermsBySession })
    const oldMaterial = JSON.stringify({ groups: previous.groups, searchTermsBySession: previous.searchTermsBySession ?? {} })
    if (material === oldMaterial) return previous
    revision += 1
    previous = Object.freeze({ revision, groups: Object.freeze(groups), searchTermsBySession: Object.freeze(searchTermsBySession) })
    return previous
  }
  // G21 dispose 收口：controller 订阅收纳进具名 unsubscribe 句柄，
  // dispose() 随注册 fiber 释放，不依赖 controller.dispose() 清空监听。
  const subscription = {
    unsubscribe: input.controller.subscribe(() => {
      const before = previous
      const after = build()
      if (before !== after) for (const listener of [...listeners]) listener()
    }),
  }
  return {
    id: SESSION_FUNCTIONS_PROVIDER_ID,
    label: () => input.labels?.menu ?? 'By function',
    order: 90,
    getSnapshot: build,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispose(): void { subscription.unsubscribe() },
    sessionActions: [{
      id: MANAGE_ORGANIZATION_ACTION_ID,
      label: () => input.labels?.manage ?? 'Organize conversation',
      open: input.onManage,
    }],
  }
}
