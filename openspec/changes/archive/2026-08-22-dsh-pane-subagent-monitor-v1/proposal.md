## Why

DSH 多 agent 工作体验不如 Codex Desktop 直观，主要原因是打开 subagent 会替换主会话，且缺少侧边/Pane 工作台视图。Pane Workbench 已具备右侧/底部 region、Tab、preview/pin、retention 与安全投影协议，但还没有 Subagent 领域视图。本 change 将 Subagent 作为 Pane 工作台对象呈现，主会话保持 orchestrator，并提供只读详情、follow-up、interrupt 与并行 steering。

准入结论为 `fit + split-owner`：Harness Plugins 拥有 Pane 视图、controller、安全投影与 bundle；DSH 继续拥有 subagent 创建、运行、生命周期、权限与 transcript。

## What Changes

- 新增 `@yeisme/dsh-client-ui-pane-subagent`：Subagent Pane 视图、controller、projection selector、header “Agents” 入口。
- 新增 `@yeisme/dsh-pane-subagent` bundle：可安装 profile 层，组合 pane-workbench 与 subagent monitor。
- 使用 `ctx.sessions.list` 与 `ctx.connection.api.subagents.*` 消费 DSH 官方 seam，不复制 subagent 状态机。
- 主会话不被自动替换；`openSubagent()` 只作为显式 “Open in Main” 动作。
- 可选 Parallel/Swarm steering 开关，引导模型使用原生 subagent 工具并行执行，不实现客户端 scheduler。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| Subagent Pane 视图 | required | Harness Plugins | deliver-now | component tests |
| 安全树投影 | required | Harness Plugins | deliver-now | projection unit tests |
| Detail peek / follow-up / interrupt | required | DSH + Harness Plugins | stage-2 | integration tests |
| Parallel steering 开关 | required | Harness Plugins + DSH | stage-3 | snapshot + browser evidence |
| Subagent outcome projection | required | DSH | retain-next | additive DSH surface |

## Impact

- 新 owner package：`packages/client/ui-pane-subagent/`。
- 扩展目标 package：`packages/bundle/pane-subagent/`。
- 不修改 `client/deepseek-harness` core；不创建第二个 subagent tree/scheduler/task ledger。
- rollback：移除 bundle/profile 行，不涉及数据迁移。
