## Context

当前 `packages/client/ui-conversation-rewrite` 同时拥有 Web slot/React 组件、DSH-specific snapshot addressing、stable boundary 计算与 async mutation controller。V1 已经正确坚持 Edit/Retry = fork child + prompt，而不是原地改历史；问题在于 pure logic 仍从 Web 包导出并 import `@deepseek-ai/dsh-client-runtime/client`。dsh-tui 若直接依赖该包会引入 React/DOM/Web peer graph，若复制 boundary/controller 又会形成第二套 failure semantics。

本 change 把“跨 surface 必须一致的事实”抽到独立 core：host-neutral history、stable boundary、typed owner outcome、pipeline stage 与 recovery receipt。Web 与 TUI 继续各自拥有 snapshot adapter、interaction 和 rendering。

## Goals / Non-Goals

**Goals:**

- 产出可由 Web、TUI、Node tests 消费的零 React headless package。
- 让 Edit、Retry、TUI historical rewrite 共享稳定 boundary 与 fail-closed reason。
- 将 owner mutation 的 rejected/unknown 明确分开，杜绝不安全自动 retry。
- 在 child 已创建后保留可恢复 identity，而不把 prompt 放入 observable state。
- 维持既有 Web package 的 source/binary API 与 UI 行为兼容。

**Non-Goals:**

- 不拥有 Session/history、fork/prompt/open/hydrate 的 canonical state 或 transport。
- 不提供 React/TUI renderer、slot registration、shortcut、dialog 或持久 recovery store。
- 不新增 `forkBeforeMessage` owner seam，不改变 `sessions.fork`/`prompt` wire。
- 不把 V1 DSH-specific tail/messageId heuristic 强塞进 host-neutral core。
- 不自动删除 child、补偿 fork、重发 prompt 或决定产品级恢复按钮布局。

## Decisions

### 1. 新包是唯一 shared owner，现有 Web 包变为 adapter + view

目录与发布面：

```text
packages/client/conversation-rewrite-core/
  src/types.ts
  src/boundary.ts
  src/outcome.ts
  src/controller.ts
  src/testing.ts
  src/index.ts
  tests/*.spec.ts
```

package name：`@yeisme/dsh-client-ui-conversation-rewrite-core`。初始版本 `0.1.0-rc.1`，ESM、strict TypeScript、tsdown、Vitest；production dependencies 为空。它不声明 Cordis/React/DSH peer dependency。

公开 exports：

- `.`：types、boundary、outcome helpers、V2 controller；
- `./testing`：synthetic host-neutral contract fixtures，供 Web/TUI consumer tests；
- `./package.json`。

`ui-conversation-rewrite` 保留现有 package name、exports 与 React peers，只新增 core dependency。替代方案“把 pure files 留在 Web 包并让 TUI deep import”会让 TUI 继承 Web peer graph和不稳定内部路径，因此拒绝。

### 2. Core input 是最小 host-neutral event projection

```ts
export type RewriteMessageKindV2 = 'user' | 'steering' | 'assistant'

export type RewriteContentPartV2 =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: string; readonly [key: string]: unknown }

export interface RewriteMessageV2 {
  readonly key: string
  readonly kind: RewriteMessageKindV2
  readonly seq: number
  readonly messageId?: string
  readonly content: readonly RewriteContentPartV2[]
  readonly completed: boolean
}

export interface RewriteConversationSnapshotV2 {
  readonly sessionId: string
  readonly generation: number
  readonly running: boolean
  readonly removed: boolean
  readonly messages: readonly RewriteMessageV2[]
  readonly turnEnds: readonly number[]
}

export interface RewriteCapabilitiesV2 {
  readonly forkBeforeMessage: boolean
}
```

`key` 是 adapter 提供的稳定 opaque identity；core 只比较/返回，不解析。数组输入视为 immutable；函数内部排序时复制。非 text part 即整体 `not-text`，不拼接附件 caption 或未知字段。

### 3. Boundary V2 API 与 legacy reason 对齐

```ts
export type RewriteKindV2 = 'edit' | 'retry'

export type RewriteDisableReasonV2 =
  | 'not-found'
  | 'not-text'
  | 'running'
  | 'first-round'
  | 'removed'
  | 'stale'
  | 'stable-boundary-unavailable'
  | 'settlement-pending'

export interface RewriteTargetV2 {
  readonly kind: RewriteKindV2
  readonly key: string
  readonly sourceSessionId: string
  readonly sourceGeneration: number
  readonly messageKey: string
  readonly messageSeq: number
  readonly boundarySeq: number | null
  readonly text: string
}

export type RewriteDecisionV2 =
  | { readonly ok: true; readonly target: RewriteTargetV2 }
  | { readonly ok: false; readonly reason: RewriteDisableReasonV2 }

export function computeUserTurnTargetV2(
  snapshot: RewriteConversationSnapshotV2,
  userSeq: number,
  kind: RewriteKindV2,
  capabilities: RewriteCapabilitiesV2,
): RewriteDecisionV2

export function computeRetryTargetV2(
  snapshot: RewriteConversationSnapshotV2,
  assistantKey: string,
  capabilities: RewriteCapabilitiesV2,
): RewriteDecisionV2
```

