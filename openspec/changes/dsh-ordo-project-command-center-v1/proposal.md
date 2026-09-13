## Why

已确认在 DSH 中提供跨会话项目指挥，同时覆盖 Ordo 执行团队和 DSH 原生子会话。现有读取投影缺少完整依赖，旧指挥设计仍引用已退役独立 Workbench。本变更承接已批准方案，完整能力保留，真实运行证据与本地协议交付分别记录。

## What Changes

- Harness Plugins 的项目投影、显式项目绑定、计划修改、版本校验与幂等回执增量。
- 项目 Pane 固定项目，会话 Tab 固定所在会话，按明确关联显示 Agent。
- 完整目标包含计划、预演、批准启动、有限返工和人工验收；没有执行证据的路径保持待验收。

## Capabilities

### New Capabilities

- `ordo-project-command-center`: 项目指挥及受控操作的增量合同。

## Impact

split-owner：Ordo 拥有领域事实与调度，DSH 拥有会话，Harness Plugins 拥有投影消费和界面。旧命令、严格 schema、入口和 workbench 协议名称保持兼容。breaking_surfaces: []。

