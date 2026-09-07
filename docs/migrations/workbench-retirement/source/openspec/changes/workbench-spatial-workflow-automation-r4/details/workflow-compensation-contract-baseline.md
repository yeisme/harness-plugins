# Workflow Compensation Additive Contract 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.2e` 已完成 Proto、生成 JSON Schema、TypeScript SDK 与 Go domain publish validation 的同一合同：

- `WorkflowDefinition` 与 draft 以 additive repeated binding 表达显式补偿，不新增 canonical executor step，也不存在 generic rollback flag；
- binding 固定 `sourceStepRef`、批准的 `operationType`、typed input bindings、input/output schema ref、timeout、authority/cost/reconcile policy；
- compensation 强制 `owner_operation` 与 `owner_receipt_reconcile`，不继承原 step 的 authority、idempotency key 或 receipt 语义；
- definition 固定 `operationRegistryDigest`，每个 binding 固定 `operationSchemaDigest`；publish 时对真实 canonical Operation Snapshot 校验 operation mode、mutation、persist-safe、permission、idempotency、receipt/reconcile 与 schema digest；
- Operation Registry 的 `data:` schema URL 不复制进 Workflow safe contract；Workflow 保存 safe mapping schema ref，并用 digest 固定真实 operation schema；
- 无 compensation 字段的既有 definition 继续归一化为 `compensations: []`；strict JSON SDK 对未知新字段 fail-closed，Proto 维持 additive unknown-field 兼容。

## 2. 生成与验证

```bash
task workflow:contract:generate
task workflow:compensation-contract:test
task test:workflow-compensation-contract:component
```

Component evidence：

```text
temp/integration-test-runs/20260720192025-112ae0c8-71bc-443d-96ad-6595156eed16/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 3. 安全不变量

- 禁止 script、URL、path、credential、raw provider payload、free-form map。
- source step 必须存在、具有 side effect，且一个 source step 最多一个 compensation binding。
- operation 必须来自固定 snapshot，并支持 reconcile；registry/schema drift 一律拒绝 publish。
- compensation contract 只定义可执行事实，不代表 transport、repository、scheduler 或 worker 已接线。
