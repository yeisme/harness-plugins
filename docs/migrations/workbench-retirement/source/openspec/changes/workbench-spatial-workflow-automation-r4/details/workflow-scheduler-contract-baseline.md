# Workflow Scheduler Candidate / Decision 合同基线

## 1. 完成范围

截至 2026-07-21，R4 `5.1a` 已实现纯 Go scheduler evaluator：

- typed `Candidate` 固定 tenant/run/step/definition refs、definition version/checksum、workflow contract、step registry contract/digest、step type/state、run/step expected version与next attempt sequence；
- `NewEvaluator`验证canonical step registry snapshot、当前worker workflow contract range和executor registration；
- evaluator在构造时复制snapshot descriptor slice与executor map，调用方后续修改配置不会改变decision；
- current alpha contract采用精确range绑定：`min=max=workbench.workflow.v1alpha1`，不使用字符串大小比较推断未来版本兼容；
- registry contract/digest mismatch、invalid candidate、unknown/missing executor均fail closed并返回stable low-cardinality reason；
- 首批只允许`read_projection`、`condition`、`delay`且必须存在已注册executor；
- `wait_task`、`approval`、`wait_event`、`submit_operation`、`emit_delivery`即使注册executor也返回`step_not_claimable`；
- decision不包含candidate refs、payload、credential、endpoint或底层错误。

实现路径：

```text
service/internal/scheduler/evaluator.go
service/internal/scheduler/evaluator_test.go
```

## 2. Decision 合同

当前kind：

- `allow`；
- `deny_contract`；
- `deny_unsupported`。

当前reason：

- `claim_allowed`；
- `invalid_candidate`；
- `workflow_contract_mismatch`；
- `step_registry_mismatch`；
- `step_unsupported`；
- `step_not_claimable`；
- `executor_unavailable`。

`allow`只返回`attempt_kind=executor`和safe executor key。它不创建lease、不预留capacity、不授予claim authority，也不代表executor或worker role ready。

## 3. TDD 与验证

测试先以缺少`Candidate`、`Evaluator`和decision symbols失败；实现后继续通过红灯测试收紧：

- whitespace opaque refs必须拒绝；
- unknown executor step type必须拒绝；
- caller mutation不得改变构造后的snapshot/executor配置。

验证命令：

```bash
task scheduler:contract:test
task test:scheduler-contract:component
CGO_ENABLED=0 go test ./service/internal/scheduler ./service/internal/workers/registry ./service/internal/workflows/domain -count=1
go vet ./service/internal/scheduler
```

Component evidence：

```text
temp/integration-test-runs/20260721154712-47fb0eea-eec2-406d-92d9-7d6f7b320103/
status=passed
exit_code=0
directory_mode=0700
file_mode=0600
redaction_scan=clean
```

## 4. 未完成边界

以下仍属于后续任务，不由`5.1a`完成：

- `5.1b` additive ready queue projection与migration；
- `5.1c` PostgreSQL bounded per-tenant candidate query；
- `5.1d`已由`details/workflow-scheduler-policy-fairness-baseline.md`完成；
- `5.1e`运行中scheduler engine readiness/availability；
- `5.2b1a-d` claim、heartbeat、drain和真实process evidence；
- R5 candidate-bound claim authority与production authorization。

因此当前`production_authorized=false`，没有任何代码路径开始扫描数据库或claim workflow step。
