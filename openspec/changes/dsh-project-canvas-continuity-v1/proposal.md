## Why

用户决定彻底退役独立 Workbench，继续在 DSH 插件中推进无限画布、成果和项目连续性。原项目长期不可用且与 DSH 重叠；本变更提取用户行为和恢复要求，不复制其平台。

## What Changes

- 在现有 paneWorkbench 注册项目级无限画布，复用 DSH 会话、Composer 和统一视觉系统。
- 保存项目布局、Draft 与 owner 引用；选择集经现有引用链路进入明确会话，成果按原身份回填。
- 复用 `dsh-prompt-reference-creative-workspace-v1` 的成果预览/比较/保存，不重复实施。
- 项目续接只准备上下文或附着原运行；不自动恢复执行，不构建 TaskService/审批/调度平台。
- 本 change 只交付新路线的规格与任务。实现和真实使用验收保持未完成，旧证据不继承。

## Capabilities

### New Capabilities
- `dsh-project-canvas-continuity`: 项目级画布、持久 Draft、安全引用、会话隔离与显式续接。

### Modified Capabilities

无。已有 Pane、引用和 owner 合同保持原义，按实际实现需要增量扩展。

## Impact

拟用路径：`packages/client/ui-project-canvas`、`packages/host/project-canvas`、薄 bundle；在脚手架生成前先核对现有包可复用性。不创建独立服务、并列主壳、原生客户端或 Workbench 依赖。原始设计及任务存于 `docs/migrations/workbench-retirement/`。