`computeUserTurnTargetV2` 是 TUI 与 Web Edit 的共同入口；TUI 未修改提交传 `kind: 'retry'`。`computeRetryTargetV2` 只处理 adapter 已经准确映射的 assistant key。DSH Web 的 single-tail/messageId fallback 继续留在 `ui-conversation-rewrite` adapter，避免把 upstream rc 兼容启发式变成公共 domain contract。

稳定边界规则只有一个：找到目标 prompt 之前最近的 `turn/end`。`boundarySeq=null` 仅在 first round 且 capability 为 true 时成为可执行 target；否则 `first-round`。running 最后一个 open turn 返回 `running`/`settlement-pending`，不能猜完成边界。

### 4. Owner outcome 是值，不从异常猜 accepted/rejected

```ts
export type RewriteMutationOutcomeV2<T> =
  | { readonly kind: 'accepted'; readonly value: T }
  | { readonly kind: 'rejected'; readonly code: string; readonly summary?: string }
  | { readonly kind: 'unknown'; readonly code: string; readonly partial?: Partial<T>; readonly summary?: string }
```

core 提供 `accepted(value)`、`rejected(code, summary?)`、`unknown(code, partial?, summary?)` helpers，并将 summary 规范化为单行、最大 256 字符的 safe text。adapter 必须用 owner typed response 证明 rejected；普通 timeout、abort、disconnect、unclassified throw 一律 unknown。core 不读取 provider payload 以猜测。

### 5. Mutation host 与 request 明确 stage currency

```ts
export interface RewriteMutationHostV2 {
  fork(input: {
    readonly operationId: string
    readonly sourceSessionId: string
    readonly boundarySeq: number
  }): Promise<RewriteMutationOutcomeV2<{ readonly childSessionId: string }>>

  forkBeforeMessage?(input: {
    readonly operationId: string
    readonly sourceSessionId: string
    readonly messageSeq: number
  }): Promise<RewriteMutationOutcomeV2<{ readonly childSessionId: string }>>

  prompt(input: {
    readonly operationId: string
    readonly childSessionId: string
    readonly text: string
  }): Promise<RewriteMutationOutcomeV2<Record<string, never>>>

  activate(input: {
    readonly operationId: string
    readonly childSessionId: string
  }): Promise<RewriteMutationOutcomeV2<Record<string, never>>>

  hydrate?(input: {
    readonly operationId: string
    readonly childSessionId: string
  }): Promise<RewriteMutationOutcomeV2<Record<string, never>>>
}

export interface RewriteRunRequestV2 {
  readonly operationId: string
  readonly target: RewriteTargetV2
}
```

`target.text` 只作为 prompt 调用参数穿过 controller，不进入 observable state、receipt 或 error。Host 不暴露 delete/rollback；fork 已 accepted 后无法安全假设补偿删除。

### 6. V2 controller 是 single-flight、observable、无自动补偿

```ts
export type RewriteOperationPhaseV2 =
  | 'idle'
  | 'forking'
  | 'prompting'
  | 'activating'
  | 'hydrating'
  | 'succeeded'
  | 'recoverable_error'

export interface RewriteOperationStateV2 {
  readonly phase: RewriteOperationPhaseV2
  readonly operationId: string | null
  readonly targetKey: string | null
  readonly sourceSessionId: string | null
  readonly sourceGeneration: number | null
  readonly childSessionId: string | null
  readonly failureStage: 'fork' | 'prompt' | 'activate' | 'hydrate' | null
  readonly outcome: 'rejected' | 'unknown' | 'stale' | null
  readonly reasonCode: string | null
  readonly safeSummary: string | null
}

export class ConversationRewriteControllerV2 {
  readonly store: RewriteOperationSnapshotStoreV2
  run(request: RewriteRunRequestV2): Promise<RewriteOperationStateV2>
  reset(): void
  dispose(): void
}
```

一个 controller 同时只执行一个 operation。第二个 run 返回同一 active Promise，不新增 fork。每个 await 后检查 dispose/operation ID；late result 不更新新 operation。dispose 只阻止发布并收敛 state，不发 cancel/delete/compensation。

Pipeline：

```text
boundarySeq != null -> fork
boundarySeq == null -> forkBeforeMessage (capability required)
child known -> prompt -> activate -> hydrate? -> succeeded
```

任一 rejected/unknown 进入 `recoverable_error`。fork rejected 时 child null；fork unknown 可从 `partial.childSessionId` 保留已知 ID；child 已知后的任何失败都保留 ID。controller 不自动 retry。

### 7. Recovery receipt 与 public store 绝不携带 prompt

`RewriteOperationStateV2` 本身是 recovery receipt。它只包含 operation/source/target key、stage/outcome/code/safe summary/child ID。prompt 仍由调用栈和 UI editor 本地持有；core 不缓存 request object，active Promise 只闭包持有到 settlement。测试序列化 store 时必须有 sentinel scan，确保 original/edited prompt 不出现。

UI 可按 state 决定按钮：

