## Why

根级生态要求独立 Ordo Agent Team Pane：展示跨 runtime 的 DAG、session、attempt、lease、approval、verification 与 evidence。该能力的 Host bridge、Client view、Pane 注册与安装生命周期属于 DSH 插件项目，因此本 change 归 `agent/harness-plugins`；Ordo 仍是唯一 scheduler。DSH Subagent Pane 只表示当前会话子代理树。

## What Changes

- 扩展既有 `@yeisme/dsh-ordo-agent-ops` Host projection，并在 `@yeisme/dsh-client-ui-pane-domain` / `@yeisme/dsh-pane-domain` 中交付 Team Pane 注册与安装面。
- 消费 run/DAG、task table、timeline、runtime route、lease/worktree/fence、capacity、approval、verification、evidence 的 snapshot + event。
- mutation 仅接受 owner 已发布的 preview/approve/reconcile；launch/cancel/redispatch/lease.release 未开放时始终 `not_available`。
- 与 Subagent 的 typed deep-link 与命名冻结。
- 交叉引用 `agent-composition-preview-v1` 与既有 Ordo Agent Ops。

## Capabilities

### New Capabilities

- `dsh-ordo-agent-team-pane`：Harness Plugins 拥有的 DSH Team Pane 适配与交互面，消费 Ordo canonical scheduler 投影。

### Modified Capabilities

无。不改 scheduler 语义。

## Impact

- 实施 owner：`agent/harness-plugins`。
- Canonical scheduler owner：`agent/ordo`。
- Adapter：扩展既有 `@yeisme/dsh-ordo-agent-ops`，不新建第二 Ordo 包或 scheduler。
- 插件包：`packages/bundle/ordo-agent-ops/`、`packages/client/ui-pane-domain/`、`packages/bundle/pane-domain/`。
- 根 handoff：任务 5.1–5.2。
