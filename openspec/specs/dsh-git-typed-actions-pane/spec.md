# dsh-git-typed-actions-pane Specification

## Purpose
TBD - created by archiving change dsh-file-git-panes-v1. Update Purpose after archive.
## Requirements
### Requirement: Git Manager SHALL 只接受 typed owner actions
Git Pane SHALL 探测 `GitTypedActionsCapabilityV1`。允许的动作 SHALL 仅限 owner 发布的 `status`、`diff`、`stage`、`unstage`、`commit`、`worktree.create`、`worktree.remove`。任意 argv、shell 字符串或未知 action id SHALL 返回 `not_available`。缺失 capability 时 Pane SHALL 显示 `contract_mismatch` 并禁用 mutation。

#### Scenario: 拒绝任意 argv
- **WHEN** 客户端提交 `git` 加自由参数
- **THEN** Host SHALL fail closed
- **AND** 仓库状态 SHALL 保持不变

### Requirement: 危险 Git 动作 SHALL 带 preview、approval 与 receipt
`commit`、`worktree.create`、`worktree.remove` SHALL 要求 owner preview digest、expected revision、idempotency key 与 receipt。timeout MUST NOT 被解释为成功。

#### Scenario: commit 超时
- **WHEN** commit action 超时或断线
- **THEN** Pane SHALL 保持 `unknown` 或 `reconcile_required`
- **AND** SHALL NOT 本地标记已提交

### Requirement: worktree 操作 MUST NOT 释放 Ordo lease
Git worktree 删除或移动 SHALL 只调用 Git owner。客户端 MUST NOT 调用 `lease.release` 或修改 Ordo scheduler 状态。Ordo lease 仍由 Ordo 投影。

#### Scenario: 删除 worktree
- **WHEN** 用户请求 `worktree.remove`
- **THEN** Git owner MAY 删除自己的 worktree 记录
- **AND** Ordo lease ledger SHALL 保持不变

