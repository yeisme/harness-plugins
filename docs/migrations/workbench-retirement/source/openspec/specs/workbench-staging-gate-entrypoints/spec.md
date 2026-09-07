# workbench-staging-gate-entrypoints Specification

## Purpose

为跨 release 关键路径补齐 staging 门禁入口：`identity:soak` 与
`release:rollback:dry-run` 两个 Taskfile target 以 fail-closed 方式接线
仓内既有 staging soak/rollback 资产，缺 staging 输入即非零退出，并为每次
运行（含拒绝）留下脱敏证据。

## Requirements

### Requirement: staging 门禁入口 fail-closed
Workbench SHALL 提供 `identity:soak` 与 `release:rollback:dry-run` 两个 Taskfile 入口，分别承接 R1 6.4 的 staging soak（含 JWKS/Identity rotation attempt）与 rollback drill dry-run；任一入口在缺 staging 环境输入时 MUST fail-closed（非零退出），不得伪造 soak、rotation、revoke 或 rollback 证据，也不得退化为本地 mock 结果。

#### Scenario: 缺 staging 输入
- **WHEN** staging base URL、token file、fixture/start receipt、Identity rotation attempt 或已记录 rollback receipt 等必需输入缺失
- **THEN** 入口以非零退出拒绝执行，输出仅列出缺失输入的变量名（不输出任何值），并保持对应 release 门禁 blocked

#### Scenario: staging 输入齐全
- **WHEN** staging operator 提供全部必需输入
- **THEN** `identity:soak` 驱动既有 `workbench-project-soak run` 执行只读 staging soak 观察，`release:rollback:dry-run` 驱动既有 `workbench-project-soak validate-rollback` 验证已记录 rollback receipt 并复核 runbook 合同，二者均不执行真实 mutation、不授予 staging 或 production authority

### Requirement: 脱敏证据
两个入口 SHALL 通过 `scripts/test-evidence/run.ts` 包装执行，每次运行（含 fail-closed 拒绝）在 `temp/integration-test-runs/<run-id>/` 留下 `summary.json`、command、stdout、stderr、env 与 artifacts 证据；输出 MUST NOT 包含 token、凭据、私有路径值或 secret 文件内容。

#### Scenario: fail-closed 也留证据
- **WHEN** 入口因缺 staging 输入而拒绝执行
- **THEN** `temp/integration-test-runs/<run-id>/` 中存在 status=failed 的脱敏证据包，stderr 记录缺失输入变量名清单

### Requirement: 复用既有 staging 资产
门禁入口 SHALL 只接线仓内已有资产（`workbench-project-soak`、`workbench-release runbook validate`、`production:guard`、证据 runner 与 staging compose 拓扑合同），MUST NOT 新造第二套 soak/rollback 状态机或绕过既有 receipt 验证合同。

#### Scenario: 绕过既有验证
- **WHEN** 入口尝试以 shell 拼接、手写 receipt 或新造状态机替代既有 CLI 验证
- **THEN** 视为合同违反，相关验收不得关闭

### Requirement: runbook 与 registry 一致性
`release:rollback:dry-run` 进入 Taskfile 后，`docs/operations/production-incident-runbook.md` 的 Current gate 列 SHALL 与 `workbench.production_target_registry.v1alpha1` 聚合状态保持一致，`task runbook:validate` 必须通过；任何 target 状态翻转 MUST 同步更新 runbook 与其合同测试。

#### Scenario: gate 列过期
- **WHEN** Taskfile target 集合变化导致 registry 聚合 gate 与 runbook 记录不一致
- **THEN** `runbook validate` 以 `runbook_invalid` 拒绝，修正 runbook 前事件演练与 release 门禁保持 blocked
