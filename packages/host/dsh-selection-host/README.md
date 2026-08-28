# @yeisme/dsh-selection-host

Selection & Annotation Agent Interaction V1 host contracts for DSH.

Owns the protocol layer only — never filesystem state, conversation runtime
state or screenshot bytes:

- **Selection anchors** — `file-range`, `markdown-range`, `dom-region`,
  `image-point`, `image-region` sharing `artifactRef`/`artifactVersion`,
  `quotePreview`, `quoteDigest`, `freshness` and `reanchorEvidence`.
  Anchors are the single join key for comments, questions and proposals.
- **Annotation batches** — multi-anchor review batches with stable `#N`
  markers; `buildAgentRequest` hands the agent an untrusted-context request
  whose replies must reference markers.
- **Proposals & approval** — per-hunk decision state machine, partial-apply
  planning with dependency-closure blocking and version fencing.
- **Version-fenced apply** — patches are registered host-side behind opaque
  `patchRef` handles; browsers never submit patch strings. Version drift
  fails closed into `reconcile_required`.
- **Layered capture** — `WebCaptureAdapterV1` (viewport / full page) vs
  `DesktopCaptureAdapterV1` (window / full desktop, Desktop Client owner);
  the web probe for desktop capture is always unavailable with an explicit
  reason.

`./node` ships an in-memory reference service + versioned file store for
tests and owner-service implementers. See
`openspec/changes/dsh-selection-agent-review-v1/` for the product spec.

## Lifecycle

```ts
import {
  computeQuoteDigest,
} from '@yeisme/dsh-selection-host'
import {
  createSelectionAnnotationService,
  createInMemoryVersionedFileStore,
} from '@yeisme/dsh-selection-host/node'

const { store } = createInMemoryVersionedFileStore({ 'file:README.md': '# title\n\nbody' })
const service = createSelectionAnnotationService({ fileStore: store })

// 1) 发布锚点（五种 kind 共用 publishAnchor）
const anchor = service.publishAnchor({
  kind: 'file-range',
  artifactRef: 'file:README.md',
  artifactVersion: 'v1',
  quotePreview: 'body',
  quoteDigest: await computeQuoteDigest('body'),
  startLine: 3, endLine: 3, startColumn: 0, endColumn: 4,
})

// 2) 组批并提交：submitBatch 分配稳定 #N 标记
const batch = service.submitBatch(
  service.createBatch({ title: '截图批注', anchorIds: [anchor.anchorId] }).batchId,
)

// 3) 交给 Agent：不可信上下文投影，回复必须引用标记编号
const request = service.buildAgentRequest(batch.batchId)
// request.markers = [{ marker: 1, label: '#1', ... }]
// request.untrustedContext === true, request.replyContract === 'reply-must-reference-markers'

// 4) Host 侧注册补丁（浏览器拿不到这一步），再建多位置提案
const version = store.currentVersion('file:README.md')!
const patchRef = service.registerPatch({
  artifactRef: 'file:README.md',
  baseVersion: version,
  ranges: [{ startLine: 3, endLine: 3, replacement: ['body (patched)'] }],
})
const proposal = service.createProposal({
  title: '修改提案 · 3 个位置',
  batchId: batch.batchId,
  hunks: [
    { key: 'a', anchorId: anchor.anchorId, owner: 'file-host',
      baseVersion: version, safeSummary: '#1 Footer icon', patchRef },
    // dependencies 用同提案内的 key 或 anchorId 表达：
    // { key: 'b', ..., dependencies: ['a'] },
  ],
})

// 5) 逐位置决策（approve/reject/revision/defer 各产生 owner receipt）
service.decide(proposal.proposalId, proposal.hunks[0].hunkId, 'approved')

// 6) 应用：依赖闭包 + 版本围栏校验，只写已批准 hunks
const receipts = service.applyApproved(proposal.proposalId)
// 冲突时 hunk -> reconcile_required，文件保持未覆盖；receipts 完整留痕
```

## Hunk 状态机

`ProposalHunkV1.decision` 是单一状态字段（用户决策 + 生命周期）：

```text
pending ──┬─ approved ── applying ──┬─ applied
          ├─ rejected              ├─ failed（可重试 applying）
          ├─ revision_requested ── pending（Agent 重做）
          ├─ deferred ── pending（重新处理）
          └─ stale ── pending（版本漂移后协调）
approved → applying → reconcile_required（版本漂移，禁止静默覆盖）
```

纯函数工具：`canTransitionHunk(from, to)` / `assertHunkTransition` /
`planPartialApply(proposal, currentVersions, artifactRefFor)` /
`groupHunksByArtifact(...)`（client 审批面板与 owner apply loop 共用）。

## Capture 分层

```ts
import { probeDesktopCaptureOnWeb, probeWebCapture } from '@yeisme/dsh-selection-host'

probeDesktopCaptureOnWeb()
// { available: false, reason: '... requires the Desktop Client owner; web cannot obtain screen permission' }
probeWebCapture(adapter) // adapter 缺失时 unavailable + missingCapability
```

`ScreenshotArtifactV1` 只含 ref/尺寸/retention/redactedRegions/digest——
截图字节永远留在 owner 侧。

## Limits（SELECTION_PROTOCOL_LIMITS）

| 限制 | 值 |
|---|---|
| quotePreview | 512 chars |
| 单截图标记数 | 20（最低验收）–200（上限） |
| batch 标题 / safeSummary | 160 / 280 chars |
| hunk 依赖数 | 16 |

## Boundaries

- Browser callers only see safe projections and opaque refs; zod strict
  objects make the persisted shape an allowlist（未知字段 fail-closed）。
- Page/file/screenshot content is untrusted context, never instructions.
- No auto-apply: every applied hunk requires an explicit user approval.
- `redactUnsafeFields()` 在写日志/证据前剥除 cookie/token/secret 等键。
