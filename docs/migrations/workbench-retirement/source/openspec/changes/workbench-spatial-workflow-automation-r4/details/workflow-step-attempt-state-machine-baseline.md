# Workflow Step / Attempt State Machine 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.4d` 已实现 Step 与 Attempt deterministic transition machine：

- Step 覆盖 pending/ready/leased/running/waiting_approval/waiting_owner/reconciling/paused/terminal 全矩阵；
- ready claim 写入 lease ref/fence epoch并增加 attempt count；安全释放只允许 dispatch intent 前，释放后清除 active lease/fence；
- leased/running transition 强制匹配 lease ref、fence epoch、run version 与 step expected version；
- canonical descriptor 逐字段验证，调用方不能伪造 receipt/retry/authority policy；
- 只有 approval step 可进入 waiting_approval，只有批准的外部型 step 可进入 waiting_owner；
- success 强制 output schema validation，并按 descriptor 要求 gate、receipt、external completion、reconcile evidence；
- Attempt 覆盖 pending/accepted/rejected/retryable_rejected/unknown_accept/reconciling/terminal，stale fence/version拒绝；
- terminal state不可逆，same-state replay不推进version。

## 2. 验证

```bash
task workflow:domain-step:test
task test:workflow-domain-step:component
```

Component evidence：

```text
temp/integration-test-runs/20260720185051-e1a7e5ca-b3f2-4936-ba1e-0be050b350ca/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

当前 dispatch-intent guard 回归（2026-08-02 07:05）：`StepLeased -> StepRunning` 对有副作用 descriptor 在缺少 durable dispatch intent 时 fail-closed 为 `reconcile_required`，并保留纯读步骤的合法路径；新增 `AttemptStatusDispatching` 常量后执行 `task test:workflow-domain-step:component`，证据为 `temp/integration-test-runs/20260802070536-1fec7caa-59ba-4ccf-81e2-eafc01047d10/`，`status=passed`、`duration_ms=5886`、`redaction.total_redactions=0`。该证据只覆盖 domain/race/vet，不替代真实 worker、Owner receipt/reconcile、PostgreSQL 或 production gate。

## 3. 未完成边界

- `1.4e1/e2/e3` retry、cancel、compensation policy 尚待完成；状态机不会自行猜测 retry 或 rollback。
- repository/service 仍需把 lease/fence/version、state/event/outbox 放进同一 CAS transaction。
- gate/receipt/evidence 的真实性由 R1/R2 service adapter 验证，domain 只消费 typed verified facts。
