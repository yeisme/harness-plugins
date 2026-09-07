# 01 · 现有 `/agent` Shell 行为基线（task 1.2）

冻结对象：`workbench-text-development-studio-v1` 落地前由现有 change 建立、且本 change 不得破坏的 `/agent` Shell 行为。等价原则：**Text Development capability 关闭时，下列行为逐项与当前一致**；由三套 goldens 强制（见 §8）。

## 1. Layout reducer（`apps/web/src/workbench/agent/agent-workbench-layout-v2.ts`）

- 19 个 action 的闭合联合（`session_changed`…`compatibility_view_consumed`，:75-94）；reducer 纯函数、无业务状态。
- 宽度钳制：chat 320/380/440，context 280/336/384，document 最小 640（:14-19）。
- Document 限额：visible 3、hard 4，超限拒绝且**绝不静默替换**；重复打开聚焦既有 document 并保留 focus-return（tests: `document limit enforces visible 3…`、`duplicate document open focuses existing…`）。
- Pending selection：normalize、去重、上限 12（:23），关闭 document 只改 layout 不动 selection；session 切换清除 per-session selection、保留 UI 宽度。
- Soft follow：仅显式 profile consent 开启、立即停止；drawer 语义 pinned ⇒ open。
- Compatibility view 消费一次即耗尽（`compatibility_view_consumed`）；context rail 宽度钳制。
- Safe-key 正则合同：`SAFE_DOCUMENT_KEY` ≥3 段 opaque 片段、`SAFE_SESSION_REF`、`SAFE_SELECTION_TYPE/LABEL`（:99-102）；unsafe key/kind 拒绝。
- 确定性：相同 action 序列 ⇒ 相同状态（golden `action sequence determinism`）。

## 2. Composer mount（`apps/web/src/workbench/agent/agent-conversation-workspace.tsx`）

- Composer **全程单实例、不重挂载**：空态 heroActive 居中，任一 document 打开后 dock 到底部；`data-agent-composer` 与 aria 名不变（:1829-1833）。
- 嵌套 overlay 拥有第一次 Escape（:152）；composer gate 任一路关闭（如 profile_confirmation）即禁用并提示（:352）。
- `@` 显式引用集合：draft 级、按 session 隔离，取代硬编码 fixture（:193、:1328）。
- Composer handoff：仅空 composer 插入 bounded suggestion，非空时只提示不覆盖（:1658-1665）。
- 区域 resize：registered chord 与 separator 键盘路径双通道；pane header menu 重排带 announcement 且焦点跟随（agent-conversation-workspace goldens）。

## 3. Pane registry 与限额（`apps/web/src/workbench/agent/agent-pane-registry.ts`）

- 24 个注册 entry（context/run/review/evidence/operations/assets/workItems/workflows/dailyOps/identity/loginMethods/gateway/cli/projectWorkspace/projectSchema/projectAutomation/projectAutomationRun + replica 五 Pane），`agentPaneTypes` 闭合枚举（:29-58）。
- 每 entry：closed SafeRef params（additionalProperties:false 语义）、documentKey 规则、requiredAction 稳定 machine id（:281-311）。
- unknown pane type / unsafe params / unknown version → fail closed（`needs_contract`/`invalid_params`），绝不打开 stub；重复打开同 documentKey 聚焦既有。
- `preflightAgentPaneOpen` §4 mount gate：duplicate → 聚焦，不双开（:366、workspace :758）。

## 4. Proposal Authority

- 所有 candidate/decision accept 走 `service/internal/proposalauthority` → `TaskService`；accept 不形成第二执行状态机；未决 proposal 不自动接受、`unknown_accept` 不自动重试（AGENTS.md 架构边界）。

## 5. Conversation client（`packages/task-sdk/src/conversation-models.ts`、`conversation-client.ts`）

- 合同 `workbench.conversation.v1alpha1`：未知 major → null（needs_contract）；未知 critical 枚举/缺 required safe ref/oversize → null；未知字段丢弃不透传；正文（prompt/chain-of-thought/provider payload/credential）永不建模。
- 旧 turn Task 只持 safe refs；sealed turn intent 沿 `workbench.agent.turn.submit.v1`。

## 6. Screenplay Room

- `auctraScreenplay` Pane 属 replica 五 Pane 注册面（`replicaClosedParams`），capability truth table 驱动 requiredAction；真实 owner 合同未就绪时 maturity 保持 `needs_contract`。
- 既有 surface（双时间线、Scene/Beat、Scene Card、Context graph、专注写作）由 `workbench-auctra-screenplay-room-v1` 拥有（24/32），行为以其 focused regression 为准；本 change 6.3 只将其接入共享 Lens host，不改其 route/contract。

## 7. Capability-off 等价声明

Text Development 的 document/Lens manifest（task 2.5）未注册或 capability 关闭时：palette 不出现入口、intent 解析 fail closed（needs_contract）、layout/composer/Pane 行为与上表逐项一致。goldens 是等价性的可执行证明。

## 8. Validation

`bunx vitest run agent-workbench-layout-v2 agent-conversation-workspace agent-pane-registry`（from `apps/web`）→ **3 files / 120 tests passed**（2026-09-05 03:27 run, duration 40.77s）。
