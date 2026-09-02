# @yeisme/dsh-client-ui-conversation-rewrite

DSH Web 会话改写客户端：把「编辑用户消息」和「重试 Assistant 回答」统一实现为分支派生（fork + prompt），不原地修改 `SessionEvent`。

## 能力

- `conversation.chat.assistant-actions`：注册 Retry 按钮，重发该轮次原用户 prompt 并打开 child。
- `conversation.chat.user-actions`：`ctx.slots.spec` 探测到该 slot 后才注册 Edit；发布版 DSH 仍没有该 slot，因此默认不渲染入口。staging / 已合入该 seam 的 DSH 上自动出现 Edit。
- `ChatRewriteController`：pending mutation 状态机，覆盖 idle/submitting/opened/error，支持 dispose 收敛。
- 纯函数边界计算：`computeRetryTarget` / `computeEditTarget` / `previousTurnEndSeq`。

## Shared Core V2（已实施）

Web 与 dsh-tui 通过新包 `@yeisme/dsh-client-ui-conversation-rewrite-core` 共享 host-neutral boundary、`accepted | rejected | unknown` mutation outcome、分阶段 recovery receipt 与 contract fixtures。本 package 现在是 **adapter + view**：

- `boundary.ts` 保留 DSH-specific addressing（messageId 精确寻址 + turn-tail single-tail 启发式），映射为 V2 snapshot 后委托 core 的 `computeUserTurnTargetV2` / `computeRetryTargetV2`；V2 新增 reason（settlement-pending / stable-boundary-unavailable / stale）折回最近的 legacy reason，五个 V1 reason 与返回形状不变。
- `ChatRewriteController` 是 V2 controller 的薄 facade：`forking|prompting|activating|hydrating → submitting`、`succeeded → opened`、`recoverable_error → error`。旧 store shape、Promise 汇合、`mutation_failed` 首轮 fail-closed 与 dispose 收敛语义保持不变。
- 首轮 Edit/Retry 仅在 host 绑定了 `session.forkBeforeMessage` 时启用（capability 缺席时 core 返回 `first-round`，facade 显示既有禁用文案）；发布版 DSH 没有该 RPC，不出现死按钮。
- 跨 surface contract fixtures 由 core `./testing` 子路径提供（`tests/unit/contract-parity.spec.ts` 以 consumer 身份执行同一 expected 表，不复制期望值）。

- 设计：[DSH Conversation Rewrite Core V2](../../../docs/design/dsh-conversation-rewrite-core-v2.md)
- Owning change：`../../../openspec/changes/dsh-conversation-rewrite-core-v2/`
- 兼容：V2 只新增 package/symbol；现有 `computeEditTarget`、`computeRetryTarget`、`ChatRewriteController` 与 package export paths 不改义。

## 开发

```bash
pnpm install
pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run typecheck
pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test
pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test:integration
pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run build
```

## 边界

- 非首轮消息使用 `ctx.sessions.fork` + `session.prompt` 派生 child。
- 首轮 Edit/Retry 仅在 host 绑定了 `session.forkBeforeMessage` 时启用；发布版没有该 RPC，因此保持禁用并显示原因，不出现死按钮。
- unknown/partial/stale/running 状态只返回 typed error 或禁用，绝不自动重试。
- V1 只支持纯文本消息；附件/图片编辑保留为后续任务。
- child 已创建后的 V2 failure 将保留 child ID 并要求 reconciliation；不会自动 resend prompt 或删除 child。
