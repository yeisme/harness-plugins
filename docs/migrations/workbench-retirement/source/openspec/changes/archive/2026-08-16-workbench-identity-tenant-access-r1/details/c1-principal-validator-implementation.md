# C1 Principal 验证器实现记录

## 当前结论

Workbench 已完成 C1 中 workbenchd consumer 的第一段可运行实现，但 R1 仍保持未完成。该实现只证明 provider-neutral PrincipalContext 验证边界，不证明真实 Identity provider、BFF browser session、多租户切换、撤销传播或生产发布门禁。

## 已实现范围

- managed 与 local profile 认证配置互斥：local 只接受私有 token file；managed 必须提供 PostgreSQL 与 Identity 配置，且禁止 local token fallback。
- 固定验证 approved asymmetric algorithm、`kid`、issuer、`aud=workbench`、时间/skew、最多 600 秒 TTL、required opaque refs、membership version、actor、scope、可选 `amr` 与 `jti`。
- JWKS 只允许 issuer 同源 HTTPS；拒绝 redirect、错误媒体类型、超过 1 MiB、超过 64 keys、重复 `kid`、不兼容 key/algorithm；支持 Ed25519、P-256 与 RSA-2048+ 公钥。
- 未知 `kid` 每个 token 最多触发一次强制 refresh；key endpoint 不可用映射为 `identity_unavailable`，错误 token 映射为 `authentication_required`。
- HTTP 与 gRPC 统一消费 `BearerVerifier` 和安全 Principal 投影；managed readiness 在 JWKS 从未加载或缓存过期且无法刷新时失败。
- Task 幂等 caller namespace 使用 issuer/subject/tenant/membership/version/actor 的版本化 SHA-256 摘要；权限 scopes 独立保存，避免同权限的不同 principal 共享幂等键，也不把原始身份 ref 写入 Task 投影。
- CLI/environment 支持 issuer、audience、JWKS、algorithm、TTL、clock skew 与 HTTP timeout；日志与错误不回显 endpoint 或 token。

## 可执行验证

```bash
task identity:validator:test
task test:identity-validator:component
task test:identity-security
```

Component 目标通过 evidence runner 写入标准六件套。fixture 使用 disposable TLS JWKS，因此 capability 状态最多为 `contract_validated`，不得替代 `task test:identity-integration` 的真实 provider/PostgreSQL/BFF 证据。

## 尚未满足的 R1 依赖

1. Identity provider owner/submodule、discovery/contract digest 与 live canary。
2. BFF login transaction、session exchange、opaque cookie、CSRF 与 session rotation。
3. Tenant list/selection/switch reducer，以及 tenant-bound cache/SSE/Pane 原子清理。
4. Membership projection、version freshness、revocation event cursor 与 online high-risk check。
5. Operation policy、allowed actions、service identity 与 Owner delegation。
6. Identity audit/metrics、PostgreSQL integration、browser/security/system tests、staging soak/revoke/rollback drill。

因此 `tasks.md` 中 `1.3`、`3.1`、`3.5` 不应关闭；后续实现应以本文件证据为 C1 partial handoff，而不是将 managed identity 标记为 `available`。

完整 C2/C3 session、tenant switch、cache/SSE/layout isolation、revocation 与 policy 工作流见 `details/c2-c3-session-tenant-revocation-workflow.md`。
