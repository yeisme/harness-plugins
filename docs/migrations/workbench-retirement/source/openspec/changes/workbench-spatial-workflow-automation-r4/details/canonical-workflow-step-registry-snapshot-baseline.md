# Canonical Workflow Step Registry Snapshot 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.2d1` 已实现 canonical typed step registry snapshot 基线：

- contract version 固定为 `workbench.workflow_step_registry.v1`；
- snapshot 完整包含八类 canonical step，顺序与 TypeScript `workflowStepTypes` 一致；
- 每个 descriptor 包含 input/output schema ref、side-effect、authority action、retry、idempotency、timeout upper bound、cost、receipt/reconcile 与 adapter contract range；
- digest 对 `contractVersion + steps` 的 canonical JSON 执行 SHA-256，结果为 `sha256:<hex>`；
- `CheckReady` 重新验证完整 descriptor 与 digest，拒绝篡改、空字段、重复、缺失、乱序和旧 step id；
- `CheckCompatibility` 对 contract ahead/behind 与 digest mismatch fail-closed；
- snapshot 实现 worker dependency checker 所需 `CheckReady` 与 `Digest`，managed bootstrap 已用真实 snapshot 验证 readiness；
- `workbench-workflow-contract` CLI 是 snapshot structured asset 的唯一生成/校验入口，支持原子写文件与 strict unknown-field rejection；
- TypeScript SDK 不再接受 partial 或 reordered registry，Go CLI 生成结果须通过 SDK normalization。

实现位置：

```text
service/internal/workers/registry/snapshot.go
service/internal/workers/registry/snapshot_test.go
service/cmd/workbench-workflow-contract/main.go
service/cmd/workbench-workflow-contract/main_test.go
service/internal/workers/bootstrap/bootstrap_test.go
packages/task-sdk/src/workflow-models.ts
packages/task-sdk/test/workflow-models.test.ts
tests/workflow-step-registry-contract.test.ts
Taskfile.yml
```

当前 canonical digest：

```text
sha256:65ed253ac47625e21a1cfa875f1cc16e6df8c92d895630cc31d3620ac20f8845
```

该值是当前 source-derived 结果，不得复制为环境变量或手写 release state；release artifact 必须调用 CLI 重新生成并绑定 source/artifact digest。

## 2. 使用与验证

生成与校验 snapshot：

```bash
task workflow:step-registry:generate OUTPUT=temp/workflow-step-registry.json
task workflow:step-registry:check SNAPSHOT=temp/workflow-step-registry.json
```

执行 contract 与 component evidence gate：

```bash
task workflow:step-registry:test
task test:workflow-step-registry:component
```

Component evidence：

```text
temp/integration-test-runs/20260720183419-d6d9a7bc-e1ae-46be-971a-becd24c7df8c/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 3. Local conformance recheck（2026-08-02）

执行：

```bash
task test:workflow-step-registry:conformance
```

Evidence：

```text
temp/integration-test-runs/20260802012333-6c9cd545-ffc8-4e67-81bf-4e1852658de2/
status=passed
exit_code=0
duration_ms=58660
redaction.total_redactions=1
```

本轮在同一 canonical snapshot 上复核了当前已经绑定的本地消费点：

- Go canonical/worker readiness 与 SDK contract tests；
- loopback `workbenchd` 的 HTTP、JSON-RPC、gRPC registry digest parity；
- typed SDK 从 `getStepRegistry` 到 definition/run lifecycle 的真实本地调用；
- Web definition pane 的 typed palette、fresh validation 与 registry unavailable fail-closed。

这只证明 local/component conformance 的已绑定边界，不能关闭 `1.2d2`：scheduler claim、worker executor 的生产绑定、managed PostgreSQL/restart、release artifact/source digest 以及 browser/production gate 仍未形成同一真实运行时证据。

最新 local conformance recheck（2026-08-02）：再次执行 `task test:workflow-step-registry:conformance`，证据为 `temp/integration-test-runs/20260802034052-f4393f85-8665-42e5-814b-4ab5c438ceb4/`，`status=passed`、`exit_code=0`、`duration_ms=49733`、`redaction.total_redactions=1`。本次仍确认 Go/SDK canonical snapshot、loopback HTTP/JSON-RPC/gRPC digest parity、workbenchd SDK lifecycle 与 Web typed/fail-closed palette 一致；scheduler claim、worker executor production binding、managed PostgreSQL/restart、release digest 与 browser/production gate 继续未闭环。

## 4. 未完成边界

- `1.2d2` 尚未完成：publish validator、scheduler、worker executor、transport 与 Web designer 还没有全部消费同一 snapshot；因此不能宣称 runtime conformance 完成。
- `5.0b2b2c2` 尚未完成：R0/R5 release manifest CLI 还未把 operation/step/source/artifact digest 原子绑定，当前 worker binary 仍是 claim-disabled skeleton。
- per-step schema ref 已冻结为 typed contract ref，但具体 input/output schema 与 executor validation 随 `1.4`、`5.3`、`6.x` 继续实现；任何 consumer 不得用 raw map 或 browser-local fallback 替代。
- HTTP/gRPC/JSON-RPC registry handler 属于 `1.5`；当前 CLI/SDK parity test 不是后端 API 可用证明。
