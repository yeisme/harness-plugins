## Why

用户需要在同一项目中持续推进成果，换会话、换工具或隔天回来时能接上工作。现有 `/agent` 单壳、Project 数据集、Layout、Task 和审阅提供基础，但还缺少面向成果的项目续接入口以及真实运行、Pinax 和成果 owner 的完整消费闭环。

## What Changes

- 在现有 `/agent` 增加 capability-gated 的项目与成果优先姿态：恢复最近成果、打开紧凑项目续接视图、按项目组织会话和运行；复用唯一 composer、document dock 和 Context rail。
- 扩展 `WorkbenchClient.project` 的 `getOverview`、`getContinuity`、`prepareContinuation`，用 safe refs 关联现有 ProjectWorkspace、Runtime、Pinax 与成果 owner。
- 通过现有 Layout service 保存按用户/项目划分的安全视图偏好；编辑内容仍由相应 owner 保存。
- 增加服务端有界 action grant 的消费与可检查 UI；普通动作继续经过同一 proposal/Task/owner 准入链，旧 chat/access grant 不获得新权限。
- 固定统一 C/S 部署体验与本地、远程同版本验收：服务使用本部署的工具和文件，浏览器只访问同源 BFF。
- 用调研、研发、文本、多模态场景复用同一内核，交付状态按真实 owner、运行与部署证据分别判定。

### Required Capability Ledger

| ID | 能力 | 准入与状态 | Owner | 阶段 | 直接验收 |
|---|---|---|---|---|---|
| C1 | 个人高频通用 Agent 工作 | required / split-owner | Runtime + Workbench | P1–P3 | 真实项目、工具与成果 |
| C2 | 项目与成果优先桌面 UI | required / fit | Workbench | P0–P2 | 原型、component、browser |
| C3 | 项目上下文与成果连续性 | required / split-owner | Pinax + Runtime + 成果 owner | P1 | resume/source/restart |
| C4 | 范围内自主推进与介入 | required / split-owner | ProposalAuthority + Runtime/工具 owner | P1–P3 | grant/revoke/cancel/unknown |
| C5 | 云端 Web、本地 Web 同一产品 | required / fit + split-owner | Workbench + Identity + 部署端服务 | P1–P3 | 同版本 local/remote |
| C6 | 多场景共用工作区 | exploratory coverage | 既有领域 owner | P2 | 场景矩阵与交付 receipt |
| C7 | 原有专业能力与稳定深链 | committed / retain | 既有 owner | 全阶段 | capability-off 与深链回归 |

### Non-goals

不创建新 canonical Project、文件库、Pinax memory、Provider、Ordo scheduler 或并列主壳。不把本地/云端做成两套产品，不增加跨部署同步/执行或原生应用打包。多租户编排、公开注册和计费不作为本次个人首版前置；现有路线不删除。

## Capabilities

### New Capabilities

- `workbench-project-continuity-projection`：总览、续接、明确的 prepare 行为及来源/生命周期隔离。
- `workbench-project-artifact-desktop`：项目与成果姿态、恢复、控件、响应式、状态和无障碍。
- `workbench-bounded-autonomy-consumer`：独立 action grant、逐次服务端准入、介入和未知结果处理。
- `workbench-deployment-locality-acceptance`：部署端工具语义、真实链路、场景矩阵和证据晋级。

### Modified Capabilities

- `workbench-agent-session-workspace`：在显式新 capability 下允许项目成果优先，以及经 Layout service 保存的安全项目视图；保留旧会话布局、单 composer 和 Pane 限制。
- `workbench-agent-ui-unification`：将默认对话主视觉要求限定为未启用新项目姿态的情况，新姿态突出成果但保持同一层级与对话锚点。

以上为条件式行为扩展；现有 `/agent`、Project 数据集/视图、Pane、Layout、Task 和 transport 保持兼容，不原地改写已发布 schema。

## Impact

- 实现范围：`apps/web` 的项目组合与已注册 Pane，`packages/task-sdk`，`service/internal/projects`、`agent`、`proposalauthority`、`registry` 及必要 transport/adapters；复用现有内容和布局服务。
- 文档：更新 Blueprint、平台方向、UI 基线、接口索引；产品、UI 和接口细化分别见 `docs/product/project-continuity-workbench.md`、`docs/ui/project-continuity-workbench.md`、`docs/interfaces/project-continuity-workbench.md`。
- 上位合同：根 `workbench-project-continuity-program-v1`；运行时/Pinax/owner 真实接入仍依赖各自 provider packet，不从 fixture 推导 readiness。
- 新增接口与持久化采用 additive 设计；`breaking_surfaces: []`。本轮只落规格、文档、tasks，实施任务保持未完成，不更新主 specs 为已交付行为。
