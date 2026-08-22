## Why

DSH Web 当前无法编辑已发送的用户消息，也没有用户主动“重试/重新生成”Assistant 回答的入口；已有 Branch 只能从已完成轮次的最后一条 Assistant 消息派生。对于 coding-agent 工作流，用户经常需要“上一条说错了，改一下再跑”“这个回答不好，重新生成一次”。这些操作不能通过原地改写历史实现，因为 DSH 的 `SessionEvent` 是 append-only 的 canonical truth，原地改写会破坏请求重建、KV-cache 复用与分支恢复。

准入结论为 `split-owner`：Harness Plugins 拥有 DSH Web 侧的 Edit/Retry 插件、客户端动作条、内联编辑器与交互状态；DSH/`client/deepseek-harness` 拥有最小 additive seam（`conversation.chat.user-actions` slot、可选 `session.forkBeforeMessage` host RPC）；会话日志、fork 边界校验、prompt 发送始终由 DSH Host 拥有。

## What Changes

- 新增 `@yeisme/dsh-conversation-rewrite` bundle 与 `@yeisme/dsh-client-ui-conversation-rewrite` client package。
- 在 DSH Web 用户气泡上提供 Edit 动作：进入内联编辑，保存后以“分支 + 新 prompt”方式派生 child session。
- 在 Assistant 消息动作条上提供 Retry 动作：找到触发该回答的用户 prompt，以“分支 + 重发原 prompt”方式派生 child session。
- 将 Branch/Edit/Retry 统一为同一“分支派生”心智模型，避免三种入口语义漂移。
- 为支持首轮编辑/重试与更精确边界，设计可选 host RPC `session.forkBeforeMessage`；未落地前，插件先用现有 `session.fork` + `session.prompt` 覆盖非首轮场景。
- 在 `client/deepseek-harness` 增加最小 additive seam：`conversation.chat.user-actions` slot，作为 Agent Note handoff。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| user-actions slot | required | client/deepseek-harness | handoff（Agent Note） | upstream seam 合并后组件可注册 |
| Retry as Branch | required | Harness Plugins | deliver-now（非首轮） | component/integration tests |
| Edit as Branch | required | Harness Plugins | deliver-now（非首轮） | component/integration tests |
| 首轮编辑/重试 | required | DSH Host + Harness Plugins | retain-next | `forkBeforeMessage` 或等价 seam |
| 状态与错误处理 | required | Harness Plugins | deliver-now | loading/error tests |
| 可访问性与键盘操作 | required | Harness Plugins | deliver-now | a11y tests |

## Capabilities

### New Capabilities

- `dsh-conversation-rewrite-actions`: Edit/Retry 动作按钮、内联编辑器和 pending mutation 状态机。
- `dsh-conversation-rewrite-branching`: Branch/Edit/Retry 统一分支派生语义与边界计算。
- `dsh-conversation-rewrite-host-seam`: 可选的 `forkBeforeMessage`/`user-actions` 上游 seam handoff。

### Modified Capabilities

无。本 change 不修改 DSH core 既有行为；新增 slot/RPC 均为 additive。

## Impact

- 新 owner package：`packages/bundle/dsh-conversation-rewrite/`、`packages/client/ui-conversation-rewrite/`。
- 依赖：`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-conversation`、React；不复制 DSH core。
- 上游 seam handoff：`client/deepseek-harness/.agents/notes/proposed/feature/2026-08-19-web-conversation-user-actions-slot.md` 与 `2026-08-19-session-fork-before-message.md`。
- 根级设计：`docs/design/dsh-web-conversation-rewrite-plugin-v1.md`。
- 合同兼容分类：全部 additive；rollback 为移除插件 bundle 和/或上游 seam，不涉及数据迁移。
