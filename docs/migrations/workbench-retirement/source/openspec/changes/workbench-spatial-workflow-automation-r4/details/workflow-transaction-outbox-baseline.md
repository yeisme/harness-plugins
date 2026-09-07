# Workflow transaction/outbox baseline

## 结论

R4 `4.2` 已提供 pre-1.0 alpha 的 typed transition repository 与 durable workflow outbox。WorkflowService 负责 domain transition，repository 只验证 before/after CAS 与 active fence，并将 state、safe event、pending outbox 原子提交。Publisher failure 不会重新执行业务 mutation。

## 持久化

- `0017_workflow_outbox_lease_foundation` 以 additive migration 增加 lease owner、token digest、expiry、safe error 与 `idx_workflow_outbox_claim`。
- `0004_workflow_runtime_foundation` 使用 frozen outbox model，历史 checkpoint 不泄漏 0017 列。
- migration 对 GORM 的跨表同名 index `IF NOT EXISTS` 行为增加 table-owned sentinel 验证；错误 index 不得获得 ledger。
- rollback 仅回退 binary 并保留 nullable/defaulted 列与 index，不执行 destructive down。

## Transaction

- typed transition 不接受 arbitrary map/bytes；safe refs 拒绝 URL、private path 与 token-shaped value。
- run row lock 串行 source-local event sequence；run/step 使用 expected version CAS。
- leased/running step write 在事务内验证 lease ref、worker、fence epoch、lease version、run/step version、expiry 与 release state。
- state、event、outbox 任一写失败均整体 rollback；同 event ref 同内容 replay 幂等，不重复 state/event/outbox。

## Publisher 与 cursor

- claim 使用数据库时间、bounded lease 与 token digest，并在 PostgreSQL 使用 `FOR UPDATE SKIP LOCKED`。
- claim在写`publishing`前读取同run durable cursor，只允许`candidate.sequence = cursor.sequence + 1`，防止并发publisher在前序未ack时先publish后续event。
- sink failure 只保存 `publish_unavailable` 等稳定 reason，并以 DB-time 延后 availability。
- ack 仅推进 `tenant + run + outbox_publish` 的连续 sequence；gap fail closed，重复 ack 幂等，stale token 被拒绝。
- crash/publish-success-before-ack 允许重复 delivery，但业务 mutation 已提交且不会重放。
- `5.2b3` 已增加真实outbox role engine、durable status/lag probe与双publisher顺序矩阵，见`workflow-outbox-publisher-role-baseline.md`。

## 验证

- `task workflow:transaction-outbox:test`：focused + race 10轮，exit 0。
- 当前 diff 真实 PostgreSQL outbox race 3轮：exit 0；此前相同 production code race 5轮亦通过。
- PostgreSQL 14 transaction/outage/recovery/concurrent transition/cancel/pool cleanup evidence：`temp/integration-test-runs/20260728084736-b98ffaa7-c5c0-4414-8ff8-2ad73c27077a/`。
- 证据目录/文件为 `0700`/`0600`，redaction gate 通过，无 DSN、credential、provider payload 或 raw SQL 参数。
