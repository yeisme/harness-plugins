# Production Target Registry 实现基线

## 1. 完成范围

R5 `3.4e0` 已实现 CLI-authored production target registry 与可用性 validator：

- `workbench-release targets generate`
- `workbench-release targets validate`
- `task production-targets:generate`
- `task production-targets:validate`
- `task production-targets:test`
- `task test:production-targets:component`

该能力只证明计划命令的存在性、authority 分类、输入、退出语义、evidence layer 和 owner task 可机器重验。它不实现缺失的 deploy、workflow system/e2e、soak、canary、rollback、DR 或 post-deploy 命令，也不授予 production authority。

## 2. 结构化合同

- Schema：`workbench.production_target_registry.v1alpha1`。
- 写入：CLI 使用新建文件、`O_EXCL`、`0600`；父目录按`0700`创建。
- Source binding：Taskfile 内容 digest、当前CLI help digest与canonical target definition共同生成`source_digest`。
- 状态：`available|diagnostic_only|planned|provider_blocked|deprecated`。
- Authority：`production_authorized=false`固定；`complete`仅在不存在`planned`和`provider_blocked`时为true。
- Drift：Taskfile target、CLI help或canonical definition变化后，旧registry验证失败，必须重新生成。

每个target记录：

- `target`
- `owner_task`
- `status`
- `authority_level`
- `required_inputs`
- `expected_exit`
- `evidence_layer`
- `provider_dependencies`
- `consumer_dependencies`
- `rollback_or_failure_action`

## 3. 当前结果

当前工作树运行真实`Taskfile.yml`时，registry可成功生成，但命令以domain exit `5`返回`production_targets_blocked`，因为关键production targets仍为`planned`或`provider_blocked`。这是正确的current truth，不是测试失败，也不能改成零退出掩盖缺口。

Current authoritative checkpoint is
`temp/release/production-targets-current-v8.json`: 36 targets, 8
`available`, 5 `diagnostic_only`, 14 `planned`, and 9 `provider_blocked`.
It remains `complete=false` and `production_authorized=false`; validation
intentionally returns domain exit `5`. `v2`–`v7` and unversioned `current`
aliases are historical stale snapshots, not current release evidence.

已存在但仅为诊断或provider consumer的入口保持原authority，例如：

- `release:readiness`：`diagnostic_only`
- `release:audit`：`diagnostic_only`
- `release:slo:validate`：`provider_blocked`
- `db:backup`、`db:restore:verify`：`provider_blocked`
- `runbook:validate`：`available`，但只授予documentation validation authority
- `incident:drill`：`available`，但只授予read-only drill plan authority；引用动作未就绪时稳定返回domain exit `5`

`release:workflow-canary:plan:generate|validate` are `diagnostic_only`
offline plan contracts, not execution authority; the public workflow-canary
sentinel remains `provider_blocked`. Managed restore, compose staging bootstrap,
soak, deploy/canary/rollback, DR and post-deploy claims remain open and
non-authoritative until their respective managed provider evidence exists.

## 4. 验证

```bash
task production-targets:test
task test:production-targets:component
CGO_ENABLED=0 go test ./service/cmd/workbench-release -count=1
go vet ./service/cmd/workbench-release
bun test tests/release-state.test.ts tests/release-gates.test.ts
openspec validate workbench-production-ga-r5 --strict
```

原始registry组件证据：`temp/integration-test-runs/20260721150833-82524d77-2116-45b2-84da-7d819c93c82e/`。Runbook增量证据：`temp/integration-test-runs/20260729074542-b821af75-67c5-4913-a527-0c7603c18f54/`。Incident drill增量证据：`temp/integration-test-runs/20260729080621-ad1059e0-34d4-4ed9-9026-f71432b164c6/`。三者均为`passed`、exit `0`，目录`0700`、文件`0600`，敏感扫描无命中。

CLI JSON与Agent输出同时通过`ai-native-cli-output-contract` validator；真实Taskfile registry保持`production_authorized=false`和`complete=false`。

## 5. 兼容性与回退

- Compatibility：additive；新增命令、Taskfile targets、v1alpha1 schema和可选facts字段，不删除、重命名或重解释既有CLI字段和命令。
- Released/stable：该registry仍为`v1alpha1`诊断合同，不得作为stable release/deployment authority。
- Rollback：可移除未被stable manifest或promotion consumer使用的新命令、schema和Taskfile入口；不得回退为解析human output、手写registry或“target存在即production ready”。
