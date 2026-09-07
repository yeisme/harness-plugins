# Canonical Release 与 capability closeout 基线

## 1. 结论

R0-R5 的唯一 canonical owning change 已在 release CLI、Taskfile、根 README、文档索引与跨 Release DAG 中对齐：

| Release | Canonical change | Capability scope |
| --- | --- | --- |
| R0 | `workbench-production-foundation-r0` | foundation、contract、registry、migration、runtime |
| R1 | `workbench-identity-tenant-access-r1-gates` | Identity consumer 与 managed authority（`workbench-identity-tenant-access-r1` 已归档，本 change 承接剩余门禁） |
| R2 | `workbench-owner-backend-integrations` | Owner provider/consumer integration；按 owner 独立 closeout |
| R3 | `workbench-daily-operations-r3-gates` | Desktop、Asset、WorkItem、Daily（`workbench-desktop-daily-operations-r3` 已归档，本 change 承接剩余门禁） |
| R4 | `workbench-spatial-workflow-automation-r4` | Board、worker、durable Workflow |
| R5 | `workbench-production-ga-r5` | artifact、environment、promotion、DR、SLO、GA gate |

默认 `task spec:status` 与 `task spec:validate` 指向 R0。其他 Release 必须显式设置 `SPEC_CHANGE=<canonical-change>`，不得从 umbrella、历史目录或 `latest` 推断权威入口。

## 2. Closeout 状态边界

`openspec status` 的 artifact complete 只证明 proposal、design、spec 与 tasks 资产完整。Delivery complete 仍要求 CLI/服务生成并重验以下独立状态：

- Provider Ready；
- Consumer Done；
- integration passed；
- rollback passed；
- capability-scoped selector/status；
- direct、fresh、redacted evidence。

R2 不使用 change 级单一布尔值掩盖 owner 差异。`eikona-first-support` 通过显式 selector 选择 canonical change/task key；其他 Owner 可以继续保持 `disabled` 或 `needs_contract`，且不阻断已批准 owner 的独立 maturity。只有全部声明的 P0 Owner 都满足自身 exit gate，R2 owning change 才能整体归档。

## 3. Transport 与 SDK 术语

Workbench 固定使用三个 wire transport：

1. `HTTP REST/SSE`；
2. `gRPC unary/stream`；
3. `JSON-RPC 2.0`。

TypeScript SDK 是消费上述同一 Operation/Task 合同的 facade，不是第四种 wire transport。Provider、service、transport、SDK 与 UI parity evidence 必须绑定同一 contract/schema digest。

## 4. 验证入口

```bash
task taskfile:docs:test
CGO_ENABLED=0 go test ./service/cmd/workbench-release -run 'CanonicalRequirementChangeIDs|InitializeHandoff|OpenSpecSelector|OpenSpecCapability' -count=1
openspec validate workbench-production-foundation-r0 --strict
openspec validate workbench-identity-tenant-access-r1-gates --strict
openspec validate workbench-owner-backend-integrations --strict
openspec validate workbench-daily-operations-r3-gates --strict
openspec validate workbench-spatial-workflow-automation-r4 --strict
openspec validate workbench-production-ga-r5 --strict
task release:handoff:validate ENV=integration HANDOFF_REGISTRY=temp/release/handoff-mapped.json
```

当前结果：文档契约测试 4/4 通过，release CLI canonical mapping/selector/handoff focused tests 通过，R0-R5 六个 change 均严格有效。handoff registry 结构有效但 0/6 ready，按设计返回 `handoff_incomplete`，不产生假通过。

错误放置的外部 Aigora owner change 已从 Workbench planning home 移除：其 `internal/...` 实现路径属于 Aigora checkout，不应污染 Workbench 的全量 OpenSpec 验证。Workbench 只保留消费者侧 `workbench-aigora-execution-projection`；Aigora gateway 本体必须在 Aigora owner repository 建立和验证自己的 OpenSpec。

## 5. 兼容与回滚

- 本次只增加文档契约测试与说明，不改变已有 CLI schema、协议字段或运行时状态。
- requirement v2、handoff v1、selector/status v1alpha1 继续保持既有读取兼容性。
- 回滚时可移除 `taskfile:docs:test` 与对应测试，但不得恢复冲突编号、把 SDK 描述为 wire transport，或用 artifact complete 替代 delivery complete。
- capability selector/status 不可用时必须回到 global OpenSpec 诊断并保持 promotion blocked，不得绕过 capability gate。

## 6. Evidence

- `temp/integration-test-runs/20260729072215-9bd2b923-0eeb-4b88-bbfd-a2cc933ebf76/summary.json`
- `details/cross-release-integration-delivery-dag.md`
- `details/eikona-first-support-openspec-selector.md`
- `details/cross-release-handoff-registry-baseline.md`
