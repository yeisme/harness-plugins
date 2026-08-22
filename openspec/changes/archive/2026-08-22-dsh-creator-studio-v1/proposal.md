## Why

DSH 已有 Pane Workbench、Desktop Workbench 与 Rich Media 基础面，但 Eikona、Scaena、Sonora、Auctra、Pinax、Anatomia 的资源、动作和跨工具交接仍缺少统一、可安装且安全的创作工作台。需要用任务优先的视觉界面把生图、生视频、短剧、音频、文字、资料与分析串起来，同时保持每个领域 owner 的事实、权限和 receipt 边界。

## What Changes

- 扩展 Pane 协议与运行时，支持插件级 view/command/intent 注册、任务展示元数据、server-authored action descriptor/request/receipt，以及 artifact intent 的确定性分发。
- 新增 Creator Studio Host：冻结完整 tenant/workspace/principal/install/plugin/policy/runtime context，聚合六个 owner 的安全投影，并在每次动作前重新校验 fresh snapshot、descriptor、target/version 和上下文。
- 新增 Creator Studio Web 客户端：提供任务导航、快速创作、Scaena 六阶段生产脉冲、owner 状态、资源预览、生成队列、审阅、分析、资料与动作表单。
- 复用 Rich Media 的安全预览与 Pane Workbench 的 right/bottom region，不创建第二侧栏、overlay、browser domain store、scheduler 或 task ledger。
- 新增 `@yeisme/dsh-creator-studio` 安装 bundle；它只增加自身 profile 行，并与已经安装的 Pane/Desktop Workbench 组合。
- 对 `unknown`、`partial`、`cancel_unknown`、stale cursor、上下文漂移和不可验证 settlement 统一 fail closed，要求 owner reconcile，禁止自动重试 mutation。

## Capabilities

### New Capabilities

- `creator-studio-host-projection`: 六个领域 owner adapter、冻结上下文、安全快照聚合、短期媒体访问与一次性动作转发契约。
- `creator-studio-pane-experience`: 任务优先 Creator Studio Pane、响应式交互、生产阶段、资源/审阅/队列可视化及依赖缺失降级。
- `creator-studio-artifact-composition`: 跨 owner artifact open/compare/context/handoff intent、server-authored action 表单与确定性 receipt 处理。

### Modified Capabilities

无。仓库当前没有已归档的主规格；Pane 扩展契约在本 change 中作为 Creator Studio 组合能力固化。

## Impact

- 新增 `packages/host/creator-studio`、`packages/client/ui-creator-studio`、`packages/bundle/dsh-creator-studio`。
- 扩展 `packages/host/pane-protocol` 与 `packages/client/ui-pane-workbench` 的兼容性表面。
- 复用 `@yeisme/dsh-rich-media` 的媒体预览叶子能力。
- 新 bundle 依赖 DSH Web Remote、Client Runtime、Slots，以及独立安装的 Pane/Desktop Workbench；owner provider、凭据、OAuth、计费、调度和持久化不属于本 change。
