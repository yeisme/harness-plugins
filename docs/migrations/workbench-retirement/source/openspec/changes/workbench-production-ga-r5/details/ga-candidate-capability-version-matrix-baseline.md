# GA Candidate Capability / Version Matrix 基线

## 结论

R5 `0.2` 已建立由 `workbench-release` CLI 生成和复验的 GA candidate capability/version matrix。矩阵按 Identity、Owner、Desktop、Asset、WorkItem、DailyOps、Board、Workflow 八个 capability 独立计算，消费 `0.1` 的 requirement authority，不使用共享总开关，也不把 OpenSpec artifact complete、fixture 或未验证 requirement 推断为 ready。

当前 integration truth 为：八个 capability 全部 `candidate_state=disabled`、`readiness_state=needs_contract`、`enabled=false`，contract/schema/policy/definition version authority 全部 `missing`，`production_authorized=false`。这是安全候选状态，不是 GA readiness 声明。

## CLI 资产与命令

```text
temp/release/requirements-mapped.json
temp/release/candidate-matrix.json
```

```bash
task release:candidate:generate \
  ENV=integration \
  REQUIREMENT_INDEX=temp/release/requirements-mapped.json \
  CANDIDATE_MATRIX=temp/release/candidate-matrix.json

task release:candidate:validate \
  ENV=integration \
  REQUIREMENT_INDEX=temp/release/requirements-mapped.json \
  CANDIDATE_MATRIX=temp/release/candidate-matrix.json
```

当前两个命令都会写入或验证资产后以 domain exit `5`、`ga_candidate_blocked` 返回，这是预期 fail-closed 行为。Task runner 将该 domain exit 显示为非零；不得改成成功退出掩盖 capability blockers。

## 状态语义

- `candidate_state=disabled`：当前候选不开放该 capability。
- `readiness_state=needs_contract`：至少一个直接 requirement 尚未 verified。
- `readiness_state=available`：仅当该 capability 对应的所有 requirement 都为 verified；它仍不会自动把 `enabled` 改为 true。
- `contract_range_state`、`schema_range_state`、`policy_state`、`definition_state`：当前只接受 `missing`，防止在无 authoritative digest/range 来源时填入推测版本。
- `blockers`：只包含对应 capability 的 requirement refs。某一 capability 的缺口不会把其他 capability 的 blocker 列表合并成共享总阻塞。

## 当前矩阵

| Capability | Requirements | Verified | Candidate | Readiness |
| --- | ---: | ---: | --- | --- |
| Identity | 14 | 0 | disabled | needs_contract |
| Owner | 10 | 0 | disabled | needs_contract |
| Desktop | 9 | 0 | disabled | needs_contract |
| Asset | 13 | 0 | disabled | needs_contract |
| WorkItem | 13 | 0 | disabled | needs_contract |
| DailyOps | 13 | 0 | disabled | needs_contract |
| Board | 12 | 0 | disabled | needs_contract |
| Workflow | 16 | 0 | disabled | needs_contract |

Asset、WorkItem 与 DailyOps 当前复用同一 R3 daily-operations requirement owner slice，但拥有独立 flag、kill switch、candidate state 和 blocker projection；后续 Owner 可以逐 capability 提供更细 evidence，而不需要改变 matrix schema。

## 验证证据

- Component：`temp/integration-test-runs/20260729070720-64b8b7a1-a4c2-46e8-a834-13026a00f995/summary.json`
  - candidate/requirement Go tests 通过。
  - 覆盖默认 disabled、八 capability 完整性、available-with-blockers 拒绝、requirement digest drift 拒绝、CLI 生成资产但返回 domain exit 5。
  - evidence runner 六件套与 redaction gate 通过。
- `release:candidate:validate` 对当前资产复验后按预期返回 `ga_candidate_blocked`，证明资产与当前 requirement index 一致但不具 production authority。
- `git diff --check` 与 R5 strict OpenSpec validation 通过。

## 兼容与回滚

- 变更类型：新增 pre-1.0 `workbench.ga_candidate_matrix.v1alpha1` structured asset、CLI command 与 Taskfile targets；没有删除或重定义现有 manifest、requirements、handoff 或 promotion surface。
- OpenSpec owner：`workbench-production-ga-r5`，对应任务 `0.2`。
- 迁移窗口：新资产为 additive opt-in，不要求现有 consumer 迁移。
- 回滚：停止调用 `release:candidate:*` 并删除临时生成资产；requirements/handoff/manifest consumers 保持原行为。

## 后续边界

- `0.2` 关闭表示安全 candidate matrix 已冻结，不表示任一 capability 已获准启用。
- capability 晋级需要逐条 requirement direct evidence、version/digest authority、独立 flag/kill switch 与后续 promotion approval；本 CLI 不提供自动 promotion。
- Production apply、secret、DNS、真实 Owner mutation 或 capability enable 仍需 root/user 明确批准。
