# Workflow Compensation Reverse-DAG Planner 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.4e3` 已实现纯 deterministic compensation planner：

- planner 只选择已成功且存在显式 binding 的 source step；未绑定 step 不产生隐式补偿；
- 原 DAG 的 `A -> B` 转换为 compensation(A) 依赖 compensation(B)，使用排序后的 Kahn traversal 生成稳定序列；
- plan 固定 definition ref/version/checksum、operation registry digest、每项 operation schema digest 与独立 policy refs；
- plan digest 覆盖完整 canonical payload；即使攻击者重算 digest，unsafe operation、policy drift、self/forward/duplicate dependency、schema/input drift仍会被拒绝；
- pending root 才进入 ready，dependency 未成功时等待，reconciling 阻止新 ready，failed 或 authority revoked 收敛为 `needs_intervention`；
- 原 mutation 的成功事实不被 compensation failure 改写。

## 2. 验证

```bash
task workflow:compensation-domain:test
task test:workflow-compensation-domain:component
```

Component evidence：

```text
temp/integration-test-runs/20260720192034-b182ca61-3593-4cf1-ad64-591d928387af/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 3. 未完成边界

- planner 只产生和评估 typed plan；持久化、claim、attempt、receipt、reconcile 与 state/event/outbox 原子事务属于后续 service/repository/scheduler。
- 当前没有宣称 compensation API 或 worker runtime 已上线。
