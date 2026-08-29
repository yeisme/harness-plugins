## Why

现有 Git Pane 已能读取 porcelain 状态、展示树形分组和基础 diff，但仍缺少 Agent 变更审查所需的 revision 证据、反馈闭环、安全 mutation、跨 worktree 队列和大规模窗口化合同。现在需要在不复制 Git/Ordo canonical state、不中断 V1 consumer 的前提下，把同一个 Pane 演进为可渐进启用的 Agent Review Git Workspace。

## What Changes

- 将产品准入冻结为 `split-owner`：Git owner 管仓库投影与副作用；Ordo 管任务、Agent、lease、reviewed、feedback、verification、override evidence；Harness Plugins 只组合 safe projection、presentation state 与 typed intent。
- 在同一 Git Pane 增加 `审查队列 / 更改 / 历史 / 分支 / Worktree / 更多`，按 capability 决定默认视图和可用动作；缺少新能力时继续使用现有 Changes V1。
- 新增分页 status、diff、history、compare、mutation、stash/tag 与 Ordo review evidence capability，全部使用 opaque ref、snapshot + subscribe + cursor、freshness 与 receipt reconcile。
- 完成 Changes 审查闭环：低信号分组、hunk reviewed、revision drift、feedback、批量 stage/unstage、owner backup + Undo、commit preflight、secret-risk 和 Agent worktree readiness gate。
- 增加 capability-gated Review Queue、Worktree、History/Graph/Compare、Branch/Remote/Stash/Tag 视图；未实现 owner seam 时显示明确 unavailable，不新增 Git Beta 入口。
- 建立 10,000 changed files、1,000,000 commits、2,000 queue/worktree 项的窗口化和虚拟化验收，并为集成、组件、系统和浏览器运行生成脱敏证据。
- 不包含 breaking change；所有公共合同只做 additive 扩展。

## Capabilities

### New Capabilities

- `dsh-git-agent-review-workbench`: Git/Ordo owner 边界、additive capability、审查闭环、多视图、渐进降级、安全动作、性能、无障碍与证据要求。

### Modified Capabilities

无。现有 V1/V2 capability 与 consumer 保持原语义；新行为通过独立 capability detection 接入。

## Impact

- Host 合同：`packages/host/dsh-git-host` 新增窗口化 projection、mutation V2、history/compare/stash/tag companion 与兼容 probe。
- Client 模型：`packages/client/ui-pane-workbench/src/git/**` 新增 review evidence、readiness、window、queue、history 和 safe action helpers。
- Desktop UI：`packages/client/ui-desktop-workbench/src/client/git-pane.tsx` 继续演进为 capability-gated 单 Pane 多视图，并保留旧 host props fallback。
- Ordo：canonical owner 不迁入本仓；本仓只定义并消费 `GitReviewEvidenceCapabilityV1` safe projection，真实 owner 实现由 `agent/ordo` 独立交付。
- 测试与证据：聚焦 Vitest、TypeScript 检查和项目脚本生成的 `temp/integration-test-runs/<run-id>/`。
- 依赖：复用 React、现有 visual-kit 和当前测试栈，不新增 UI/runtime 依赖。
