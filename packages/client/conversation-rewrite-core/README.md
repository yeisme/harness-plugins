# @yeisme/dsh-client-ui-conversation-rewrite-core

Host-neutral conversation rewrite core V2：稳定边界决策、typed owner outcome 与分阶段 fork/prompt/activate mutation controller。零 React、零 DOM、零 DSH runtime 依赖，由 Web（`@yeisme/dsh-client-ui-conversation-rewrite`）与 TUI（`client/dsh-tui` v21）共享。

## V2 boundary

```ts
import {
  computeUserTurnTargetV2,
  computeRetryTargetV2,
  type RewriteConversationSnapshotV2,
} from '@yeisme/dsh-client-ui-conversation-rewrite-core'

const decision = computeUserTurnTargetV2(snapshot, userSeq, 'edit', { forkBeforeMessage: false })
if (decision.ok) {
  // decision.target: { kind, key, sourceSessionId, sourceGeneration,
  //                    messageKey, messageSeq, boundarySeq, text }
} else {
  // decision.reason: 'not-found' | 'not-text' | 'running' | 'first-round' | 'removed'
  //                | 'stale' | 'stable-boundary-unavailable' | 'settlement-pending'
}
```

- `computeUserTurnTargetV2` 是 Web Edit 与 TUI 历史改写的共同入口；TUI 未修改提交传 `kind: 'retry'`。
- `computeRetryTargetV2` 只接受 adapter 已精确解析的 assistant key；Web 的 single-tail 启发式留在 adapter。
- 稳定边界规则只有一个：目标 prompt 之前最近的 `turn/end`；`boundarySeq=null` 仅在首轮且能力可用时成为可执行 target。
- 纯函数：同输入两次调用产生深相等结果，输入数组不被修改。

## Typed outcome 与 controller

```ts
import {
  ConversationRewriteControllerV2,
  accepted, rejected, unknownOutcome,
} from '@yeisme/dsh-client-ui-conversation-rewrite-core'

const controller = new ConversationRewriteControllerV2({
  // adapter 把 owner typed response 映射为 outcome：
  // - accepted(value)  owner 确认接受
  // - rejected(code)   owner 确定性拒绝
  // - unknownOutcome(code, partial?)  无法证明（timeout/disconnect/未分类 throw）
  fork: async (input) => accepted({ childSessionId: 'child-1' }),
  prompt: async (input) => accepted({}),
  activate: async (input) => accepted({}),
  hydrate: undefined, // 可选阶段；缺省即跳过
})

const final = await controller.run({ operationId: 'op-1', target })
// final: idle → forking → prompting → activating → hydrating → succeeded
//        任一 rejected/unknown → recoverable_error（保留 childSessionId）
```

安全不变量：

- single-flight：活跃期间重复 `run` 返回同一 Promise，不产生第二个 fork；
- 任一失败收敛 `recoverable_error`，core 永不自动重试、重发、补偿删除；
- child ID 一旦已知即保留，供 Inspect/Open/Retry-activation 恢复路径；
- observable state / receipt 永不包含 prompt 文本（sentinel 测试守护）；
- dispose 只阻止后续发布并以 `recoverable_error(stale/disposed)` 收敛。

## Shared fixtures（`./testing`）

```ts
import {
  rewriteContractCasesV2,
  executeRewriteContractCaseV2,
  matchesRewriteDecisionV2,
  matchesRewriteStateV2,
} from '@yeisme/dsh-client-ui-conversation-rewrite-core/testing'

for (const kase of rewriteContractCasesV2) {
  const result = await executeRewriteContractCaseV2(kase)
  // boundary case → matchesRewriteDecisionV2(result.decision!, kase.expected)
  // mutation/procedure case → matchesRewriteStateV2(result.final!, kase.expected)
}
```

覆盖：completed Edit/Retry、first-round enabled/disabled、running/settlement、non-text、removed、not-found、stable-boundary-unavailable、fork rejected/unknown（含 partial child）、prompt rejected/unknown、activate/hydrate 失败、duplicate run 与 dispose-late-result。fixture 文本/ID 均为虚构。

## 隐私

prompt 文本只作为 `prompt()` 执行参数穿过 controller；不进入 observable state、receipt、error、fixture evidence。safe summary 规范化为单行、去控制字符、最多 256 字符（`normalizeRewriteSafeSummary`）。

## 验证

```bash
pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite-core run typecheck
pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite-core run test
pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite-core run build
```

发布是显式外部动作（`pnpm pack` 可本地验证 tarball）；consumer 以精确版本 pin 消费（当前 `0.1.0-rc.1`）。兼容分类：新 package/V2 symbols 全部 additive、pre-1.0；无 deprecation。
