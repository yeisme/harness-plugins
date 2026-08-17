## Context

本 change 只收敛七个相关 OpenSpec change 的 owner、profile composition 和验收证据，不吸收子 change 的实现。当前 workspace 已存在统一 Ordo bundle、Pane protocol/client foundation 和 composition preview projection，但 profile clean-install 仍受跨项目 DSH peer/artifact 兼容性约束。

## Decisions

### 1. One profile composition, multiple canonical owners

最终 profile 可以同时装载 Ordo Agent Ops、独立 composition preview 和 Pane Workbench，但每个能力保持独立 package row 和 owner。统一 Ordo package 只能消费 composition preview 的 safe envelope，不复制 composition facts。

### 2. Official CLI extension

开发者 manifest 命令进入官方 DSH CLI 的 `plugin manifest` namespace：

    dsh plugin manifest init --path <package-dir>
    dsh plugin manifest validate --path <package-dir>
    dsh plugin manifest pack --path <package-dir> --out-dir <directory>

既有 profile 管理命令保持不变：

    dsh plugin --profile web add <package>
    dsh plugin --profile web remove <package>

CLI 输出由同一 projection 渲染为人类摘要、`--agent` key/value 和 `--json` envelope；stdout 只保留对应模式，诊断写入 stderr。

### 3. Cross-project UI owner

composition preview picker 继续由 `client/deepseek-harness/packages/client/ui-agent-preset/` 实现。Harness Plugins 只提供 `agentCompositionPreview` projection、safe contract 和 handoff evidence。

### 4. Candidate before release

默认验收使用 local packed artifacts 和 disposable profile。发布到 registry、push 或 production profile 需要 root/user 的单独授权，不由 child 执行。

## Capability ledger and execution leases

| Capability | Canonical owner | This change handoff | Current gate |
| --- | --- | --- | --- |
| 官方 plugin manifest CLI | DSH core `apps/cli` | Harness Plugins 提供 manifest contract 与 package conformance | local CLI tests 已通过；release 仍需 owner 决策 |
| composition preview projection | Harness Plugins `packages/preset/agent-composition-preview` | DSH core/client 通过 typed client bridge 消费 | DSH peer build/API assembly 尚未对齐 |
| composition picker UI | DSH client `packages/client/ui-agent-preset` | 只消费 host projection，不复制 maturity/drift 事实 | bridge 未公开，保持 external owner blocker |
| Pane protocol/workbench | Harness Plugins `packages/host/pane-protocol` 与 `packages/client/ui-pane-workbench` | DSH `shell.overlay` 官方 slot | local registry/lifecycle 已有 focused evidence；bundle/profile 尚未验收 |
| Ordo Agent Ops | Harness Plugins `packages/bundle/ordo-agent-ops` | 旧 leaf package 仅保留兼容 shim | unified package focused evidence 已通过；owner action/event seam 仍外部阻塞 |

执行 lease 固定为：Pane writer 只写 Pane package 与对应 OpenSpec task；Ordo writer 只写 unified bundle、兼容 shim 测试和 Ordo task；DSH writer 只写官方 CLI 与 DSH client owner。三条 lease 不交叉写 canonical state、root lockfile、生产 profile 或发布状态。所有验证完成后由 root 检查 diff、重新运行 strict validation 并决定是否能勾选任务；未达到 acceptance 的部分保留 unchecked 并记录 blocker。

## Failure Registry

| Failure | Required response |
| --- | --- |
| profile 出现重复 Ordo/Panes row | fail conformance，检查 patch ownership 和 disposer，不按加载顺序忽略 |
| composition package 缺失或 schema mismatch | Ordo 降级为 `unavailable`/`needs_contract`，不得本地推导事实 |
| DSH peer 不支持 projection read seam | 标记 external owner blocker，使用 local artifact 验证，不改私有 core |
| browser 出现 token、URL、host path 或 arbitrary module | security gate fail，阻止集成 |
| CLI 输出混入日志或字段被删除/重命名 | evolutionary contract gate fail，保留旧命令并补 migration/compatibility test |
