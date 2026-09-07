# Workflow Proto 与 JSON Schema 合同实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.2b` 已实现：

- `workbench.workflow.v1alpha1` Workflow Proto contract；
- `workbench.workflow_step_registry.v1` typed step descriptor contract；
- Definition、StepDefinition、Edge、Run、StepRun、Attempt、Lease、Gate、Receipt、Event、Intervention 与 safe Error 模型；
- 首版八类 canonical step id；
- definition publish/start、run pause/resume/cancel/reconcile、definition/run list/get、event list/watch service surface；
- JSON Schema 由 `schema-export` CLI 生成并支持 `--check`；
- Go Proto/gRPC assets 由 `buf generate` 生成；
- 所有独立 runtime resource 带 contract version，lease/fence 使用显式 DB-time/fence/version 字段；
- step input 使用 typed binding 和 schema ref，不使用任意 JSON/Proto Struct；
- error detail 只允许 safe reason/resource/version/evidence refs。

实现与生成资产：

```text
api/proto/workbench/workflow/v1alpha1/workflow.proto
api/schema/workbench/workflow/v1alpha1/workflow.schema.json
service/gen/workbench/workflow/v1alpha1/workflow.pb.go
service/gen/workbench/workflow/v1alpha1/workflow_grpc.pb.go
service/cmd/schema-export/workflow.go
tests/workflow-contract-assets.test.ts
```

## 2. 安全边界

合同不包含：

```text
credential
providerPayload
rawPayload
privatePath
dynamicUrl
shellCommand
google.protobuf.Struct
```

旧 step id `workbench.read.v1`、`workbench.owner_operation.v1`、`workbench.transform.v1`、`workbench.compensation.v1` 不进入生成合同。

无条件 edge 不要求 `conditionRef`；有条件分支通过 optional safe condition ref 绑定，不接受表达式 body。各 step 的 input/output body 由后续 schema ref 指向 typed schema，不在 Definition 内保存 raw payload。

## 3. 生成与验证

```bash
task workflow:contract:generate
task workflow:contract:check
task test:workflow-contract:component
```

Component evidence：

```text
temp/integration-test-runs/20260720181223-c6d489cf-f819-4396-9114-4bd2a855138a/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

额外通过：

```text
buf lint
schema-export --check
git diff --check
generated asset forbidden-field scan
```

## 4. 未完成边界

- `1.2c` 尚需 TypeScript SDK models、runtime validation 与 transport naming parity。
- `1.2d` 尚需从本合同生成 canonical step registry snapshot、digest 与 release binding。
- `1.4` 尚需实现 deterministic Definition/Run/Step state machine；Proto service 定义不代表服务行为已可用。
- `1.5` 尚需完成四 transport service wiring 与 conformance。
- 当前生成合同不能作为 production readiness 证明；worker 仍必须在 operation/step snapshot、R1 identity、PostgreSQL 与 role probes 完成后才能 claim。
