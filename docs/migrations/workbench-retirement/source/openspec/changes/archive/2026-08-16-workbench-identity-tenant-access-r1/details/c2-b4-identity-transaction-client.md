# C2-B4 Identity Transaction Client 实现记录

## 状态

Managed BFF 的 Identity consumer baseline 已实现：contract seal、service identity、bounded HTTP client、private credential envelope、one-time login transaction domain、Drizzle schema/migration 与 PostgreSQL repository。由于独立 Identity Provider 当前未交付，且 Bun auth routes 尚未组合这些组件，本阶段只形成 component-ready consumer，不发布 managed login capability。

## Contract Seal

- startup loader 只接受固定 HTTPS contract URL，禁止 credential/query/fragment/redirect。
- response 必须为 `application/json` 且最多 1 MiB；invalid JSON、超限、网络错误与 redirect fail-closed。
- 复用 consumer canary 的完整 capability/event/error/PrincipalContext 校验，并强制配置 `schemaDigest` exact match。
- seal 使用 JavaScript private field 保存 API origin；安全 JSON 只暴露 contract version、schema digest 与 validated 状态。
- `IdentityTransactionClient` 构造必须接收 nominal `IdentityContractSeal`，请求级参数不能覆盖 origin/version/digest。

## Service Identity 与 HTTP 边界

- `WORKBENCH_IDENTITY_SERVICE_TOKEN_FILE` 使用与 session secret 相同的 regular/non-symlink/private permission/size gate。
- service bearer 仅在请求瞬间通过 callback 取得，不进入 config JSON、diagnostic、错误或 evidence。
- 固定调用 `POST /v1/auth/transactions`、`POST /v1/session/exchange`、`POST /v1/session/refresh`；禁止 redirect、自动 retry 与浏览器 cookie。
- 请求固定 `Accept/Content-Type`、`Idempotency-Key` 与 `X-Identity-Schema-Digest`；exchange audience 固定 `workbench`。
- provider success envelope 必须 exact contract version/digest 且拒绝未知字段；error body 只映射批准稳定 code，不输出 detail/provider payload。
- authorization URL 必须与 validated Identity API 同源；context token 保存在 private field，安全 JSON 只表示 credential present。

## One-time Login Transaction

- 本地 browser state 为 32-byte CSPRNG base64url；provider transaction ref、state、pre-auth browser cookie binding 与 callback receipt 只持久化 domain-separated keyed digest。
- return path 复用 BFF allowlist；transaction 最长 10 分钟；pending 到 consumed 只允许一次。
- memory repository 提供 serial transaction；并发相同 callback 最多一个成功，后续稳定 `login_transaction_replayed`。
- PostgreSQL repository 使用 Drizzle、serializable transaction、`FOR UPDATE`、pending compare update 与有限 serialization/deadlock retry。
- `workbench_login_transactions` migration 由 `drizzle-kit generate` 生成，未手写 migration metadata。

## 验证

```bash
task identity:bff-identity-client:test
task test:identity-bff-identity-client:component
WORKBENCH_TEST_POSTGRES_URL='postgres://...' task test:identity-bff-identity-client:postgres
```

component 覆盖 contract drift、unsafe URL、redirect、oversized response、provider error redaction、same-origin authorization URL、private context token、no browser cookie、state/receipt digest、wrong state、expiry、replay 与 concurrent consume。无 DSN 时 PostgreSQL test 明确 skip，不计 integration evidence。

最新 component 证据：`temp/integration-test-runs/20260720111600-6d80e3b9-ad1a-4360-89e4-784730ec3b8d`，`status=passed`、`exit_code=0`；evidence runner 已生成六件套并执行脱敏扫描。

## 未完成门

1. Identity Platform 必须发布真实 OpenAPI/contract 与 disposable test environment；fixture 不能晋级 `available`。
2. C2-B5 已组合 config、secret custody、contract loader、Identity client、PostgreSQL repositories、cookie/CSRF 与 Bun auth routes；live integration 仍待 Provider/DSN。
3. callback 只能接收 Identity one-time receipt，不得处理 Google/Lark authorization code 或 provider token。
4. route wiring 后补 login success/failure/replay、single/multi tenant、logout、two-tab 与 browser network redaction e2e。
