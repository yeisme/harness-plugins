# Delta for workbench-identity-tenant-access

## ADDED Requirements

### Requirement: 真实 Provider 集成门禁
Workbench SHALL 仅在独立 Identity Platform owner 以可运行合同交付 provider（Google/Lark exchange、JWKS/discovery、PrincipalContext、Tenant/Membership/session API、audit/outbox 与 revoke event）后，才允许 R1 consumer 能力晋级；fixture 或 mock MUST NOT 替代真实 provider integration 证据。

#### Scenario: provider 合同未交付
- **WHEN** Identity Platform provider change 未通过 strict 验证或缺少真实启动/测试命令
- **THEN** R1 相关能力保持 `needs_contract`，不得在 Workbench 补写 provider 实现

### Requirement: 跨租户安全与浏览器门禁
Workbench SHALL 在晋级前完成 fixation/CSRF/open redirect/token confusion/cross-tenant/cache/two-tab/deep-link/delegation 的 security 与 browser gate，且 critical findings 为零。

#### Scenario: 存在 critical finding
- **WHEN** security/browser gate 存在任一未修复的 critical finding
- **THEN** 晋级保持阻塞，固定 seed/identity/tenant 重放并保留 console/network/screenshot 证据

### Requirement: Staging 稳定性与回退门禁
Workbench SHALL 在 staging 完成 session refresh、JWKS rotation、event reconnect、Identity outage、revoke SLO 与 rollback drill；rollback MUST NOT 降级回 local token 路径，任何缺证据或超阈值保持 `integration_ready/degraded`。

#### Scenario: revoke 超出批准窗口
- **WHEN** revoke 传播超过批准窗口或 rollback drill 降级到 local token
- **THEN** canary recommendation 被阻止，并保留完整 staging evidence
