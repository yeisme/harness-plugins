// @vitest-environment jsdom
/**
 * 端到端闭环（jsdom）：文本选区 → 浮动工具条 → 紧凑 Composer → 批注批 →
 * 多位置提案 → 逐位置审批 → 版本围栏应用 receipt。host 侧用内存参考实现。
 */
import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, SELECTION_ANNOTATION_POLICY_KEY, SELECTION_ANNOTATION_SUBMIT_EVENT, SELECTION_INTERACTION_EVIDENCE_EVENT } from '../../src/client/index.ts'
import { ApprovalPanelController, type ApprovalServiceAdapter } from '../../src/client/approval.ts'
import { createInMemoryVersionedFileStore, createSelectionAnnotationService } from '@yeisme/dsh-selection-host/node'
import { computeQuoteDigest } from '@yeisme/dsh-selection-host'

function makeCtx(): { ctx: ClientContext; dispose: () => void } {
  const disposers: (() => void)[] = []
  const ctx = {
    effect: (register: () => () => void) => {
      disposers.push(register())
      return () => {}
    },
  } as unknown as ClientContext
  return { ctx, dispose: () => disposers.forEach(fn => fn()) }
}

// jsdom 不内置 localStorage：按 mermaid-render 集成测试的既存桩模式补内存实现。
if (window.localStorage === undefined) {
  const store = new Map<string, string>()
  const stub = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
  }
  // jsdom 单 realm：window 即 globalThis，同一引用防 getter 自递归。
  Object.defineProperty(window, 'localStorage', { configurable: true, value: stub })
  if (globalThis !== window) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: stub })
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  window.localStorage.clear()
})

