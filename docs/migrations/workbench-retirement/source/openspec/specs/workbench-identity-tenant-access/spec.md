# workbench-identity-tenant-access Specification

## Purpose
TBD - created by archiving change workbench-identity-tenant-access-r1. Update Purpose after archive.
## Requirements
### Requirement: Identity authority MUST provider-first

Workbench MUST 只接受 Identity Platform 发布的 User、Tenant、Membership、session 与 PrincipalContext 合同作为 managed identity authority；provider 合同缺失或不兼容时 MUST fail-closed。

#### Scenario: Identity provider 尚未交付
- **WHEN** `backend-server/identity-platform` 没有可验证的 discovery、JWKS、session/member API 或 event contract
- **THEN** managed identity capability MUST 返回 `needs_contract` 或 `contract_mismatch`
- **AND** Workbench MUST NOT 创建本地 production user/tenant、解析 Google/Lark token 或伪造登录成功

#### Scenario: 外部 claim 试图指定 tenant
- **WHEN** query、header、Studio return、Owner projection 或外部 provider token携带 tenant 标识
- **THEN** Workbench MUST 将其视为 selector 或不可信输入
- **AND** 最终 tenant authority MUST 来自已验证 PrincipalContext 与 active membership

### Requirement: Browser session MUST hide provider credentials

Workbench managed Web MUST 使用同源 BFF 和受保护的 opaque session cookie；浏览器 MUST NOT 接收或持久化 provider token、Identity context token、service credential 或 refresh token。

#### Scenario: 完成登录回调
- **WHEN** Identity/Kratos 完成 Google 或 Lark browser flow
- **THEN** Workbench BFF MUST 只接收一次性 transaction receipt 并在服务端完成 session exchange
- **AND** cookie MUST 使用 `Secure`、`HttpOnly`、受控 `SameSite`、限定 path/domain 和 session rotation

#### Scenario: 伪造 return URL 或 CSRF
- **WHEN** login `return_to` 不在 allowlist，或 state-changing request 的 Origin/Host/CSRF/session revision 不匹配
- **THEN** BFF MUST 在调用 Identity 或 workbenchd 前拒绝请求
- **AND** 响应 MUST NOT 泄露 cookie、OAuth code、内部 URL 或验证细节

### Requirement: PrincipalContext MUST be fully validated

workbenchd MUST 按签名、算法、issuer、audience、time、required claims、actor type、tenant/membership binding 与 freshness 的固定顺序验证短期 PrincipalContext。

#### Scenario: Wrong audience token
- **WHEN** token 签名有效但 audience 不是 Workbench
- **THEN** 请求 MUST 返回 `authentication_required`
- **AND** token MUST NOT 被转发给 Owner 或写入日志/evidence

#### Scenario: Signing key rotation
- **WHEN** token 使用未知 `kid`
- **THEN** validator MUST 只执行一次 bounded JWKS refresh
- **AND** refresh 失败时 MUST fail-closed，不得忽略签名或接受旧算法

### Requirement: Tenant selection and switch MUST be explicit and atomic

用户拥有多个 active membership 时，Workbench MUST 要求服务端确认的显式 tenant selection；tenant switch MUST 原子更新 authority 并清除所有 tenant-bound 客户端和服务端状态。

#### Scenario: 多 tenant 登录
- **WHEN** session exchange 返回多个可用 tenant 且没有有效恢复选择
- **THEN** Workbench MUST 进入 `tenant_selection_required`
- **AND** MUST NOT 默认选择最近 tenant、query tenant 或第一个 tenant

#### Scenario: Tenant switch 成功
- **WHEN** Identity 验证目标 membership active 并签发新 context
- **THEN** BFF MUST 轮换 session id 并原子更新 tenant/membership binding
- **AND** Workbench MUST 清除 query cache、SSE cursor、Pane selection、recent resource、pending approval 与 token cache

#### Scenario: Tenant switch 失败
- **WHEN** 目标 membership 已撤销、Identity 不可用或新 context 无效
- **THEN** 旧 tenant authority MUST 保持不变
- **AND** UI MUST NOT 预先展示目标 tenant 数据

### Requirement: Cross-tenant isolation MUST cover cache, stream, and resource lookup

所有缓存、cursor、layout resource ref、authorization decision 和 request context MUST 绑定 subject、tenant、membership version 与必要的 resource version；跨 tenant 资源探测 MUST 使用安全不存在语义。

#### Scenario: 两个 tenant 有同名资源
- **WHEN** 同一用户在 tenant A 与 tenant B 拥有相同 workspace/project/resource display name
- **THEN** Workbench MUST 以 tenant-bound opaque ref 和 cache key 隔离两组数据
- **AND** tenant switch 后 MUST NOT 显示前一 tenant 的缓存、事件或 Pane selection

