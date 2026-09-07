# Worker Managed Lifecycle Wiring 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `5.0b2b1`已实现可注入、可测试的managed lifecycle wiring：

- `DependencyChecker`与registration repository通过runtime option注入；
- admin listener启动后执行dependency evaluate；
- required dependency失败时不注册worker，并保持`ready=false`；
- optional Owner failure允许注册，但状态为degraded；
- 注册成功后按配置heartbeat interval刷新dependency并执行worker heartbeat CAS；
- heartbeat、drain、shutdown通过单一lifecycle mutex串行，防止version互相覆盖；
- drain先设置process draining，再写worker draining状态；
- shutdown取消并等待heartbeat goroutine，再写typed shutdown receipt；
- `/readyz`只输出safe dependency状态、registered/degraded布尔值和稳定reason；
- 无managed option时保持W0 claim-disabled skeleton行为。

该实现仍不创建claim engine，因此即使dependencies ready且registered，`/readyz`仍返回HTTP 503与`claim_disabled`。这避免把lifecycle wiring误当生产worker candidate。

## 2. Runtime状态优先级

`/readyz` reason优先级：

```text
draining
  > required dependency failure
  > registration / heartbeat / drain / shutdown receipt failure
  > claim_disabled
```

Health仍只证明process/admin listener存活。Dependency readiness、degraded和registration分别暴露，不把`health=true`解释为claim-safe。

## 3. Heartbeat与shutdown并发

Heartbeat loop：

1. ticker触发；
2. 获取lifecycle mutex；
3. 重新计算dependency状态；
4. 使用本地最新worker version执行heartbeat CAS；
5. 更新本地registration snapshot；
6. 释放mutex。

Shutdown：

1. 标记draining并串行写draining CAS；
2. cancel heartbeat context；
3. 等待heartbeat goroutine退出或shutdown context到期；
4. 串行写shutdown receipt；
5. 关闭admin HTTP server。

Race测试重复20次验证shutdown后heartbeat计数不再增长，且无数据竞争。

## 4. 验证

```bash
task worker:lifecycle:test
task test:worker-lifecycle:component
task worker:w0:test
task worker:w0:smoke
CGO_ENABLED=0 go test -p 1 ./service/cmd/... ./service/internal/... -count=1
```

Component evidence：

```text
temp/integration-test-runs/20260720174026-24f7018a-ebe2-4b36-b142-5effb7015cff/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 5. 未完成边界

`5.0b2b2`仍需真实接入：

- managed PostgreSQL `SchemaPolicyExternalMigration`；
- `CheckReady`、`DatabaseTime`和schema checksum/range；
- R0 operation/step registry digest；
- R1 service identity/delegation；
- queue/outbox/reconcile cursor checker；
- production release/source/artifact/roles metadata；
- dependency recovery和真实DB connection-loss/restart evidence。

当前runtime tests使用fake checker/store验证生命周期，不替代真实PostgreSQL、registry或Identity evidence。
