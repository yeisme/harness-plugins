# Identity Provider / Workbench Consumer 对接包

## 1. 当前状态与 Owner

| Item | Owner | Current state | Required change |
| --- | --- | --- | --- |
| 根身份架构 | root `unified-multitenant-login-v1` | strict design 存在 | 保持 User/Tenant/Membership owner 决策 |
| Identity provider | `backend-server/identity-platform` | 目录/可运行 owner 当前不存在 | 创建独立 submodule 与 `identity-platform-google-lark-login-v1` |
| Workbench consumer | `client/yeisme-workbench` | R1 spec 已建立 | 按本 handoff 接入，不实现 provider |
| Owner delegation consumer | Scaena/Auctra/Eikona 等 | 合同成熟度不一 | 各 provider OpenSpec 接受 audience/delegation contract |

Identity provider 不可用时，Workbench managed identity、Team mutation 与 Owner delegated mutation 必须保持 `needs_contract`；local preview 可继续，但不能作为 production evidence。

## 2. Contract Identity

Provider 必须发布：

```text
contract_id: yeisme.identity.platform
contract_version: 1.x
schema_digest: sha256:...
issuer: approved HTTPS issuer
supported_audiences: [workbench, scaena, auctra, ...]
session_modes: [browser]
context_modes: [audience_token, delegated_context]
event_cursor: opaque resumable cursor
```

Workbench consumer 配置固定 supported range，不接受请求级 contract/version/issuer override。未知 required field、unsupported major、digest mismatch 或 issuer mismatch 返回 `contract_mismatch`。

## 3. Required Provider Endpoints

具体路径可由 Identity OpenAPI 冻结，但必须覆盖以下 typed capability：

| Capability | Required behavior |
| --- | --- |
| discovery | 返回 contract/version/digest、issuer、JWKS URI、capability、limits，不返回 secret |
| auth transaction | 创建 allowlisted browser login transaction，返回 opaque transaction ref |
| session exchange | 用 Kratos 已验证 session/一次性 receipt 创建 platform session，幂等防 replay |
| current session | 返回 session state、auth time、reauth state 与安全 user projection |
| tenant list | 只返回 active membership 可见 tenant + membership ref/version |
| tenant select | 显式验证 membership，并签发 `aud=workbench` 的短期 PrincipalContext |
| session revoke/logout | 撤销 platform session 并传播 revoke event |
| membership authorize/freshness | 按 membership ref/version、tenant、risk/operation 返回当前状态或稳定拒绝 |
| member list | 返回 tenant member 安全投影、version、freshness、allowed commands |
| invite/accept/remove/role | typed command、idempotency、expected version、receipt/status/reconcile |
| token exchange/delegation | 后端以 workload identity + active actor context 获取 owner-audience authority |
| events | resumable membership/session/tenant/key lifecycle events |

所有 mutation 必须具有 idempotency key、expected version、receipt/status 查询和 `unknown_accept` 对账语义。

## 4. PrincipalContext Minimum Claims

```json
{
  "iss": "https://identity.example.com",
  "aud": "workbench",
  "sub": "usr_opaque",
  "sid": "ses_opaque",
  "tenant_id": "ten_opaque",
  "membership_id": "mem_opaque",
  "membership_version": 7,
  "actor_type": "human",
  "scope": ["workbench.read"],
  "amr": ["social", "google"],
  "auth_time": 1784236800,
  "iat": 1784236800,
  "exp": 1784237400,
  "jti": "ctx_opaque"
}
```

约束：

- 默认 TTL 5-10 分钟，最终值由 provider SLO/security review 冻结。
- `scope` 不嵌入完整 role/permission graph；高风险 operation 仍校验 membership version/freshness。
- token 不包含全部 tenant、provider token、email、完整 profile、billing 或 Owner resource permission。
- Workbench 不接受 `tenant_id` header/query 覆盖 token tenant。
- `aud=workbench` token 不得转发给 Owner。

## 5. Required Events

