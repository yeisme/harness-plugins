# Delta for workbench-daily-operations

## ADDED Requirements

### Requirement: 真实依赖集成门禁
Workbench SHALL 以 disposable PostgreSQL、Identity test tenant 与至少一个真实 Owner 完成 projection rebuild、Task/Gate/receipt/SSE 的 integration/system 验证后才允许 R3 能力晋级；fixture MUST NOT 替代真实依赖，六件套 evidence 与 redaction 必须完整。

#### Scenario: 外部依赖缺失
- **WHEN** disposable PostgreSQL、Identity test tenant 或真实 Owner 不可用
- **THEN** 对应门禁保持 blocked，不降低测试范围，不以 SQLite/fixture 结果宣称通过

### Requirement: 浏览器与无障碍安全门禁
Workbench SHALL 在晋级前完成 restore/deep-link/back-forward/fullscreen/mobile/keyboard、cross-tenant、revoke、owner offline、conflict、unknown_accept 与 handoff 的 browser/a11y/security E2E，且 P0/P1 为零。

#### Scenario: 存在 P0/P1 finding
- **WHEN** 任一 critical journey 失败或存在未修复 P0/P1
- **THEN** 晋级保持阻塞，固定 identity/tenant/project/layout/viewport 重放并保留 screenshot/trace/network 证据

### Requirement: 性能容量与回退门禁
Workbench SHALL 在 100k assets、50k WorkItems、20 panes、200 SSE 与 24h soak 下达到 latency/memory/reconnect/error budget，并通过独立 kill switch 的 rollback dry-run；rollback MUST NOT 回到跨租户 localStorage 或 fixture owner 路径。

#### Scenario: rollback dry-run 违反不变量
- **WHEN** rollback dry-run 回到跨租户 localStorage、fixture owner 或回滚 additive migration
- **THEN** closeout 被阻止，R4 不接收对应 handoff refs
