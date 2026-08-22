# @yeisme/dsh-client-ui-conversation-rewrite

DSH Web 会话改写客户端：把「编辑用户消息」和「重试 Assistant 回答」统一实现为分支派生（fork + prompt），不原地修改 `SessionEvent`。

## 能力

- `conversation.chat.assistant-actions`：注册 Retry 按钮，重发该轮次原用户 prompt 并打开 child。
- `conversation.chat.user-actions`：`ctx.slots.spec` 探测到该 slot 后才注册 Edit；发布版 DSH 仍没有该 slot，因此默认不渲染入口。staging / 已合入该 seam 的 DSH 上自动出现 Edit。
- `ChatRewriteController`：pending mutation 状态机，覆盖 idle/submitting/opened/error，支持 dispose 收敛。
- 纯函数边界计算：`computeRetryTarget` / `computeEditTarget` / `previousTurnEndSeq`。

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
