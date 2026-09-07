# Production Incident Runbook Validation 基线

## 1. 结论

R5 `3.4e` 的本地 runbook validation slice 已实现：

```bash
task runbook:validate
```

该命令调用 `workbench-release runbook validate`，读取 `docs/operations/production-incident-runbook.md` 与当前 `Taskfile.yml`，并复用 CLI 内的 canonical production target definitions。它不执行 incident drill、deployment、rollback 或其他外部动作。

## 2. 合同

运行手册固定六类 P0/P1 事件：configuration、database、deployment、identity、release 与 workflow。每条记录必须包含：

- 唯一 incident ID；
- `P0|P1`；
- opaque owner ref；
- canonical detect、containment、recovery target；
- 根据当前 target registry 计算的 aggregate gate。

Aggregate gate 按 `available < diagnostic_only < planned < provider_blocked` 取最严格状态。任何 target 缺失、owner不安全、事件重复/遗漏、gate陈旧或出现credential/bypass示例均返回 `runbook_invalid`。

## 3. 当前状态

当前runbook引用15个target：

- 3个`available`；
- 2个`diagnostic_only`；
- 8个`planned`；
- 2个`provider_blocked`。

Runbook本身验证通过不改变上述authority。`incident:drill`现已提供read-only plan，但真实响应动作、paging/incident authority、deployment、managed PostgreSQL restore、canary与rollback仍由各自owner完成，`production_authorized=false`。

The earlier 30-target total is historical only. The current v8 registry is 36
total: 8 available, 5 diagnostic, 14 planned, and 9 provider-blocked; it
remains `complete=false` and `production_authorized=false`. Runbook validation
does not establish managed restore or staging execution authority.

## 4. 验证与证据

```bash
task runbook:validate
task taskfile:docs:test
CGO_ENABLED=0 go test ./service/cmd/workbench-release -run 'Runbook|ProductionTarget' -count=1
openspec validate workbench-production-ga-r5 --strict
```

Component evidence：`temp/integration-test-runs/20260729074542-b821af75-67c5-4913-a527-0c7603c18f54/summary.json`。

Incident drill plan evidence：`temp/integration-test-runs/20260729080621-ad1059e0-34d4-4ed9-9026-f71432b164c6/summary.json`。

测试覆盖真实仓库runbook、stale gate、credential/bypass文本、缺失文件、私有路径不回显、JSON/shared envelope与target registry晋级。

## 5. 兼容与回滚

新CLI command、Taskfile target、文档与测试均为additive；不改变既有target schema或生产authority。回滚时可以移除runbook或incident plan command/target，但registry必须重新生成并把对应入口恢复为planned，不能保留旧available registry，也不能把文档校验或只读计划解释为incident response authority。
