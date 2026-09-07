## Why

Workbench 当前能承载 Agent 对话、Pane、Context 和剧本工作区，但尚未形成适合连续数小时创作的通用文本编辑体验：正文编辑、选区 Agent、候选 diff、结构 Lens、恢复状态与 Team 协作仍分散在不同 surface。需要在既有 Agent-first Shell 内加入一个 owner-safe 的文本开发 domain lens，而不是恢复独立 Studio 或让浏览器持有正文真相。

## What Changes

- 在 `/agent` 的现有 Shell 内新增 Text Development domain lens，保持左 Agent rail、中 Document Dock、右 Context rail 的区域身份不变，仅在 `Create` 与 `Collaborate` 姿态间调整权重。
- 在 Document Dock 中加入 source-preserving WYSIWYM 编辑、选区锚点、autosave 状态、Checkpoint、candidate diff 和 adaptive review；正文和 revision 全部来自 Auctra typed projection/action。
- 提供 Document、Outline、Entities、Materials、Review 共享面，以及小说、剧本、自媒体场景 Lens；所有结构操作使用 owner-authored typed actions 与受控拖拽。
- 将项目级全文授权解释为 Runtime 可检索/按需外发的上限，显式 Working Set 表示本轮优先上下文；展示 egress/usage receipt，不把 raw prompt 或 provider payload 写入 Workbench。
- 新增角色、模式、模型和权限分离的 Profile UI；Plan 强制只读；热切换执行 revoke/cancel/reconcile/continuation saga。
- 新增 Team Profile、Team Plan、模拟运行和显式 real-key canary UI；所有执行继续由 Ordo 拥有。
- 桌面支持完整创作，移动端只支持阅读、对话、diff、评论与接受/拒绝。

## Capabilities

### New Capabilities

- `workbench-text-development-shell`: Text Development Lens、双姿态布局、Document Dock、Context rail 与响应式行为。
- `workbench-text-editor-interaction`: source-preserving 编辑、选区动作、autosave、恢复、Checkpoint 与结构化人工编辑状态。
- `workbench-text-agent-review`: candidate-only Agent 修改、adaptive diff、stale/conflict、全文 Context receipt 与热切换。
- `workbench-text-team-collaboration`: Team Profile/Plan、一次批准、模拟运行、单 writer 可视化与真实 canary gate。

### Modified Capabilities

无。新 Lens、client methods 和 action descriptors 均 additive；旧 Agent Shell、Task、Pane 和 Screenplay Room 合同不改义。

## Impact

- 主要影响 `apps/web` 的 Agent workspace、registered Pane/Lens、design-system 复用、i18n source 和浏览器测试。
- BFF、WorkbenchClient 与 service adapter 只新增 Auctra、Conversation Runtime、Ordo 的 typed consumer methods；浏览器仍只访问同源 BFF。
- 依赖 `workbench-agent-chat-canvas-convergence-v2`、`workbench-auctra-screenplay-room-v1` 和三个 owner handoff change；owner 合同未 ready 时显示 `needs_contract`。
- 文档真源新增于 `docs/product/`、`docs/ui/`、`docs/interfaces/`，不修改并列主壳。
- Compatibility：`breaking_surfaces: []`；capability 默认关闭，rollback 为取消 Lens/Pane 注册并恢复既有 `/agent` 布局。
