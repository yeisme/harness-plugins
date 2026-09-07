# Delta for workbench-client-runtime-adapter

## ADDED Requirements

### Requirement: 可验证依赖发布门禁
Workbench SHALL 仅在 broker、Aigora owner 与 credentialctl 依赖以可验证的 tagged release 或独立 owner promotion 证据发布后才允许 generate capability 晋级；本地 `replace` / `file:` / dirty 工作树状态 MUST NOT 作为晋级证据。

#### Scenario: 依赖未发布 tag
- **WHEN** broker 或 owner 依赖仍处于本地 replace、private dev 版本或 dirty 工作树状态
- **THEN** generate capability 保持默认关闭，且晋级任务 3.1 保持未完成

### Requirement: 独立安全复核门禁
Workbench SHALL 在 generate 晋级前获得独立 security reviewer 对 Task gate → broker admission/reconcile → Aigora canonical plan/worker → credential/provider 边界的复核签字；实现者自检证据 MUST NOT 替代独立复核。

#### Scenario: 复核发现 P0/P1
- **WHEN** 独立复核发现任一 P0/P1 风险或缺少负向测试
- **THEN** generate flag 关闭并回到本 change 修复，不得带风险晋级

### Requirement: 真实 Owner 链路晋级验收
Workbench SHALL 以一条真实 Aigora owner 链路逐 capability 晋级，并要求 promotion receipt 引用真实 run ID、命令、退出码与一次显式 rollback rehearsal；fixture 或其他 owner MUST NOT 作为 first-support 替代证据。

#### Scenario: flag 关闭后的行为
- **WHEN** `WORKBENCH_RUNTIME_GENERATE_ENABLED` 与 Web canary 关闭
- **THEN** catalog/action 立即消失，terminal history 仍可读，且任何 non-terminal task 不自动重发
