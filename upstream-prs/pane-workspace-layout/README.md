# pane-workspace-layout / unified-core-pane

dsh 统一 Core Pane seam（Right/Bottom docking、AppFrame host adapter、Tool Details 路由与 legacy 回退）

- Archived: 2026-08-20T15:44:01Z
- Rebased onto upstream/master: `b150a551b8d`（dsh 0.1.1-rc.2）
- 历史来源分支：`yeisme/deepseek-harness` `pr/pane-workspace-layout`（commit `ed708fc43`）。本地归档已继续演进到 Core Pane v1，尚未推送 fork、创建或更新 PR。
- Status: local staging ready；只维护可审查 patch，不执行外部写入。
- `changes.patch`：相对上述精确 upstream 基线生成的零上下文 tracked diff，包含四列两行 AppFrame、`workspace.core-pane.v1`、`ctx.layout.openDetails/closeDetails` Core-first 路由、owner renderer、session lifecycle 与 one-RC legacy Details 回退；`apply.sh` 固定使用 `git apply --unidiff-zero`。
- `new-files/`：workspace geometry/layout、聚焦 spec、更新后的 browser evidence runner 与 implemented Agent Note。
- `evidence.tar.gz`：2026-08-20 旧 docking browser baseline，仅用于历史对照；Core Tool Details runner 已更新，但本次未重新采集浏览器截图。
- Apply: `./apply.sh <clean-checkout>`。

## Core Pane 合同

- `ctx.workspaceLayout.corePaneVersion === 'workspace.core-pane.v1'`。
- `attach(ownerId, preference, corePaneHost?)` 保持旧两参数调用有效；可选 host 只接受 `dsh.tool-details`。
- attach host 后，Right/Bottom owner props 通过 `renderCoreView(id)` 获取 DSH 自有 Details occupant；legacy Details column 不挂载 occupant，也不占宽度。
- host 缺席或 dispose 后，`ctx.layout.openDetails/closeDetails` 继续走原 Details store/column。
- 独立 Details geometry 与 `auxiliaryPriority` 保留一个 RC，后续删除必须另开稳定合同变更。

## 本地验证

```text
focused vitest: 5 files, 102 tests passed
host build: pnpm run build:lib:host passed
focused client tsc: ui-layout + ui-conversation passed
focused oxlint: passed
translation pairing: 1004 pairs passed
agent note format: 597 notes passed
```

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
