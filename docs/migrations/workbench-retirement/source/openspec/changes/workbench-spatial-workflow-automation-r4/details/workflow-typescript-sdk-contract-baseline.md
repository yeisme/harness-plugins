# Workflow TypeScript SDK 合同实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.2c` 已实现：

- `WorkflowDefinition`、`WorkflowDefinitionDraft`、`WorkflowStepDescriptor`、`WorkflowStepDefinition`、`WorkflowRun`、`WorkflowStepRun`、`WorkflowEvent` 与分页/detail模型；
- canonical step、definition/run/step states、side-effect/retry/idempotency/receipt policy 的 closed unions；
- strict response normalization：unknown contract/state/step、额外字段、unsafe ref、错误 digest/schema ref、重复 descriptor 均 fail-closed；
- draft、mutation version/idempotency、scope、pagination、event sequence/limit 在 transport 前验证；
- Definition CRUD/publish/deprecate、validate、registry read、Run start/read/list/pause/resume/cancel/reconcile、event list/watch client methods；
- mutation 自动传递 `Idempotency-Key` metadata；
- HTTP route 与 `workbench.workflow.v1alpha1` JSON-RPC namespace；
- Workflow stable error codes 加入共享 SDK error envelope；
- `WorkbenchClient` 保持旧构造器 source compatibility，未配置 Workflow 时显式 unavailable，不返回空成功。

实现位置：

```text
packages/task-sdk/src/workflow-models.ts
packages/task-sdk/src/workflow-client.ts
packages/task-sdk/src/workbench-client.ts
packages/task-sdk/src/http.ts
packages/task-sdk/src/json-rpc.ts
packages/task-sdk/src/models.ts
packages/task-sdk/test/workflow-models.test.ts
packages/task-sdk/test/workflow-client.test.ts
packages/task-sdk/test/workflow-wiring.test.ts
```

## 2. 安全与兼容规则

- SDK model 不暴露 raw step input/output map；Definition 只持有 typed binding 和 schema refs。
- normalization 使用 allowlisted keys，`providerPayload` 等额外字段直接 contract mismatch。
- 首版 step type 只接受八类 canonical id；旧 `read/owner_operation/transform/compensation` id 拒绝。
- event cursor 必须为非负整数，page size 上限 256，event limit 上限 1024。
- response contract mismatch 使用共享 `WorkbenchError(code=contract_mismatch)`；request validation 使用 `invalid_argument`。
- Workflow transport 未配置时使用 `unavailable`，避免 demo fallback 冒充真实服务。

## 3. 验证

```bash
task workflow:sdk:test
task test:workflow-sdk:component
bun run typecheck
```

最终 component evidence：

```text
temp/integration-test-runs/20260720185705-e98ebadf-5145-4242-8d29-55397ca6af31/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

首次 evidence `20260720182248-b7080982-c78f-4331-84b8-a8468274c33a` 因测试将 `AsyncIterable` 直接当 iterator 导致 TypeScript `TS2339`，已保留失败六件套；修复为显式 `[Symbol.asyncIterator]()` 后重新验证通过。

`1.2d1` 将 registry normalization 收紧为完整八类与固定顺序后，全 SDK 回归识别出 client/wiring fixture 仍返回 partial registry；fixture 已改为完整 canonical list，并由上述最新 component evidence 重新验证。

## 4. 未完成边界

- `1.2d1` 已生成 canonical step snapshot 与 digest，并把 SDK registry normalization 收紧为完整八类与固定顺序；实施基线见 `details/canonical-workflow-step-registry-snapshot-baseline.md`。
- `1.2d2` 尚需在 publish validator、scheduler、worker executor 与 Web designer 完成同一 snapshot 的运行时消费与conformance gate。
- HTTP/JSON-RPC route 当前只是 consumer contract；后端 handler 与四 transport parity 属于 `1.5`，不能据此宣称 API 可用。
- state machine、publish validation、scheduler 和 executor 尚未实现，SDK 不在浏览器本地模拟 terminal state。
