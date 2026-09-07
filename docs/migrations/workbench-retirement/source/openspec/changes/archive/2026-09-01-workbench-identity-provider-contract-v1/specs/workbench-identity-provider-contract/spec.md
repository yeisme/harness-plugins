# Delta for workbench-identity-provider-contract

## ADDED Requirements

### Requirement: Identity provider HTTP 合同 MUST be closed and versioned

Workbench 的 managed identity provider 出站调用 MUST 使用 `workbench.identity.provider.v1alpha1` transport 合同（请求头 `X-Workbench-Provider-Contract`）与 `workbench.identity.v0.1` domain 载荷合同；每个成功响应体顶层 `contractVersion` MUST 逐字节等于 `workbench.identity.v0.1`。响应 MUST 以封闭解码接受（未知字段拒绝、单 JSON 值、有界体积与计数），任何形状漂移 MUST fail-closed 为 `contract_mismatch`。五个方法 MUST 分别绑定 GET `/v1alpha1/identity/provider/ready` 与 POST `/v1alpha1/identity/provider/{session,tenants/list,members/list,actions/allowed}`，请求体 principal MUST 只携带已验证 PrincipalContext 的 opaque ref 投影。

#### Scenario: 响应 contractVersion 漂移

- **WHEN** provider 返回 200 但 `contractVersion` 不是 `workbench.identity.v0.1`、响应含未知字段、trailing JSON 或集合计数越界（tenants/members > 256、actions > 64、体积超上限）
- **THEN** 消费端 MUST 返回 `ErrContractMismatch` 且调用方授权链 MUST 映射为 identity unavailable
- **AND** 任何请求 MUST NOT 被解释为 allow 或重试放大

#### Scenario: 请求头缺失或传输形状漂移

- **WHEN** 消费端发起调用
- **THEN** 请求 MUST 携带 `Accept: application/json` 与 `X-Workbench-Provider-Contract: workbench.identity.provider.v1alpha1`（POST 另带 `Content-Type: application/json`）
- **AND** 请求体 principal MUST 不包含 token、cookie、email 或 raw profile 字段

### Requirement: Provider URL MUST be loopback or HTTPS and responses bounded

Provider BaseURL MUST 在构造时通过 URL policy：缺失 → `needs_contract`；拒绝 userinfo、query、fragment 与非 http/https scheme；loopback host 允许 http，其余 host MUST 是 HTTPS。调用 MUST 使用拒绝一切 redirect 的 client，带默认 1 MiB（可收紧）响应上限与固定读超时；redirect、超时、网络错误、非 JSON Content-Type、5xx MUST fail-closed 为 `unavailable`。

#### Scenario: 私网 HTTP 端点被拒绝

- **WHEN** operator 配置 `http://10.1.2.3:9000` 或带 userinfo/query/fragment 的 URL
- **THEN** 构造 MUST 返回 `ErrNeedsContract` 且不发起任何网络请求
- **AND** `https://identity.internal:8443` 与 `http://localhost:9000` MUST 被接受

#### Scenario: provider redirect 或离线

- **WHEN** provider 返回 3xx redirect、连接失败、超时、返回非 JSON Content-Type 或 5xx
- **THEN** 消费端 MUST 返回 `ErrUnavailable` 且不回显 provider URL 或响应原文

### Requirement: Provider 错误 MUST map to the frozen R1 providerError semantics

Provider 401 MUST 映射 `authentication_required`，403 MUST 映射 `permission_denied`，其余一切失败 MUST 归入 `unavailable` 或 `contract_mismatch`；授权链 MUST 把 needs_contract/unavailable/contract_mismatch 统一折叠为 identity unavailable、把 permission_denied 折叠为 resource denied。任何失败 MUST NOT 被解释为 allow，错误与日志 MUST NOT 回显 token、provider URL、响应原文或非 opaque principal 字段。

#### Scenario: provider 拒绝 principal

- **WHEN** provider 对 AllowedActions 返回 403
- **THEN** 消费端 MUST 返回 `ErrPermissionDenied` 并由 `AuthorizeResource` 映射为 `security.ErrResourceDenied`
- **AND** audit/evidence MUST 只含 safe actor/tenant ref 与 reason

#### Scenario: provider 不可用

- **WHEN** provider 连接失败或返回 5xx
- **THEN** 依赖授权的 mutation MUST fail-closed 为 `identity_unavailable`
- **AND** readiness 的 `identity_provider` check MUST 呈现 unavailable，不暴露内部 endpoint

### Requirement: Runtime 接线 MUST be managed-only and default-off

runtime MUST 仅在 managed profile 读取 `WORKBENCH_IDENTITY_PROVIDER_URL`；local profile 携带该配置 MUST 启动失败。URL 非空时 `identity.NewService` MUST 收到 HTTP provider，为空时 MUST 保持 nil provider 且行为与未接线前完全一致（授权链 fail-closed 为 `needs_contract`）；URL 存在但不通过 policy 时 startup MUST fail-fast。

#### Scenario: 未配置 provider URL（默认）

- **WHEN** managed profile 启动且未设置 `WORKBENCH_IDENTITY_PROVIDER_URL`
- **THEN** provider MUST 保持 nil，readiness MUST 为 `needs_contract`
- **AND** project 授权 mutation MUST 保持 `identity_unavailable` fail-closed，与现状一致

#### Scenario: local profile 尝试配置 provider

- **WHEN** local profile 进程环境携带 `WORKBENCH_IDENTITY_PROVIDER_URL`
- **THEN** startup 校验 MUST 以「only supported by managed profile」语义拒绝
- **AND** local loopback local-session 工作流 MUST 不受影响

#### Scenario: managed 配置非法 URL

- **WHEN** managed profile 配置的 provider URL 不通过 loopback-or-HTTPS policy
- **THEN** startup MUST fail-fast 并给出脱敏错误
- **AND** runtime MUST NOT 以 nil provider 回退继续运行
