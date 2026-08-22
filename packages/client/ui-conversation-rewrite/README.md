# @yeisme/dsh-client-ui-conversation-rewrite

DSH Web 会话改写客户端：把「编辑用户消息」和「重试 Assistant 回答」统一实现为分支派生（fork + prompt），不原地修改 `SessionEvent`。

## 能力

- `conversation.chat.assistant-actions`：注册 Retry 按钮，重发该轮次原用户 prompt 并打开 child。
- `conversation.chat.user-actions`：仅在上游 additive seam 存在时注册 Edit 按钮（当前发布版 DSH 尚无此 slot，因此 Edit 默认不注册，但组件与控制器已就绪）。
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

- 非首轮消息使用 `ctx.sessions.fork` + `session.prompt` 派生 child；首轮依赖 `session.forkBeforeMessage`（retain-next）。
- unknown/partial/stale/running 状态只返回 typed error 或禁用，绝不自动重试。
- V1 只支持纯文本消息；附件/图片编辑保留为后续任务。
