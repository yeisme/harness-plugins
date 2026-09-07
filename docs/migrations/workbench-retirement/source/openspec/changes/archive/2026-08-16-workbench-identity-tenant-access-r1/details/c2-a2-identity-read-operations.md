# C2-A2 Identity Read Operations 实现记录

## 状态

`C2-A2a` provider-independent identity read baseline 已实现。它建立了可运行的 identity application service、HTTP、gRPC、JSON-RPC 与 TypeScript SDK parity，但真实 managed Session、Tenant、Membership 和 allowed-action 数据仍依赖尚未交付的 Identity Platform/BFF provider adapter。因此 R1 capability 继续保持 `needs_contract`，本记录不代表登录、租户切换、撤销或授权已可用于生产。

## 已实现合同

合同版本继续使用 `workbench.identity.v0.1`。

| SDK / Proto method | HTTP | JSON-RPC | 当前权威来源 |
|---|---|---|---|
| `GetCurrentPrincipal` | `GET /v1alpha1/identity/principal` | `workbench.identity.v1alpha1.GetCurrentPrincipal` | workbenchd 已验证 `PrincipalContext` |
| `GetIdentitySession` | `GET /v1alpha1/identity/session` | `workbench.identity.v1alpha1.GetIdentitySession` | local 为真实 local session；managed 需要 Provider/BFF |
| `ListIdentityTenants` | `GET /v1alpha1/identity/tenants` | `workbench.identity.v1alpha1.ListIdentityTenants` | Identity Provider gateway |
| `ListIdentityMembers` | `GET /v1alpha1/identity/tenants/{tenantRef}/members` | `workbench.identity.v1alpha1.ListIdentityMembers` | Identity Provider gateway，先校验当前 tenant |
| `GetAllowedActions` | `POST /v1alpha1/identity/allowed-actions` | `workbench.identity.v1alpha1.GetAllowedActions` | Identity/Policy gateway，先校验当前 tenant |
| `GetIdentityReadiness` | `GET /v1alpha1/identity/readiness` | `workbench.identity.v1alpha1.GetIdentityReadiness` | verifier + provider readiness |

`TenantSelectionRequest` 与 `TenantSelectionResult` 已加入 Schema/Proto/SDK safe model，只冻结后续原子事务的输入输出；当前没有注册 select/switch mutation endpoint，避免在没有 server-side BFF session revision、CSRF、cookie rotation 和 revoke ordering 时产生半成品副作用。

## 应用服务边界

`service/internal/identity.Service` 只承担：

- 从 `security.Principal` 投影 safe current principal，不读取 provider token、email 或 raw profile。
- local profile 返回明确 `local_session`，不伪装 managed tenant authority。
- 通过强类型 `identity.Provider` gateway 读取 managed session、tenant、member 和 allowed actions。
- Provider 未配置时返回 `identity_needs_contract`；Provider outage 返回 `identity_unavailable`；不兼容响应返回 `contract_mismatch`。
- 在调用 Provider 前拒绝跨 tenant member/action 请求；Provider 返回后逐项校验 opaque ref、revision、actor、scope、auth method、tenant/member/action state、分页 token 与数量上限。
- active/stale managed Session 必须与当前已验证 Principal 完全绑定；不接受 Provider 返回的其他 subject/session/tenant/membership/version。
- readiness 分别报告 principal verifier、local session 或 identity provider，不把“接口存在”当作“Provider ready”。

## 稳定错误映射

| Domain error | HTTP | gRPC | JSON-RPC data.code |
|---|---:|---|---|
| `authentication_required` | 401 | `Unauthenticated` | `authentication_required` |
| `identity_needs_contract` | 424 | `FailedPrecondition` | `identity_needs_contract` |
| `invalid_argument` | 400 | `InvalidArgument` | `invalid_argument` |
| `permission_denied` | 403 | `PermissionDenied` | `permission_denied` |
| `contract_mismatch` | 502 | `FailedPrecondition` | `contract_mismatch` |
| `identity_unavailable` | 503 | `Unavailable` | `identity_unavailable` |

所有 identity HTTP 响应使用 `Cache-Control: no-store`。SDK normalizer 对 unsupported version、malformed page、secret-shaped unknown field 和 invalid principal/session fail-closed，不保留上游未知字段。

## 生成与验证

```bash
task identity:models:generate
task identity:models:test
task identity:reads:test
task test:identity-reads:integration
```

`task identity:reads:test` 同时覆盖 application service、REST、gRPC、JSON-RPC、Go conformance 与 SDK。integration target 通过 evidence runner 写入标准六件套。

最新通过证据：`temp/integration-test-runs/20260720101819-6003383f-37a3-4c29-99ac-9b6e2be7e123`；`status=passed`、`exit_code=0`，包含 Go 三 transport conformance、SDK normalization 与真实 local `workbenchd` HTTP/JSON-RPC identity parity。

## 后续对接工作包

### C2-A2b — Identity Provider read adapter

- Provider contract/live digest 通过 Gate 0 后实现 bounded HTTP client；固定 issuer/origin、contract digest、timeout、redirect、Content-Type、body/page limit 和 stable error translation。
- Adapter 必须实现 `CheckReady`、Session、Tenant、Membership 与 allowed-action reads；不得接收请求级 endpoint、token policy 或 algorithm override。
- 增加 fixture/live parity、outage、timeout、contract drift、cross-tenant response 与 redaction tests。

### C2-B — BFF browser session

- 建立 Drizzle session store、opaque `__Host-yeisme_workbench` cookie、CSRF、expected revision、rotation、logout 与 same-origin proxy。
- BFF 每次请求从 server session 获取短期 `aud=workbench` PrincipalContext；浏览器 Authorization/cookie 不转发到 Owner。
- Provider/BFF adapter 完成前，managed `GetIdentitySession` 保持 `identity_needs_contract`。

### C2-C — Tenant selection/switch transaction

- 实现 `TenantSelectionRequest/Result` mutation；以 expected session revision、membership freshness 与 CSRF 为前置条件。
- transaction 成功后按固定顺序 abort old authority requests、close SSE、clear query cache、delete old layout、rotate cookie/context、publish new generation。
- 任一步失败必须回滚或使旧 authority 失效，不能出现 UI tenant 已切换但 backend authority 未切换。

### C3 — Policy、freshness 与 tenant-bound data

- allowed actions 必须由 operation policy + membership/resource version 计算，而不是仅回显 scopes。
- repository 的 list/get/mutation 必须在 GORM 层绑定 tenant authority；跨 tenant probing 使用安全 404/deny 语义。
- revoke/freshness consumer、event cursor、lag threshold、service delegation 与 audit 完成后，managed capability 才能从 `needs_contract` 晋级。
