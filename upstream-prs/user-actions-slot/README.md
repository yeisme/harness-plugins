# user-actions-slot

dsh conversation user-actions slot（`conversation.chat.user-actions`，对称于 assistant-actions）

- Archived: 2026-08-20（新实现，非 fork 存量）
- Base commit: `141eb6fef83422698aef7a981029e843e8161534`（deepseek-harness, dsh 0.1.0-rc.8 merge）
- 来源分支：fork 本地 `pr/user-actions-slot`（commit `7e09e18e8e`）
- `changes.patch`：完整系列 diff（slot 声明 + user/steering 注册 + UserMessageNodeView 渲染接线 + 聚焦测试 + fixture 桩 + 双语 note 与配对记录）。
- `head.bundle`：分支完整 commit 对象（`git bundle`，基于 base ref），恢复方式：`git fetch head.bundle pr/user-actions-slot:pr/user-actions-slot`（在含 base 141eb6fef8 的上游 clone 内）。
- Apply: `./apply.sh <clean-checkout>`；验证基线：repo 根 `pnpm run typecheck` 绿 + `vitest run packages/client/ui-conversation/tests/user-actions-slot.client.spec.tsx packages/client/ui-conversation/tests/chat-branch-tails.client.spec.tsx` 46/46 绿 + lefthook pre-commit 全绿（translation pairing 987 对一致）。

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