#### Scenario: 猜测其他 tenant resource ref
- **WHEN** principal 使用其他 tenant 的 opaque resource ref 查询对象
- **THEN** Workbench MUST 返回安全 404 或等价 tombstone 投影
- **AND** MUST NOT 暴露资源存在性、owner、title 或 permission 细节

### Requirement: Membership freshness and revocation MUST fail closed

Workbench MUST 使用 membership version、短期 context、可恢复 revocation event 和按风险在线检查共同控制权限 freshness。

#### Scenario: Membership revoked
- **WHEN** 收到 `membership.revoked`、`tenant.suspended` 或 `session.revoked` event
- **THEN** Workbench MUST 撤销匹配 session、清除 token/cache/SSE 并拒绝新请求
- **AND** 已发送 Owner mutation MUST 进入正常 receipt/reconcile 流程，不得伪造 cancelled

#### Scenario: High-risk mutation uses stale membership
- **WHEN** invite、role change、remove、export、handoff 或其他 high-risk mutation 的 membership version 不是当前版本
- **THEN** Workbench MUST 返回 `membership_stale` 或 `membership_inactive`
- **AND** MUST NOT 使用缓存许可或自动重放 mutation

#### Scenario: Identity temporarily unavailable
- **WHEN** Identity API 离线但本地有未过期签名、JWKS 和 freshness cache
- **THEN** bounded low-risk read MAY 继续并标记 identity `degraded`
- **AND** login、refresh、tenant switch 与 high-risk mutation MUST fail-closed

### Requirement: Authorization MUST use explicit policy decisions

每个受保护 operation MUST 使用 PrincipalContext、operation descriptor、tenant/resource refs、Owner capability、risk、version、cost 与 approval gate 计算服务端 policy decision；UI allowed actions MUST 来自该 decision。

#### Scenario: UI 隐藏按钮但直接调用 API
- **WHEN** 用户绕过 UI 直接提交未授权 operation
- **THEN** 服务端 MUST 重新计算 authorization decision 并返回 `permission_denied`
- **AND** MUST 写入脱敏 decision/audit metadata

#### Scenario: Cached allow decision after role change
- **WHEN** membership version 或 policy version 已变化
- **THEN** 旧 allow decision MUST 失效
- **AND** 新请求 MUST 使用新版本重新决策

### Requirement: Human, automation, and service identity MUST be distinct

Workbench MUST 区分 `human`、`automation` 与 `service` actor；browser session、automation credential 和 workload identity MUST NOT 互相替代。

#### Scenario: Service credential used as user authorization
- **WHEN** workbenchd workload credential 调用需要最终用户许可的 Owner operation
- **THEN** Owner call MUST 同时包含可验证 delegated actor context 或 delegation receipt
- **AND** service credential 本身 MUST NOT 被解释为用户 permission

#### Scenario: Workbench token forwarded to Owner
- **WHEN** connector 准备调用 Owner
- **THEN** `aud=workbench` context MUST NOT 被原样转发
- **AND** 后端 MUST 使用 Identity token exchange 或批准的 delegation contract 获取 owner-audience authority

### Requirement: Team projection and mutations MUST preserve Identity ownership

Workbench MAY 缓存 Tenant/Member 安全投影，但 invite、accept、remove 与 role change MUST 调用 Identity Platform typed command，并使用 idempotency、expected version、approval 与 receipt/reconcile 语义。

#### Scenario: Role change succeeds
- **WHEN** authorized admin 提交 role change 且 expected membership version 匹配
- **THEN** Workbench MUST 保存 Identity receipt ref 和新 source version
- **AND** MUST 等待 owner projection/event 确认后更新 Team UI

#### Scenario: Team mutation response times out
- **WHEN** Identity 可能已接受 mutation 但响应超时
- **THEN** Task MUST 进入 `unknown_accept`
- **AND** Workbench MUST 使用原 idempotency key、receipt/status lookup 对账，不得自动再提交

### Requirement: Local and managed identity profiles MUST remain explicit

local profile MUST 继续使用 loopback local-session 且明确标识非多租户 authority；managed profile MUST 配置 approved identity、session、cookie、CSRF、service identity 与 audit prerequisites。

#### Scenario: Managed auth config incomplete
- **WHEN** issuer、audience、JWKS/discovery、session store、cookie/CSRF policy、service identity 或 audit sink 缺失
- **THEN** managed startup MUST fail-fast 或 identity readiness MUST 为 false
- **AND** MUST NOT 回退到 local bearer token

#### Scenario: Local preview starts
- **WHEN** 开发者使用 local profile 启动预览
- **THEN** 现有 loopback workflow MUST 继续工作
- **AND** UI/diagnostics MUST 明确显示 `local-session`，其测试证据 MUST NOT 被当作 managed identity evidence

