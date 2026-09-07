# Workflow Role Factory Selection Gate 基线

## 1. 结论

R4 `5.2b0b` 尚未完成四类production engine factory，但`workbench-worker`已增加明确的早期factory-selection gate：

- scheduler-only selection继续启用现有真实scheduler builder；
- executor、outbox、reconcile或任何mixed selection在production command入口立即返回`selected worker role engine is unavailable`；
- 失败发生在registry snapshot读取、PostgreSQL连接、admin listen、worker registration与claim之前。

该基线只证明未实现角色不会沿用静态probe或晚失败路径，不证明后三类factory、四role组合根或真实恢复矩阵完成。

## 2. 边界

`configureRuntimeEngineFactories`仅拥有当前production command的角色选择：

```text
selected roles
  -> factory selection gate
  -> frozen runtime inputs
  -> managed PostgreSQL bootstrap
  -> supervisor start
  -> listen/register
```

任何未接线role在第一道gate停止。它不会创建测试engine、no-op sink、fixture repository或静态success probe，也不会把scheduler builder复用于其他role。

## 3. 验证

测试覆盖：

- scheduler-only成功选择builder；
- executor/outbox/reconcile分别早期拒绝；
- scheduler+executor mixed selection早期拒绝；
- 即使runtime snapshot为空且DB URL不可达，executor仍先返回role unavailable，证明没有进入snapshot/DB路径；
- worker command、bootstrap、runtime与supervisor的普通测试和race测试无回归。

```bash
CGO_ENABLED=0 go test ./service/cmd/workbench-worker ./service/internal/workers/bootstrap ./service/internal/workers/runtime ./service/internal/workers/engines -count=1
CGO_ENABLED=1 go test -race ./service/cmd/workbench-worker ./service/internal/workers/bootstrap ./service/internal/workers/runtime ./service/internal/workers/engines -count=1
task worker:managed-bootstrap:test
task test:worker-managed-bootstrap:component
```

Component evidence：`temp/integration-test-runs/20260729081405-1eea6910-4f56-4ade-b161-3f4bf324ed78/summary.json`，状态`passed`、exit `0`、redaction passed。

## 4. 剩余阻塞

关闭`5.2b0b`仍需要：

- executor factory：真实lease execution source、typed Framework services、Task/Gate/event/owner adapters与durable completion handoff；
- outbox factory：真实GORM-backed publish/status cursor与外部sink；
- reconcile factory：真实GORM-backed queue/status与Task/Owner lookup；
- 四role selected/unselected、startup rollback、readiness recovery、drain/stop、restart与零goroutine system evidence；
- R0 immutable candidate registry、R1 service identity/delegation与后续claim authority joint evidence。

## 5. 兼容与回滚

该改动为内部pre-1.0 Go runtime的fail-closed强化，不修改CLI flag、JSON schema、RPC或数据库合同。回滚会恢复“未实现role在snapshot/DB阶段才失败”的较弱行为，因此只有在对应真实factory已接线并拥有等价或更早的安全gate后才应移除。
