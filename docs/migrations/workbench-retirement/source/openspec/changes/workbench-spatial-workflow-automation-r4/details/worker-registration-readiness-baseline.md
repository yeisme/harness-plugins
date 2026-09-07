# Worker Registration 与 Readiness Core 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `5.0b2a`已实现：

- worker instance register、heartbeat、draining和shutdown lifecycle；
- worker version CAS与stale update拒绝；
- worker ref禁止复用或active upsert覆盖；
- release/source/artifact/step-registry/roles digest与contract range校验；
- started、heartbeat、shutdown timestamp全部使用DB time；
- shutdown receipt持久化status、timestamp与typed reason；
- required/optional dependency deterministic readiness aggregation；
- required failure全局not-ready，optional Owner failure仅degraded；
- diagnostics只允许safe component/reason/version，不承载endpoint、DSN、credential或raw error；
- SQLite多连接并发注册压力确保只有一个instance row。

当前未把这些能力接入`workbench-worker`生产启动和heartbeat loop；该工作属于`5.0b2b`，依赖真实PostgreSQL、R0 registry与R1 service identity。

## 2. Registration lifecycle

```text
register
  active, draining=false, version=1
  started_at_db = heartbeat_at_db = DB time

heartbeat(expected version)
  active/draining only
  heartbeat_at_db = DB time
  version + 1

mark draining(expected version)
  active -> draining
  draining=true
  version + 1

shutdown(expected version, typed reason)
  active/draining -> stopped
  draining=true
  shutdown_at_db + shutdown_reason
  version + 1
```

Stopped worker不能heartbeat或重新注册相同ref。Repository不接收worker wall clock。

## 3. Readiness evaluator

Input只包含：

```text
component
required
ready
reason
version
```

规则：

- 空列表、重复component、unsafe reason/version均`invalid_dependency_status`且fail-closed；
- 任一required dependency失败时`ready=false`并返回稳定safe reason；
- optional dependency失败时`ready=true, degraded=true`；
- component按名称排序，保证输出deterministic；
- evaluator不接收或输出URL、path、credential、provider payload或raw error。

## 4. 验证

```bash
task worker:registration:test
task test:worker-registration:component
CGO_ENABLED=0 go test -p 1 ./service/cmd/... ./service/internal/... -count=1
openspec validate workbench-spatial-workflow-automation-r4 --strict
```

Component evidence：

```text
temp/integration-test-runs/20260720172439-9bcc8965-e141-4c25-b49f-a995e2584629/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 5. 未完成边界

`5.0b2b`仍需：

- production command使用managed PostgreSQL external migration；
- startup调用`CheckReady`和`DatabaseTime`；
- R0 operation/step registry digest检查；
- R1 service identity/delegation检查；
- runtime registration、heartbeat ticker、drain和shutdown receipt接线；
- queue/outbox/reconcile cursor readiness；
- dependency恢复后的safe readiness refresh；
- real PostgreSQL restart/connection-loss/goroutine cleanup evidence。

在`5.0b2b`完成前，worker `/readyz`继续返回`claim_disabled`，R5不得把binary计入production candidate。