### Requirement: Identity readiness MUST distinguish hard failure and degradation

系统 MUST 将 liveness、identity readiness 与 capability degradation 分离，并根据 key、session store、policy、event cursor 和 provider可用性决定接流量范围。

#### Scenario: JWKS never loaded
- **WHEN** managed runtime 从未成功加载 approved signing key，或 policy registry/session store 不可用
- **THEN** `/healthz` MAY 保持成功
- **AND** `/readyz` MUST 返回不就绪且不泄露内部 endpoint 或 key material

#### Scenario: Revocation cursor exceeds lag threshold
- **WHEN** revoke event cursor 无法恢复且 lag 超过批准阈值
- **THEN** identity readiness MUST 失败或所有依赖 freshness 的 operation MUST fail-closed
- **AND** diagnostics MUST 只暴露 safe component status 与 correlation ref

### Requirement: Identity audit and telemetry MUST be complete and redacted

Workbench MUST 审计 login/session exchange、tenant select/switch、membership denial/revoke、role/invite mutation、authorization decision、service delegation 和 privileged operation；普通日志、trace、metrics 与 evidence MUST 脱敏。

#### Scenario: Permission denied
- **WHEN** operation 因 scope、membership、resource 或 policy 被拒绝
- **THEN** audit MUST 记录 safe actor/tenant/session ref、operation、reason code、policy/membership version、correlation 与时间
- **AND** MUST NOT 记录 token、cookie、email、provider payload、完整 profile 或资源正文

#### Scenario: Audit sink unavailable
- **WHEN** privileged mutation 无法写入 required audit sink
- **THEN** mutation MUST fail-closed 或进入批准的 durable buffer
- **AND** telemetry failure MUST NOT 把 secret 写入 fallback log

### Requirement: Identity contracts MUST maintain transport parity and evidence

Workbench 新增 principal、tenant、membership、session、allowed actions 与 identity readiness 投影时，HTTP、gRPC、JSON-RPC 和 TypeScript SDK MUST 保持同一版本、错误、redaction 与 capability 语义。

#### Scenario: Contract parity run
- **WHEN** contract suite 对四个 transport 调用 current principal、tenant list/switch 和 access projection
- **THEN** safe fields、version、errors 与 freshness MUST 一致
- **AND** unknown required field 或 incompatible schema MUST 返回 `contract_mismatch`

#### Scenario: Managed identity integration run
- **WHEN** disposable Identity/PostgreSQL/Workbench 环境执行 login、switch、revoke、key rotation、outage 和 cross-tenant tests
- **THEN** run MUST 写入 `temp/integration-test-runs/<run-id>/` 六件套与 contract/policy digest
- **AND** evidence MUST 通过 token、cookie、OAuth code、provider payload、PII 与 private path redaction scan

### Requirement: Identity provider discovery MUST be machine-verifiable and bounded

Identity provider MUST 发布 `contractId=yeisme.identity.platform`、supported `1.x` SemVer、SHA-256 schema digest、HTTPS issuer、same-origin JWKS、approved audience/session/context modes、versioned capabilities、PrincipalContext policy、resumable events 与 stable errors。Workbench MUST 通过固定 consumer policy 验证该合同，不得接受请求级 issuer、JWKS、algorithm、TTL 或 capability override。

#### Scenario: Compatible provider contract is probed
- **WHEN** operator 向只读 canary 提供显式 loopback discovery URL
- **THEN** canary MUST 限制 redirect、Content-Type、response bytes 与 timeout
- **AND** MUST 验证 14 个 required capability、7 个 resumable event、11 个 stable error、required claims、approved algorithm 与最多 600 秒 PrincipalContext TTL
- **AND** 输出 MUST 只包含 contract version、schema digest 与 capability/event count

#### Scenario: Provider contract is ambiguous or unsafe
- **WHEN** contract 使用 unsupported major、duplicate capability/event、HTTP issuer、cross-origin JWKS、`none` algorithm、超长 TTL、credential URL、redirect、raw token/PII/provider field 或超过 1 MiB 的 body
- **THEN** consumer MUST fail-closed 为 `contract_mismatch` 或 safe canary failure
- **AND** error/log/evidence MUST NOT 回显 provider 原始值、issuer/JWKS URL、token、PII 或 private endpoint

#### Scenario: Only fixture contract is available
- **WHEN** consumer unit tests 通过但没有 live Identity provider schema digest 与 integration evidence
- **THEN** Workbench MAY 继续实现 interfaces、config 与 fail-closed behavior
- **AND** managed identity capability MUST 保持 `needs_contract`，不得晋级 `available`

