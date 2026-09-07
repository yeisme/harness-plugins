# Production Incident Drill Plan 基线

## 1. 结论

R5 `3.4e` 已增加只读事件演练计划入口：

```bash
task incident:drill ENV=staging INCIDENT=INC-CONFIG
```

该入口调用`workbench-release incident drill`，读取当前Taskfile target registry与生产事件runbook，为指定P0/P1事件生成detect、contain、recover三步计划。它不执行步骤、不创建或关闭incident、不调用paging、不修改release/deployment状态，也不授予production authority。

## 2. 合同

- Schema：`workbench.incident_drill_plan.v1alpha1`。
- 环境：只接受`integration|staging`；`canary|production`直接返回`incident_drill_environment_unsafe`。
- 事件：只接受runbook中的六个canonical incident ID。
- 步骤：固定按detect、contain、recover排序，并投影target status、authority、expected exit、provider dependency与rollback/failure action。
- Gate：任一步骤为`diagnostic_only|planned|provider_blocked`时返回`partial`和domain exit `5`，列出canonical blocker；不得把可生成计划解释为可执行响应。
- 输出：JSON/Agent/Explain/Human均不回显Taskfile或runbook私有路径，固定`dry_run=true`、`external_actions_executed=false`、`production_authorized=false`。

## 3. 当前真值

`INC-CONFIG`当前计划包含：

- `release:readiness`：`diagnostic_only`；
- `deploy:validate`：`planned`；
- `release:rollback:dry-run`：`planned`。

因此真实Taskfile调用保留底层exit `5`，go-task返回非零；这证明blocker传播正常。入口本身在production target registry中为`available/read_only_drill_plan`，并不表示三项响应动作或真实staging演练已完成。

Historical 30-target totals are stale. The current v8 registry is 36 total,
8 available, 5 diagnostic, 14 planned and 9 provider-blocked, with
`complete=false` and `production_authorized=false`. This does not turn the
incident plan into a staging execution authority.

## 4. 验证与证据

```bash
CGO_ENABLED=0 go test ./service/cmd/workbench-release -run 'IncidentDrill|Runbook|ProductionTarget' -count=1
task test:incident-drill:component
task runbook:validate
task taskfile:docs:test
openspec validate workbench-production-ga-r5 --strict
```

Component evidence：`temp/integration-test-runs/20260729080621-ad1059e0-34d4-4ed9-9026-f71432b164c6/summary.json`，状态`passed`、exit `0`、redaction passed；其中实际CLI的预期domain exit `5`由测试合同显式断言。

## 5. 兼容与回滚

该能力为additive v1alpha1诊断表面：新增CLI子命令、Taskfile入口、可选facts字段和文档，不删除或重解释既有稳定字段。若回滚，移除入口后必须重新生成target registry并把`incident:drill`恢复为`planned`；不得保留旧available registry或以手写演练计划替代CLI。
