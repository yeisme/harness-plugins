# Daily Operations R3 Rollback Runbook

## Scope

独立 kill switch 与 rollback 步骤覆盖 R3 的 4 个 capability：
`desktop_v3`、`asset_catalog`、`workitems`、`daily_ops`（Inbox/Approval/Activity/Delivery）。

每个 capability 有独立 feature flag，可单独回退而不影响其他 R3 capability 或 R0/R1/R2 已 promoted 合同。

## Feature Flags

| Flag | Capability | Default | 回退效果 |
| --- | --- | --- | --- |
| `WORKBENCH_DESKTOP_V3_ENABLED` | desktop v3 host（2.1c AppShell + pane lifecycle） | `false`（local）/ `true`（managed after canary） | 回退到 legacy monolithic shell（shell.tsx 未删除） |
| `WORKBENCH_ASSET_CATALOG_ENABLED` | Asset repository + search + projection worker | `false` | asset/search 读返回 unavailable；projection worker 不消费事件 |
| `WORKBENCH_WORKITEMS_ENABLED` | WorkItem service + repository | `false` | workitem mutation/read 返回 unavailable（registry ModeUnavailable） |
| `WORKBENCH_DAILY_OPS_ENABLED` | Inbox/Approval/Activity/Delivery projection + commands | `false` | daily projection repos 保留（tombstone）；commands/dispatch 返回 unavailable |

## Rollback 步骤（dry-run / staging / production）

### 1. 单 capability 回退

```bash
# 例：回退 daily_ops（Inbox/Approval/Activity/Delivery），保留 asset/workitem/desktop
export WORKBENCH_DAILY_OPS_ENABLED=false
# restart workbenchd（managed）或 local runtime
```

回退后：
- `workbench.daily.inbox/approval/activity/delivery.*` 操作回到 `ModeUnavailable`（fail-closed）。
- 已持久化的 daily projection（`daily_projection` data class）保留为 tombstone，不删除（additive data）。
- 其他 capability 不受影响。

### 2. 全 R3 回退

```bash
export WORKBENCH_DESKTOP_V3_ENABLED=false
export WORKBENCH_ASSET_CATALOG_ENABLED=false
export WORKBENCH_WORKITEMS_ENABLED=false
export WORKBENCH_DAILY_OPS_ENABLED=false
# restart runtime
```

回退后：
- 所有 daily 操作 fail-closed。
- legacy shell 恢复（shell.tsx 保留，AppShell 是 additive host）。
- Task/Open Design/Owner/Layout 已 promoted 合同不受影响。
- additive schema（asset_entry_projection / asset_search_index / workitem_metadata / daily_projection）保留，不回滚 migration（additive，向后兼容）。

### 3. Dry-run 验证

```bash
task release:rollback:dry-run ENV=staging
# 验证：各 flag 设 false 后，registry snapshot 中 daily ops 全 ModeUnavailable；
#       Task/Open Design operation 仍可用；无 panic / schema 不兼容。
```

## 不变量（rollback 不可违反）

- **不回到跨租户 localStorage / fixture owner**：legacy shell 的 localStorage layout 仍由 3.3b shadow import 转 canonical（backend service 权威），rollback 不恢复 localStorage 作为 canonical。
- **additive data 不回滚 migration**：`daily_projection` / `asset_search_index` / `workitem_metadata` 等 schema 是 additive（新表/新列），rollback 只关 flag，不 DROP TABLE。
- **R4 handoff**：rollback 后 R4 获得的 approved Asset/WorkItem refs 仍有效（Workbench-owned metadata 保留）；R4 不因 rollback 失去已 promoted 的 safe refs。

## R4 Handoff

R4 获得的稳定 refs（rollback 不失效）：
- `asset_entry_projection`（AssetEntry safe metadata + tombstone）
- `workitem_metadata`（WorkItem state/version/acceptance/links）
- `daily_projection`（Inbox/Approval/Activity/Delivery projection cursor）

R4 消费这些 refs 时：
- 读 Workbench-owned metadata（不直连 owner canonical）。
- 通过 Task control plane 的 `workbench.daily.*` 操作（rollback 时 fail-closed，R4 须等 re-promote）。

## 监控信号（rollback 触发条件）

- projection worker lag > 2x budget 持续 5min（7.2 readiness unready）→ 考虑回退对应 capability。
- daily ops reconcile rescue 持续增长（unknown_accept 不收敛）→ 考虑回退 daily_ops。
- search index rebuild 失败（generation stale）→ 考虑回退 asset_catalog。
