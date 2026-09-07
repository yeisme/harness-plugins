# Workflow outbox publisher role 基线

## 结论

R4 `5.2b3` 已将已有 durable workflow outbox claim/publish/ack/retry 原语提升为真实 `outbox` role engine。该实现只读取 transaction提交后的 workflow outbox row，使用数据库 cursor维持 source-local sequence，提供 bounded batch、outage backoff、backlog/lag readiness、drain与restart语义；未复用 Board outbox，也没有引入内存 canonical channel。

## Publisher result 与 role loop

- `Publisher.PublishOne` 返回 typed `PublishResult`：是否找到row、是否publish并ack、是否因sink failure写回retry，以及ack后的durable cursor。
- 兼容入口 `PublishOnce` 保留原布尔行为；sink error仍只持久化稳定`publish_unavailable`，不泄露provider错误。
- `Engine` 实现`workerengines.Engine`，role固定为`outbox`；单个engine同一时间只执行一个 claim/publish/ack链。
- 每轮最多发布`MaxBatch <= 1024`条；empty queue回到poll interval，store/sink失败使用bounded exponential backoff，不创建并行 retry storm。
- startup初始cycle使用caller context，timeout则回滚为stopped；Drain先撤role readiness、取消loop并等待当前publish调用返回，Stop幂等。

## Durable status 与 readiness

`GORMStore.WorkflowOutboxStatus`每轮读取：

- DB current time；
- 当前可claim的pending或expired-publishing数量；
- 最老 available row的DB-time lag；
- workflow storage中最近更新的`outbox_publish` cursor sequence与更新时间。

role probe只有在running、最近一次status成功且未过freshness、backlog不超过`MaxBacklog`、lag不超过`MaxLag`、publish/store无当前故障时ready。`EngineSnapshot`只记录backlog、lag、cursor sequence、published/retried聚合、连续失败与backoff，不记录tenant/run/event/outbox refs。

## Source-local ordering

原始 repository 已在ack时拒绝sequence gap，但两个`FOR UPDATE SKIP LOCKED` publisher可能在sequence 1 publish尚未ack时claim同run sequence 2，导致sink先看到乱序事件。当前 claim transaction在写`publishing`前读取该 run的durable cursor，并只允许`candidate.sequence == cursor.sequence + 1`：

- sequence 1被其他worker持有且未ack时，sequence 2不claim、不publish；
- sequence 1 ack后cursor推进，下一轮才允许sequence 2；
- expired sequence 1优先reclaim，允许at-least-once duplicate，但不越过到后续sequence；
- ack仍保留gap检查与stale token fencing作为第二层防线。

## PostgreSQL 证据

真实 PostgreSQL component矩阵覆盖：

1. 两个publisher engine并发运行，第一个sink publish被barrier阻塞时，第二个engine不得publish sequence 2；
2. 释放barrier并ack sequence 1后，sink严格观察`1,2`，durable cursor最终为sequence/version `2/2`；
3. sink outage写稳定retry并恢复，cursor连续推进；
4. publish-success/ack-loss允许同event重复delivery，但workflow业务run version/state不重放；
5. concurrent workflow transition保持一个winner，event/outbox各一条；
6. cancel、pool cleanup、role drain、backlog/lag和probe recovery通过。

## 验证与 evidence

- `task test:workflow-component SCENARIO=worker-outbox-publisher WORKBENCH_TEST_POSTGRES_URL=...`
- Component evidence：`temp/integration-test-runs/20260728114751-34739313-bb33-40e1-beff-34d259d39dda/`
- Evidence `status=passed`、`exit_code=0`、redaction enabled、`total_redactions=0`，command/env/log均不含DSN或ref列表。
- PostgreSQL场景普通模式连续5轮、race模式连续3轮；outbox engine unit race连续20轮，`go vet`通过。

## 后续边界

- `5.2b0b` 负责把该role factory接回production worker组合根；当前engine已可被supervisor管理，但未提前改变selected-role bootstrap。
- Board event publisher继续由Board子系统拥有；不得用本workflow cursor替代Board revision/cursor合同。
- transport catch-up/live watch、retention与subscriber dedupe属于后续 transport/observation任务；本任务只保证workflow outbox source顺序和at-least-once publish。
