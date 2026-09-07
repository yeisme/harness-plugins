# C2-B3 Managed Request Security 实现记录

## 状态

Managed BFF 的 secret custody、opaque session cookie、CSRF proof 与 request authority policy baseline 已实现。该阶段完成可独立验证的安全内核，但尚未接入真实 login/callback/tenant switch/logout route；managed startup circuit breaker 继续保留，能力不得标记为 available。

## Secret Custody

- cookie、CSRF、context key 只从 managed config 指定的绝对文件读取。
- 使用 `lstat`、`O_NOFOLLOW` 与 open 后 inode/device/size 复核，拒绝 symlink、非 regular file 与换文件竞态。
- 拒绝 group/other permissions、少于 32 bytes、超过 4 KiB 与三把 key 内容重复。
- 错误只输出稳定 code，不输出 key bytes、文件路径或底层 I/O error；JSON/diagnostic 只表示 loaded/distinct 状态。
- keyed digest 使用 HMAC-SHA-256；cookie、CSRF 与 context key 不复用。

## Cookie 与 CSRF

- Cookie 名固定为 `__Host-yeisme_workbench`；原始值与 CSRF proof 均为 32-byte CSPRNG base64url opaque credential。
- `Set-Cookie` 固定 `Secure; HttpOnly; SameSite=Lax; Path=/`，不允许 `Domain`；clear 使用同一安全属性与 `Max-Age=0`。
- repository projection 只有 `idDigest` 与 `csrfDigest`；issued credential 使用 JavaScript private fields，安全 JSON 不含原始值。
- Cookie header 上限 8 KiB，拒绝 CR/LF/NUL、重复 session cookie、非法 base64url 与错误长度。CSRF proof 由 cookie 原值经独立 key HMAC 派生，使页面刷新可重新 bootstrap；repository 仍只保存 proof digest。
- CSRF 通过 separate key HMAC 后使用 constant-time digest compare；错误 token 不回显。

## Request Authority Policy

- `WORKBENCH_PUBLIC_ORIGIN` 是唯一 authority；所有受保护请求 exact Host，mutation 还必须 exact Origin。
- 不采信 `X-Forwarded-Host`、query、return path、浏览器 Authorization 或任意 tenant header 作为 authority。
- mutation 只接受 `POST/PUT/PATCH/DELETE` 与 `application/json`（可带 UTF-8 charset）；缺 Origin、跨站、form/multipart 均拒绝。
- Cookie digest 加载 server session 后检查状态、idle/absolute expiry、CSRF digest 与 expected uint64 revision。
- 成功只返回 `sessionIdDigest` 与 `sessionRevision`；stale revision 使用稳定 `session_revision_conflict`。

## 验证

```bash
task identity:bff-security:test
task test:identity-bff-security:component
```

覆盖矩阵：private regular key、symlink/0644/弱 key/重复 key、opaque issuance、安全序列化、cookie attributes、duplicate/malformed/oversized cookie、CSRF success/failure、bad Host、missing/cross-site Origin、非 JSON content type、missing/inactive/expired session 与 stale revision。

最新 component 证据：`temp/integration-test-runs/20260720105732-93ac8e70-fbbf-4848-b662-f8c1b0daee73`，`status=passed`、`exit_code=0`；命令、stdout/stderr、环境摘要与 artifacts 目录均由 evidence runner 生成并完成 secret-shaped scan。

## 未完成门

1. C2-B2 真实 PostgreSQL integration 仍需显式 disposable DSN。
2. C2-B4/B5 已实现 Identity transaction/exchange/refresh/revoke client、one-time login transaction 与 Bun managed routes。
3. C2-C 继续实现 tenant select/switch、两标签页冲突与 authority cleanup。
4. Session SSE 已有单实例有界连接 baseline；跨实例 distributed admission、Identity revoke source 与 browser e2e 仍需后续 gate。
