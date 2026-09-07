# Workbench Worker W0 实施基线

## 1. 当前完成范围

截至 2026-07-20，R4 已完成：

- `5.0a` managed-only worker config与validator；
- `5.0b1` 独立pure-Go `service/cmd/workbench-worker` skeleton；
- loopback `/healthz` 与 `/readyz`，明确区分process health和claim readiness；
- claim-disabled稳定reason，未创建scheduler、lease、executor或Owner dispatch；
- SIGTERM/SIGINT context、幂等drain和bounded shutdown；
- JSON lifecycle logs写stderr，stdout保持空；
- `task worker:w0:test`、`task worker:w0:smoke` 与component evidence。

当前实现故意不进入 `scripts/production-build.ts` 的`GO_ARTIFACTS`，因此R5 reproducible build仍报告`bin/workbench-worker`缺失。W0 skeleton不得解释为production candidate。

## 2. 配置合同

Config fail-closed验证：

- profile必须`managed`，不回退SQLite；
- worker id和service identity必须是opaque safe ref；
- database URL必须是PostgreSQL URL，但错误不回显URL或credential；
- admin listener在W0仅允许loopback；
- workflow contract min/max必须是safe version；
- roles只允许scheduler/executor/outbox/reconcile且不得重复；
- claim/lease/heartbeat/drain duration、concurrency和queue scan均有硬边界；
- malformed环境变量不静默回退安全默认值，而是使validation失败。

## 3. Runtime语义

| Endpoint/事件 | 当前结果 | 语义 |
| --- | --- | --- |
| `GET /healthz` | HTTP 200, `healthy`, `ready=false` | 只证明进程与admin listener存活 |
| `GET /readyz` | HTTP 503, `reason=claim_disabled` | 明确禁止claim，不伪造dependency ready |
| SIGTERM/SIGINT | `draining=true`后bounded shutdown | 当前无workflow state，因此不写terminal state |
| 非GET admin请求 | HTTP 405 | admin surface只读 |

Worker启动日志只包含service/event/status、实际loopback admin address和safe contract range，不包含worker credential、DSN、Owner endpoint或private path。

## 4. 验证证据

通过：

```bash
task worker:w0:test
task worker:w0:smoke
CGO_ENABLED=1 go test -race ./service/internal/workers/config ./service/internal/workers/runtime ./service/cmd/workbench-worker -count=1
CGO_ENABLED=0 go build ./service/cmd/workbench-worker
CGO_ENABLED=0 go vet ./service/internal/workers/config ./service/internal/workers/runtime ./service/cmd/workbench-worker
bun test tests/production-build.test.ts
```

最新component evidence：

```text
temp/integration-test-runs/20260720174033-ca63f8f6-e4d6-494e-8bc7-f4664329b992/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 5. 未完成边界

`5.0b2`仍需真实实现和证据：

- PostgreSQL连接、DB time与migration checksum/range检查；
- operation/step registry digest compatibility；
- R1 service identity/delegation检查；
- worker instance registration、heartbeat、draining与shutdown receipt；
- queue/outbox/reconcile cursor readiness；
- 单Owner outage的per-capability degraded状态。

在`4.3a-4.3c` lease/fencing、`5.0b2` startup dependencies、`5.1-7.4` execution/reconcile/canary和`10.5` closeout完成前，R5 `3.4b2b`必须保持blocked。