- fork unknown：Refresh/Inspect Sessions；
- prompt rejected/unknown：Inspect child，只有外部 reconcile 证明未接受后才发起一个新的显式 operation；
- activate/hydrate failure：Open/Retry activation，不重发 prompt。

core 不提供这些按钮 action，也不保存 reconcile 结果。

### 8. Web V1 compatibility facade 保留全部稳定 surface

现有 exports 不变：

```text
ChatRewriteController
ChatRewriteHost
ChatRewritePhase
ChatRewriteViewState
computeEditTarget
computeRetryTarget
disableReasonKey
previousTurnEndSeq
textOfContent
Edit/Retry components, lineage, locales, seams
```

迁移方式：

1. `boundary.ts` 保留 DSH imports 与现有签名，先执行既有 DSH node/tail addressing，再映射成 V2 snapshot/target；V2 reason 映射回既有五个 V1 reason，新增 reason 只在 V2 API 暴露。
2. `ChatRewriteController` 保留旧 store shape，将 V2 `forking|prompting|activating|hydrating` 投影为 `submitting`，`succeeded` 投影 `opened`，所有 recoverable_error 投影旧 `error`。
3. 旧 `ChatRewriteHost` Promise success 映射 accepted；明确 owner rejection映射 rejected；无法分类的 throw 映射 unknown，但 V1 view 仍显示 bounded `error`。
4. slot registration、React component props、locale keys 与 package export paths 不变。

不把 V2 symbols 从旧包重新命名成旧 symbols；consumer 要使用 V2 时直接 import core package。

### 9. Shared fixtures 通过 `./testing` 发布

`@yeisme/dsh-client-ui-conversation-rewrite-core/testing` 导出 synthetic `RewriteContractCaseV2[]`，每个 case 包含 snapshot、request/capabilities、expected decision 或 staged host outcomes。至少覆盖：

- completed Edit / Retry；
- first-round enabled/disabled；
- running/open、non-text、removed、stale、missing boundary；
- fork rejected/unknown（child unknown/known）；
- prompt rejected/unknown；
- activate/hydrate rejected/unknown；
- duplicate run 与 dispose late result。

fixtures 只用虚构文本/ID，不含真实 prompt、绝对路径或 provider payload。Web 在本仓直接跑；dsh-tui 以 dev/test import 跑同一 case，不复制 expected table。

### 10. Package release、consumer handoff 与 rollback

实现先本地 `pnpm pack` 验证 package files/exports，再由有权限的 root/operator 决定是否 publish。发布是外部动作，不由本 change 自动执行。dsh-tui canary 初始精确 pin `0.1.0-rc.1`；验证稳定后再按仓库依赖策略放宽，避免 unpinned cross-repo drift。

兼容分类：

- 新 package/V2 symbols：additive、pre-1.0；
- Web package dependency 与内部 adapter：additive/internal；
- Web public exports：unchanged；
- DSH APIs/seams：unchanged。

无 deprecation window、无 removal release。若 Web adapter 回归，恢复旧 V1 boundary/controller implementation 并保留已发布 core；若 TUI 回归，由其 v16 selector 回滚。两边都无需迁移 Session 或持久数据。

## Risks / Trade-offs

- [抽象过度导致 core 复刻整个 DSH snapshot] → 只保留 message/seq/content/completed/turnEnds/running/removed/generation 最小 projection。
- [DSH Web tail heuristic 与 TUI history 形状不同] → upstream-specific addressing 留在 adapters，core 只接收已规范化 key/seq。
- [Promise throw 无法判断 definitive rejection] → unclassified 默认 unknown，牺牲自动 retry 换安全；V1 UI 仍折叠为 error。
- [prompt text 在 async closure 中存活] → 仅 operation 生命周期内保留，不进入 store/log；settlement 后释放引用并做 sentinel tests。
- [V1 facade 隐藏 V2 recovery detail] → 保持兼容；新 TUI/未来 Web recovery UI 直接消费 V2 store。
- [跨仓 package 尚未发布阻塞 TUI] → `pnpm pack` 做本地 contract canary；发布权限单独处理，禁止源码复制/link 固化。
- [testing subpath 变成长期 contract] → 使用 versioned `RewriteContractCaseV2`，只做 additive case 增长；breaking fixture schema 另发 V3。

## Migration Plan

1. 新建 core package、V2 types/boundary/outcome/controller/testing exports 与 focused tests；不改 Web runtime。
2. 将现有 Web boundary/controller 接到 adapters/facade，先锁旧 API type fixtures、unit/integration 与 bundle output。
3. 运行 package files/private-import/sentinel/cross-surface contract checks，生成 `pnpm pack` canary。
4. 由 dsh-tui 使用 pack/版本化 release 跑 consumer typecheck、fixtures 与 v21 focused tests；修复只能通过 additive V2 symbols。
5. 完整 harness-plugins quality gates 通过后，由有权限的 operator 决定 publish；记录版本、tarball digest 与 dsh-tui consumer evidence。
6. 若发现回归，Web 恢复旧 internal V1 implementation；core package和新 exports保留，不删除、不改名。

## Open Questions

无。Owner、包名、V2 API、兼容 facade、failure classification、fixtures 与发布 gate 已冻结。
