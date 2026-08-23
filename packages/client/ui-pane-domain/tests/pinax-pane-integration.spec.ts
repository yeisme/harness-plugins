/**
 * dsh-pinax-pane-v1 3.1 组件/集成证据：inbox/note/backlink/graph/history 投影、
 * 非法 metadata fail closed、offline/permission_denied 降级、note handoff 与 teardown。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArtifactIntentSchema } from '@yeisme/dsh-pane-protocol'
import { apply } from '../src/index.ts'
import { DomainActionGateway } from '../src/action-gateway.ts'
import { DomainOwnerSourceBridge } from '../src/owner-source.ts'
import {
  createPinaxActionChannel,
  pinaxHandwrittenMetadataRead,
  pinaxNegativeRead,
  pinaxSnapshotRead,
  type PinaxNotesProjectionLike,
} from '../src/pinax.ts'
import { domainIntent, type DomainSnapshotV1 } from '../src/snapshot.ts'
import { DomainPaneView } from '../src/view.ts'
import { createEvidenceRun } from './evidence.ts'

const paneContext = { workspaceRef: 'workspace:pinax-int', sessionRef: 'session:one', principalRef: 'principal:local', revision: '1' }

function vault(): PinaxNotesProjectionLike {
  return {
    notes: [
      { id: 'note-inbox-01', title: 'Inbox: capture idea', kind: 'note', status: 'inbox', tags: ['inbox'] },
      { id: 'note-daily-02', title: 'Daily note', kind: 'note', status: 'active', tags: ['daily'] },
      { id: 'backlink-03', title: 'Backlinks to daily note', kind: 'backlink', status: 'active', tags: [] },
      { id: 'graph-node-04', title: 'Graph node: project', kind: 'graph', status: 'active', tags: ['graph'] },
      { id: 'history-05', title: 'History: daily note revisions', kind: 'history', status: 'sealed', tags: [] },
    ],
  }
}

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('dsh-pinax-pane-v1 integration evidence', () => {
  it('covers vault projection, handwritten metadata fail-closed, honest negatives, handoff, and teardown', async () => {
    const run = createEvidenceRun('dsh-pinax-pane-v1')
    const scenarios: Record<string, unknown>[] = []

    // Host + Client 全链路
    const ctx = new Context()
    contexts.push(ctx)
    const bridge = new DomainOwnerSourceBridge('pinax', {
      read: () => pinaxSnapshotRead(vault(), paneContext),
      subscribe: () => () => {},
    })
    bridge.open()
    const unprovide = ctx.provide('domain.pinax', bridge)
    const views = new Map<string, unknown>()
    ctx.provide('paneWorkbench', {
      registerView: (input: { descriptor: { kind: string }; component: unknown }) => {
        views.set(input.descriptor.kind, input.component)
        return () => { views.delete(input.descriptor.kind) }
      },
      openView: () => {},
    })
    const disposeClient = apply(ctx)

    const snapshot: DomainSnapshotV1 = bridge.getSnapshot()
    const kinds = [...new Set(snapshot.items.map(item => item.kind))]
    scenarios.push({ id: 'vault-projection', kinds, status: snapshot.status, actions: snapshot.allowedActions.map(action => action.id) })
    expect(kinds).toEqual(['note', 'note', 'backlink', 'graph', 'history'].filter((kind, index, all) => all.indexOf(kind) === index))
    expect(snapshot.status).toBe('ready')
    expect(snapshot.allowedActions.map(action => action.id)).toEqual(['inbox.capture', 'sync.run'])

    // live push：inbox note 进入 note 状态
    bridge.apply({
      schema: 'pane.event.v1alpha1',
      stream: 'domain.pinax',
      cursor: 'c0',
      sequence: 0,
      context: paneContext,
      occurredAt: '2026-08-23T00:00:00Z',
      observedAt: '2026-08-23T00:00:00Z',
      freshness: 'fresh',
      op: 'upsert',
      entityRef: 'note-inbox-01',
      entityVersion: 2,
      payload: { value: { title: 'Inbox: capture idea', kind: 'note', status: 'active', tags: ['inbox'] } },
    })
    scenarios.push({ id: 'live-push', inboxStatus: bridge.getSnapshot().items[0]?.status })
    expect(bridge.getSnapshot().items[0]?.status).toBe('active')

    // 非法 metadata：snapshot 面 fail closed；mutation 面拒绝
    const metadataRead = pinaxHandwrittenMetadataRead(paneContext)
    const metadataBridge = new DomainOwnerSourceBridge('pinax', { read: () => metadataRead, subscribe: () => () => {} })
    metadataBridge.open()
    scenarios.push({ id: 'handwritten-metadata', snapshotStatus: metadataBridge.getSnapshot().status })
    expect(metadataBridge.getSnapshot().status).toBe('contract_mismatch')
    metadataBridge.dispose()

    const gateway = new DomainActionGateway(createPinaxActionChannel({
      submit: async () => ({ status: 'accepted', receiptRef: 'receipt:capture-1', actionId: 'inbox.capture', summary: 'Captured via pinax inbox capture.' }),
    }))
    const preview = await gateway.preview({ actionId: 'inbox.capture' })
    expect(preview.kind).toBe('descriptor')
    const cleanSubmit = preview.kind === 'descriptor' ? await gateway.submit(preview.descriptor, {}, paneContext, 'idem-pinax-capture') : undefined
    scenarios.push({ id: 'action-clean-submit', preview: preview.kind, submit: cleanSubmit?.kind })
    expect(cleanSubmit).toMatchObject({ kind: 'receipt', receipt: { status: 'accepted' } })

    // unknown/timeout → reconcile
    const timeoutGateway = new DomainActionGateway(
      createPinaxActionChannel({ submit: () => new Promise(() => {}) }),
      { deadlineMs: 5 },
    )
    const timeoutPreview = await timeoutGateway.preview({ actionId: 'sync.run' })
    const timeoutSubmit = timeoutPreview.kind === 'descriptor' ? await timeoutGateway.submit(timeoutPreview.descriptor, {}, paneContext, 'idem-pinax-timeout') : undefined
    scenarios.push({ id: 'action-timeout', outcome: timeoutSubmit })
    expect(timeoutSubmit).toMatchObject({ kind: 'reconcile_required', reason: 'timeout' })

    // offline / permission_denied 降级
    for (const kind of ['offline', 'permission_denied'] as const) {
      const negative = new DomainOwnerSourceBridge('pinax', { read: () => pinaxNegativeRead(kind, paneContext), subscribe: () => () => {} })
      negative.open()
      scenarios.push({ id: `negative-${kind}`, status: negative.getSnapshot().status, actions: negative.getSnapshot().allowedActions.length })
      expect(negative.getSnapshot().allowedActions).toEqual([])
      negative.dispose()
    }

    // note handoff：Pinax note → Auctra（跨 Pane）
    const liveSnapshot = bridge.getSnapshot()
    const handoff = domainIntent(liveSnapshot, liveSnapshot.items[1]!, 'handoff', paneContext, 'auctra')
    scenarios.push({ id: 'note-handoff', parsed: ArtifactIntentSchema.safeParse(handoff).success, targetOwner: (handoff as { targetOwner?: string }).targetOwner })
    expect(ArtifactIntentSchema.parse(handoff).targetOwner).toBe('auctra')

    // 组件证据
    const html = renderToStaticMarkup(createElement(DomainPaneView, { snapshot: liveSnapshot }))
    expect(html).toContain('data-badge="Pinax"')
    run.artifact('pinax-vault-pane.html', html)

    // teardown
    disposeClient()
    unprovide()
    bridge.dispose()
    scenarios.push({ id: 'teardown', clientViews: views.size, domainServicePresent: ctx.get('domain.pinax') !== undefined })
    expect(views.size).toBe(0)
    expect(ctx.get('domain.pinax')).toBeUndefined()

    run.summary({
      scope: 'component/integration evidence for dsh-pinax-pane-v1 tasks 2.3/2.4/3.1',
      scenarios,
      redactionChecked: true,
    })
    run.artifact('pinax-integration-outcomes.json', scenarios)
  })
})
