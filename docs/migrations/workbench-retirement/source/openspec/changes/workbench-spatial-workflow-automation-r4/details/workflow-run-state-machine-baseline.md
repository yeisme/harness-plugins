# Workflow Run State Machine 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.4c` 已实现集中式 Run deterministic transition machine：

- `NewRun` 只接受 checksum-valid published definition，并固定 definition version/checksum 与 step registry digest；
- 覆盖 pending/running/waiting/paused/cancelling/reconciling/succeeded/failed/cancelled/needs_intervention 全状态；
- 每次变更要求 expected version，成功后单调 `+1`，stale/overflow拒绝；
- terminal state 不可逆；same-state 作为 service 可判 replay 的 no-change，不增加version；
- pending start 与 paused resume 需要上层已完成 dependency/authority/budget validation 的 typed fact；
- success 需要 all steps terminal + successful；
- cancelled 需要 cancellation settled，且 external truth 不得 unknown；
- unknown/maybe-sent external truth 只能进入 reconciling；离开 reconciling 必须携带 safe evidence ref；
- exhaustive state×target matrix、truth guards、race 与 vet 已通过。

## 2. 验证

```bash
task workflow:domain-run:test
task test:workflow-domain-run:component
```

Component evidence：

```text
temp/integration-test-runs/20260720184634-ba9a0cd7-987f-4d40-901a-9791140f5350/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 3. 未完成边界

- `1.4d` 尚需把 Step/Attempt transition 与 lease/fence/receipt/gate/reconcile facts 绑定。
- service/repository 尚未原子持久化 transition + event + outbox；domain result 不是 durable commit 证明。
- start command 的 authorization/idempotency/pinned version 已由 `5.3` 完成；pause/resume/cancel/operator command 仍属于 `7.x`。
