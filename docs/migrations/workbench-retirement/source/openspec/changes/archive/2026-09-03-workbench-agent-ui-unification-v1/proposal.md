## Why

当前 `/agent` 已有 Agent-first、Spatial Focus 与注册 Pane，但截图与真实预览暴露出一组跨层不一致：主壳、对话、Spatial HUD、上下文栏和 unavailable 状态各自使用不同的密度、语言和层级。用户在同一任务中无法稳定判断“当前任务、下一步、证据状态”和“为什么不能继续”。

现在需要把已确认的 Agent-first 设计决策收敛为一份可执行的 UI 组合合同，先统一共享 tokens、Pane chrome、状态/恢复和空态，再让现有 `/agent` 与注册 Pane 按同一交互语法呈现；本 change 不重写后端合同，也不恢复并列主壳。

## What Changes

- 新增跨区域 UI 统一能力：桌面常驻可折叠会话栏、Agent 对话锚点、Spatial 中央画布与单一上下文栏的层级和响应式规则。
- 新增共享视觉/交互槽位合同：`PaneFrame`、`PaneToolbar`、`StatusBlock`、`RecoveryAction`、`EmptyState`、技术元数据和状态色使用统一 tokens 与组件语义。
- 统一中文优先文案；`sessionRef`、Task、receipt、版本、Pane/Lens 类型等技术标识保留英文等宽显示，禁止同一状态在多个区域重复表达。
- 统一显式联动：画布选择、上下文附件、Pane 打开和 Agent presentation intent 不自动改写 composer、不抢键盘焦点；跨区域只通过安全引用和用户明确动作连接。
- 统一 truthful unavailable：`needs_contract`、`offline`、`stale`、`permission_required` 保留入口，使用就地状态块、影响说明和单一真实恢复动作；不隐藏、不伪造 ready、不使用演示数据冒充真实数据。
- 统一首次进入与空态：无 session/无 Spatial 投影时提供一个真实起步动作，避免空白区域、重复提示和假按钮。
- 补充 UI 级响应式、键盘、reduced-motion、Axe、无横向溢出和关键恢复路径验收；保持现有 aria、`data-*`、SDK、Task/Proposal/Owner 合同和稳定 route。

## Capabilities

### New Capabilities

- `workbench-agent-ui-unification`: 跨 `/agent` 主壳、Spatial Surface 和注册 Pane 的视觉层级、交互联动、状态/恢复、空态、文案和浏览器验收合同。

### Modified Capabilities

- `workbench-agent-shell-visual-language`: 增加统一 tokens、中文优先技术元数据分层、跨区域状态去重和 shared chrome 迁移要求。
- `workbench-agent-pane-composition`: 增加单一上下文栏、就地恢复状态、空态起步动作和 Pane/对话焦点保持要求。
- `workbench-agent-spatial-interaction`: 增加 Spatial 选择与 Agent/composer 的显式联动、不抢焦点和 degraded/recovery 呈现要求。

## Impact

- 产品真源：`docs/product/agent-workbench-blueprint.md`、`docs/ui/agent-first-workbench.md`、`docs/README.md`，必要时新增设计说明页。
- 前端实现范围（后续任务）：`apps/web/src/workbench/agent/**`、共享 design-system tokens/composites、Agent/Spatial locale source 与相应 component/browser tests；不改 Go service、protobuf、SDK 或 Owner adapter。
- OpenSpec 新增一份跨面 capability spec，并为上述三个既有 capability 提供 delta spec；所有改动均为 additive，无 breaking API、数据库迁移或稳定链接移除。
- 验收命令沿用子项目现有命令：`bun run typecheck`、`bun test`、`bun run --cwd apps/web test`、`bun run web:e2e`、`openspec validate --all --strict`；integration/e2e 证据继续写入 `temp/integration-test-runs/<run-id>/`。
