# Workflow Retry / Cancel Policy 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.4e1` 与 `1.4e2` 已实现纯 deterministic policy evaluator：

- retry 直接消费 canonical descriptor，拒绝伪造 retry class；
- `bounded_read` 只对批准 transient read 在 attempt 上限内创建新 attempt；
- `cursor_reconnect` 使用同一 durable cursor 且受 reconnect 上限约束；
- `pre_send_or_rejected` 只在无 dispatch intent、明确 verified not-sent 或 Owner explicit rejected 时重试；
- `unknown_accept`、after-send timeout、receipt pending 一律 reconcile，永不自动 redispatch；
- contract/schema/authority/quota hard failure 不retry；
- mutation 新 attempt/reconnect/reconcile 均声明 preserve idempotency；
- cancel evaluator 对 pending/ready/paused/approval wait、leased pre-send、running、waiting owner、reconciling、terminal 输出 typed action；
- lease after-dispatch、running unknown、waiting Owner 一律 reconcile，terminal 为 no-change。

## 2. 验证

```bash
task workflow:domain-policy:test
task test:workflow-domain-policy:component
```

Component evidence：

```text
temp/integration-test-runs/20260720185357-7119742e-5952-4661-9f9e-0c990afaac1a/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 3. 后续边界

- `1.2e` 与 `1.4e3` 已分别由 `workflow-compensation-contract-baseline.md` 和 `workflow-compensation-planner-baseline.md` 冻结；service 只能消费这些显式字段，不得发明通用 rollback 或隐式补偿。
- evaluator 只输出 decision；attempt creation、dispatch intent、receipt/reconcile 与 state/event/outbox 原子性属于 service/repository。
- max attempt/reconnect 的实际值由 definition/policy service 校验，domain 只强制 bounded upper limit。
