# user-actions-slot

dsh conversation user-actions slot（`conversation.chat.user-actions`，对称于 assistant-actions）

- Archived: 2026-08-20（新实现，非 fork 存量）
- Rebased onto upstream/master: `b150a551b8d`（dsh 0.1.1-rc.2）
- 来源分支：`yeisme/deepseek-harness` `pr/user-actions-slot`（commit `593ba0cae`）
- Fork review PR：https://github.com/yeisme/deepseek-harness/pull/1
- 上游 compare（当前 token 不能对 `deepseek-ai/deepseek-harness` 开 PR）：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/user-actions-slot
- `changes.patch`：相对 upstream/master 的 tracked diff（slot 声明 + user/steering 注册 + UserMessageNodeView 渲染接线 + ChatView/fixture 桩）。
- `new-files/`：聚焦 spec + 双语 note 与配对记录。
- Apply: `./apply.sh <clean-checkout>`；验证：`pnpm exec tsc -b tsconfig.client.json` 绿 + `vitest run packages/client/ui-conversation/tests/user-actions-slot.client.spec.tsx packages/client/ui-conversation/tests/chat-branch-tails.client.spec.tsx packages/client/ui-conversation/tests/chat-view.client.spec.tsx` 98/98 + `verify-agent-note-format` / pairing 绿。

## Files

````
 packages/client/ui-conversation/src/client/contract/slots.ts            | slot 声明 + UserActionOwnerProps
 packages/client/ui-conversation/src/client/chat/register-node-renderers.ts | user/steering children 注册
 packages/client/ui-conversation/src/client/chat/MessageItem.tsx         | renderSlot → extraActions 接线
 packages/client/ui-conversation/tests/user-actions-slot.client.spec.tsx | 3 个聚焦测试
 packages/client/ui-conversation/tests/chat-branch-tails.client.spec.tsx | fixture null renderSlot 桩
 .agents/notes/proposed/feature/2026-08-20-conversation-user-actions-slot.{md,zh.md,i18n.yaml}
````

设计依据：monorepo `docs/design/dsh-web-conversation-rewrite-plugin-v1.md` §4.1。