| Event | Required safe fields | Workbench action |
| --- | --- | --- |
| `session.revoked` | event id/cursor、session ref、occurred at、reason code | revoke BFF session、清 cache/token/SSE |
| `membership.created` | tenant/membership refs、version、status | 更新 tenant choice projection |
| `membership.changed` | refs、old/new version、status | invalidate policy/cache，要求新 context |
| `membership.revoked` | refs、version、occurred at | 拒绝新请求并撤销绑定 session |
| `tenant.suspended` | tenant ref、version、reason code | tenant 全部请求 fail-closed |
| `identity.signing_key.rotated` | key id、not-before、retire-at | bounded JWKS refresh |
| `identity.contract.changed` | contract version/digest、effective-at | compatibility check/capability downgrade |

事件不得包含 provider payload、cookie/token、email、完整用户资料或敏感管理员备注。Workbench 只承诺 source-local cursor，不伪造全局 exactly-once 顺序。

## 6. Delegation Contract

Workbench 调用 Owner 时必须同时证明：

1. caller 是批准的 Workbench workload identity；
2. delegated actor 的 subject/tenant/membership version 有效；
3. audience 与目标 Owner 匹配；
4. scopes/operation/ref 受限；
5. delegation 有短 TTL、token/delegation id、correlation 与 audit ref；
6. Owner 继续执行自己的 object-level/domain authorization。

允许 provider 选择 owner-audience short-lived token 或 signed delegation receipt，但合同必须 versioned、不可由浏览器构造、不可把 service identity 当作最终用户 permission，也不可接受 Workbench audience token 原样转发。

## 7. Stable Errors

Provider 至少区分：

```text
unauthenticated
session_expired
reauth_required
tenant_selection_required
tenant_not_found
membership_inactive
membership_stale
permission_denied
organization_not_provisioned
identity_conflict
callback_replayed
contract_mismatch
rate_limited
identity_unavailable
unknown_accept
```

Workbench 映射必须保持 code/retry/reconcile 语义，不把 provider error message/raw body 直接返回浏览器或写入 evidence。

## 8. Compatibility and Promotion

```text
planned
  -> needs_contract
  -> contract_validated
  -> integration_ready
  -> canary
  -> available
```

- `contract_validated`：OpenAPI/JWKS/event/schema digest + fixture parity 通过。
- `integration_ready`：disposable Identity/Postgres + Workbench contract/integration/security 通过。
- `canary`：真实 test identity/tenant、revoke/key rotation/outage/rollback 通过。
- `available`：批准 SLO、安全 review、audit completeness 与 kill switch/rollback 就绪。

任何阶段缺失 provider owner、真实 integration 或 revoke evidence，必须降级为 `needs_contract`/`degraded`，不得用 UI 完成度、fixture、MSW、截图或 local token替代。

## 9. Cross-Project Task Order

1. Root 创建并注册 `backend-server/identity-platform` 独立 submodule/profile/OpenSpec owner。
2. Identity provider 发布 OpenAPI、JWKS/discovery、GORM migrations、session/tenant/member、audit/outbox/events 与 test evidence。
3. Workbench 运行只读 contract canary，冻结 supported range/digest/fixtures。
4. Workbench 实现 BFF session、Principal validation、tenant switch、revoke/policy/readiness。
5. Identity/Workbench 完成真实 disposable integration 与 security matrix。
6. Workbench 实现 Team mutations及 receipt/reconcile。
7. Identity + Workbench + 首个 Owner 联合冻结 delegation contract。
8. Scaena/Auctra 等 Owner 在自己的 OpenSpec 实现 audience/delegation validation。
9. staging soak、revoke/key rotation/rollback drill 后按 capability 独立晋级。

## 10. Acceptance Evidence

- Provider strict OpenSpec、OpenAPI/schema digest、`CGO_ENABLED=0` tests。
- Workbench strict R1、four-transport parity、BFF/session/security tests。
- disposable Identity + PostgreSQL + Workbench integration 六件套。
- Google/Lark test identity browser E2E；不得使用普通用户或 production tenant。
- cross-tenant same-name resource/cache isolation。
- session/membership revoke enforcement window、JWKS rotation、Identity outage。
- service/human credential confusion 与 Owner audience/delegation tests。
- audit/redaction scan、24h staging soak、rollback dry-run。