describe('selection annotation end-to-end flow', () => {
  it('runs selection -> stable Actions -> explicit ask -> composer -> v2 submit event', async () => {
    vi.useFakeTimers()
    try {
      const sends: { intent: string; text: string; approvalPolicy: string }[] = []
      const { ctx, dispose } = makeCtx()
      const disposer = await apply(ctx, { composerAdapter: { send: async input => { sends.push(input) } } })
      // V2 默认：不再有 V1 私有工具条，Actions 由全局交互层渲染。
      expect(document.querySelector('.dsh-selection-toolbar')).toBeNull()
      const actions = document.querySelector('[data-dsh-selection-actions]') as HTMLElement
      expect(actions).not.toBeNull()
      expect(actions.style.display).toBe('none')

      const block = document.createElement('p')
      block.textContent = 'Agent 回复中的可选中段落'
      document.body.append(block)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(block)
      selection?.addRange(range)

      const submitted = new Promise<CustomEvent>((resolve) => {
        window.addEventListener(SELECTION_ANNOTATION_SUBMIT_EVENT, event => resolve(event as CustomEvent), { once: true })
      })

      // 未稳定前不渲染 Actions。
      vi.advanceTimersByTime(50)
      expect(actions.style.display).toBe('none')
      vi.advanceTimersByTime(200)
      await vi.advanceTimersByTimeAsync(50)
      expect(actions.style.display).toBe('block')

      const composerOverlay = document.querySelector('.dsh-selection-composer') as HTMLElement
      expect(composerOverlay).not.toBeNull()
      // 只有显式动作才打开 Composer；ask 是 primary。
      const askButton = actions.querySelector('button[data-action-id="dsh:ask"]') as HTMLButtonElement
      expect(askButton).not.toBeNull()
      fireEvent.click(askButton)
      expect(composerOverlay.style.display).toBe('block')
      expect(document.activeElement).toBe(composerOverlay.querySelector('textarea'))

      const textarea = composerOverlay.querySelector('textarea') as HTMLTextAreaElement
      fireEvent.input(textarea, { target: { value: '这一段在说什么？' } })
      fireEvent.click(composerOverlay.querySelector('button[data-action="send"]') as HTMLButtonElement)
      await vi.advanceTimersByTimeAsync(50)

      const event = await submitted
      const detail = event.detail as { intent: string; text: string; approvalPolicy: string; policyVersion?: string; canonicalActionId?: string; contextKind?: string }
      expect(detail.intent).toBe('ask')
      expect(detail.text).toBe('这一段在说什么？')
      expect(detail.approvalPolicy).toBe('preview-first')
      expect(detail.policyVersion).toBe('v2')
      expect(detail.canonicalActionId).toBe('dsh:ask')
      expect(detail.contextKind).toBe('text')
      expect(sends).toHaveLength(1)
      expect(sends[0].approvalPolicy).toBe('preview-first')

      // Esc 依次关闭 Composer（回 Actions）与 Actions。
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      expect(composerOverlay.style.display).toBe('none')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      expect(actions.style.display).toBe('none')
      disposer()
      dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes the composer with Escape from the textarea (v2: layer returns to actions)', async () => {
    vi.useFakeTimers()
    try {
      const { ctx, dispose } = makeCtx()
      const disposer = await apply(ctx, { composerAdapter: { send: async () => {} } })
      const block = document.createElement('p')
      block.textContent = 'keyboard flow paragraph'
      document.body.append(block)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(block)
      selection?.addRange(range)
      vi.advanceTimersByTime(250)
      const actions = document.querySelector('[data-dsh-selection-actions]') as HTMLElement
      const composerOverlay = document.querySelector('.dsh-selection-composer') as HTMLElement
      fireEvent.click(actions.querySelector('button[data-action-id="dsh:ask"]') as HTMLButtonElement)
      expect(composerOverlay.style.display).toBe('block')
      const textarea = composerOverlay.querySelector('textarea') as HTMLTextAreaElement
      fireEvent.keyDown(textarea, { key: 'Escape', bubbles: true, cancelable: true })
      expect(composerOverlay.style.display).toBe('none')
      // Composer 关闭后 Actions 仍可恢复（逐层退出），再一次 Esc 才收起。
      expect(actions.style.display).toBe('block')
      disposer()
      dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('v1 adapter renders the legacy toolbar with a deprecated evidence marker and rolls back cleanly', async () => {
    vi.useFakeTimers()
    try {
      window.localStorage.setItem(SELECTION_ANNOTATION_POLICY_KEY, 'v1')
      const evidences: unknown[] = []
      const collect = (event: Event): void => { evidences.push((event as CustomEvent).detail) }
      window.addEventListener(SELECTION_INTERACTION_EVIDENCE_EVENT, collect)
      const { ctx, dispose } = makeCtx()
      const disposer = await apply(ctx)
      try {
        // V1 adapter：旧工具条回归 + deprecated 脱敏标记。
        const toolbar = document.querySelector('.dsh-selection-toolbar') as HTMLElement
        expect(toolbar).not.toBeNull()
        expect(document.querySelector('[data-dsh-selection-actions]')).toBeNull()
        expect(evidences).toContainEqual({ policyVersion: 'v1', capability: 'selection.interaction.v2', result: 'v1-adapter-active', deprecated: true })

        // 回滚验证：移除策略后重新 apply，V2 回归且切回不丢当前选区。
        window.localStorage.removeItem(SELECTION_ANNOTATION_POLICY_KEY)
        disposer()
        const { ctx: ctx2, dispose: dispose2 } = makeCtx()
        const disposer2 = await apply(ctx2)
        try {
          expect(document.querySelector('.dsh-selection-toolbar')).toBeNull()
          const actions = document.querySelector('[data-dsh-selection-actions]') as HTMLElement
          expect(actions).not.toBeNull()
          expect(evidences).toContainEqual({ policyVersion: 'v2', capability: 'selection.interaction.v2', result: 'v2-layer-attached', deprecated: false })
          const block = document.createElement('p')
          block.textContent = 'rollback keeps selection context'
          document.body.append(block)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          const range = document.createRange()
          range.selectNodeContents(block)
          selection?.addRange(range)
          vi.advanceTimersByTime(250)
          expect(actions.style.display).toBe('block')
        } finally {
          disposer2()
          dispose2()
        }
      } finally {
        window.removeEventListener(SELECTION_INTERACTION_EVIDENCE_EVENT, collect)
        window.localStorage.removeItem(SELECTION_ANNOTATION_POLICY_KEY)
        disposer()
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('completes annotation -> proposal -> per-position approval -> fenced apply with receipts', async () => {
    const FILE = 'file:src/page.tsx'
    const { store } = createInMemoryVersionedFileStore({
      [FILE]: ['import React', 'export function Page() {', '  return <footer/>', '}'].join('\n'),
    })
    const service = createSelectionAnnotationService({ fileStore: store })

    // 三个位置的锚点（截图标记形态）。
    const digest = await computeQuoteDigest('shot')
    const anchors = [
      service.publishAnchor({ kind: 'image-point', artifactRef: 'file:shot.png', artifactVersion: 'img-1', quotePreview: '按钮图标不清晰', quoteDigest: digest, x: 0.1, y: 0.05 }),
      service.publishAnchor({ kind: 'image-region', artifactRef: 'file:shot.png', artifactVersion: 'img-1', quotePreview: '编辑模式布局需要调整', quoteDigest: digest, x: 0.2, y: 0.3, width: 0.4, height: 0.2 }),
      service.publishAnchor({ kind: 'image-point', artifactRef: 'file:shot.png', artifactVersion: 'img-1', quotePreview: '这里增加状态反馈', quoteDigest: digest, x: 0.8, y: 0.9 }),
    ]
    const batch = service.submitBatch(service.createBatch({ title: '截图批注', anchorIds: anchors.map(a => a.anchorId) }).batchId)
    const request = service.buildAgentRequest(batch.batchId)
    expect(request.markers.map(m => m.label)).toEqual(['#1', '#2', '#3'])
    expect(request.untrustedContext).toBe(true)

    // Agent 回复引用标记编号并产出多位置提案。
    const version = store.currentVersion(FILE)!
    const patchFooter = service.registerPatch({ artifactRef: FILE, baseVersion: version, ranges: [{ startLine: 3, endLine: 3, replacement: ['  return <footer role="contentinfo"/>'] }] })
    const patchPage = service.registerPatch({ artifactRef: FILE, baseVersion: version, ranges: [{ startLine: 2, endLine: 2, replacement: ['export function Page() { // v2'] }] })
    const proposal = service.createProposal({
      title: '修改提案 · 3 个位置',
      batchId: batch.batchId,
      hunks: [
        { key: 'footer', anchorId: anchors[0].anchorId, owner: 'file-host', baseVersion: version, safeSummary: '#1 Footer icon', patchRef: patchFooter },
        { key: 'page', anchorId: anchors[1].anchorId, owner: 'file-host', baseVersion: version, safeSummary: '#2 Markdown editor', patchRef: patchPage },
        { anchorId: anchors[2].anchorId, owner: 'file-host', baseVersion: version, safeSummary: '#3 Status message', patchRef: patchFooter },
      ],
    })

    const patchesOf = service.patches
    const adapter: ApprovalServiceAdapter = {
      getProposal: async id => service.getProposal(id),
      decide: async (id, hunkId, decision) => service.decide(id, hunkId, decision),
      applyApproved: async id => service.applyApproved(id),
      currentVersion: artifactRef => store.currentVersion(artifactRef),
      artifactRefFor: hunk => patchesOf.get(hunk.patchRef)?.artifactRef,
    }
    const panel = new ApprovalPanelController({ proposalId: proposal.proposalId, adapter })
    let state = await panel.refresh()
    expect(state.rows.map(row => row.marker)).toEqual([1, 2, 3])
    expect(state.rows.every(row => row.decision === 'pending')).toBe(true)

    // 逐位置决策：批准 #1、拒绝 #2、要求重做 #3。
    await panel.decide(state.rows[0].hunkId, 'approved')
    await panel.decide(state.rows[1].hunkId, 'rejected')
    await panel.decide(state.rows[2].hunkId, 'revision_requested')
    state = await panel.refresh()
    expect(state.rows.map(row => row.decision)).toEqual(['approved', 'rejected', 'revision_requested'])

    // 部分批准：只有 #1 应用，#2 不出现在最终写入。
    const receipts = await panel.apply()
    const applied = receipts.filter(r => r.action === 'apply' && r.status === 'ok')
    expect(applied).toHaveLength(1)
    expect(applied[0].resultingVersion).toBeDefined()
    expect(store.readLines(FILE)).toEqual(['import React', 'export function Page() {', '  return <footer role="contentinfo"/>', '}'])

    state = await panel.refresh()
    expect(state.rows.map(row => row.decision)).toEqual(['applied', 'rejected', 'revision_requested'])
    // 批准、拒绝、要求修改、应用都有 owner receipt。
    const all = service.receipts(proposal.proposalId)
    expect(all.filter(r => r.action === 'approve')).toHaveLength(1)
    expect(all.filter(r => r.action === 'reject')).toHaveLength(1)
    expect(all.filter(r => r.action === 'revision')).toHaveLength(1)
    expect(all.filter(r => r.action === 'apply')).toHaveLength(1)
  })

  it('shows version conflict rows when the file drifted while the proposal was open', async () => {
    const FILE = 'file:src/drifting.ts'
    const { store, mutateExternally } = createInMemoryVersionedFileStore({ [FILE]: 'one\ntwo' })
    const service = createSelectionAnnotationService({ fileStore: store })
    const digest = await computeQuoteDigest('drift')
    const anchor = service.publishAnchor({ kind: 'file-range', artifactRef: FILE, artifactVersion: 'v0', quotePreview: 'one', quoteDigest: digest, startLine: 1, endLine: 1, startColumn: 0, endColumn: 3 })
    const version = store.currentVersion(FILE)!
    const patch = service.registerPatch({ artifactRef: FILE, baseVersion: version, ranges: [{ startLine: 1, endLine: 1, replacement: ['ONE'] }] })
    const proposal = service.createProposal({
      title: '漂移提案',
      hunks: [{ anchorId: anchor.anchorId, owner: 'file-host', baseVersion: version, safeSummary: 'upper', patchRef: patch }],
    })
    await service.decide(proposal.proposalId, proposal.hunks[0].hunkId, 'approved')
    mutateExternally(FILE, ['external', 'two'])

    const adapter: ApprovalServiceAdapter = {
      getProposal: async id => service.getProposal(id),
      decide: async (id, hunkId, decision) => service.decide(id, hunkId, decision),
      applyApproved: async id => service.applyApproved(id),
      currentVersion: artifactRef => store.currentVersion(artifactRef),
      artifactRefFor: hunk => service.patches.get(hunk.patchRef)?.artifactRef,
    }
    const panel = new ApprovalPanelController({ proposalId: proposal.proposalId, adapter })
    const state = await panel.refresh()
    expect(state.rows[0].versionConflict).toEqual({ expected: version, actual: store.currentVersion(FILE) })
    expect(state.plan?.appliable).toEqual([])

    const receipts = await panel.apply()
    expect(receipts[0].action).toBe('reconcile')
    expect(receipts[0].status).toBe('conflict')
    expect(store.readLines(FILE)).toEqual(['external', 'two'])
  })
})
