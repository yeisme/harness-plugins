# pane-workspace-layout

dsh pane workspace layout (right/bottom docking geometry, AppFrame service, tool-call -> Details reveal)

- Archived: 2026-08-20T15:44:01Z
- Rebased onto upstream/master: `b150a551b8d`（dsh 0.1.1-rc.2）
- 来源分支：`yeisme/deepseek-harness` `pr/pane-workspace-layout`（commit `ed708fc43`）
- Fork review PR：https://github.com/yeisme/deepseek-harness/pull/3
- 上游 compare（当前 token 不能对 `deepseek-ai/deepseek-harness` 开 PR）：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/pane-workspace-layout
- `changes.patch`：相对 upstream/master 的 tracked diff（AppFrame 四列两行、conversation Details 接线、package description）。归档损坏的 hunk 计数已重生，不再依赖 `--recount`。
- `new-files/`：workspace geometry/layout + 聚焦 spec + implemented Agent Note。
- Apply: `./apply.sh <clean-checkout>`；验证：聚焦 vitest 97/97 + `verify-agent-note-format` 绿。

## Files

```
 packages/client/ui-conversation/src/client/chat/ChatNodeSeat.tsx
 packages/client/ui-conversation/src/client/chat/ChatView.tsx
 packages/client/ui-conversation/src/client/contract/slots.ts
 packages/client/ui-conversation/tests/chat-view.client.spec.tsx
 packages/client/ui-layout/README.{md,zh.md,i18n.yaml}
 packages/client/ui-layout/package.json
 packages/client/ui-layout/src/client/AppFrame.{tsx,module.css}
 packages/client/ui-layout/src/client/{index,service,workspace-geometry,workspace-layout}.ts
 packages/client/ui-layout/tests/{app-frame,apply,workspace-geometry,workspace-layout}*
 .agents/notes/implemented/feature/2026-08-20-dsh-pane-workspace-layout.{md,zh.md,i18n.yaml}
```
