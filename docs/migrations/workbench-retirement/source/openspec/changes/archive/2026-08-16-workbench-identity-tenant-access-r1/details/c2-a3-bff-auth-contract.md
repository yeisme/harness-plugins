# C2-A3 Managed BFF Auth Contract 实现记录

## 状态

`C2-A3` contract baseline 已实现并通过测试。当前交付只证明 browser/BFF HTTP 形状、同源 CSRF client、contract fixture 与 fail-closed UI authority boundary 一致；它不包含 server-side session repository、cookie issuance、Identity exchange、tenant switch transaction 或真实 provider。因此 promotion 状态最高为 `contract_validated`。

## 路由合同

合同版本：`workbench.auth.v0.1`。

| Route | Method | 当前 client/fixture 覆盖 | 真实实现依赖 |
|---|---|---|---|
| `/auth/session` | GET | safe Session + memory-only `X-CSRF-Token` bootstrap | C2-B2/B3 |
| `/auth/login` | POST | provider/return allowlist + controlled continuation | C2-B3/B4 |
| `/auth/callback` | GET | fixture 303 到 allowlisted path | C2-B3/B4 |
| `/auth/tenant/select` | POST | membership + expected revision + CSRF | C2-B2/B3/B4 |
| `/auth/tenant/switch` | POST | membership + expected revision + CSRF | C2-B2/B3/B4 + C2-C cleanup |
| `/auth/refresh` | POST | expected revision + CSRF rotation | C2-B2/B4 |
| `/auth/logout` | POST | expected revision + CSRF，成功后 client 清内存 proof | C2-B2/B3/B4 |
| `/auth/session/events` | GET | safe resumable SSE fixture shape | C3-A1/A2 |

callback 与 login continuation 只允许 BFF 控制的 same-origin path。普通 return path 只允许 `/overview`、`/connections`、opaque `/workspace/{owner}/{project}` 与 `/tasks/{task}`；拒绝 absolute/protocol-relative URL、query、fragment、percent encoding、backslash、path traversal 与 `/auth/callback` 自引用。

## 浏览器 AuthSessionClient

- 只允许与 browser exact same-origin 的 HTTP(S) origin；使用 `credentials=same-origin` 和 `redirect=manual`。
- 不接受/发送 browser `Authorization`，也不读取 cookie；cookie 始终由浏览器 HttpOnly custody 管理。
- CSRF proof 使用 JavaScript private field，只从 `X-CSRF-Token` 读取，在 login/select/switch/refresh 时轮换，在 logout 后清除；不写 localStorage、共享 SDK model、日志或 diagnostic。
- mutation 在没有 bootstrap CSRF 时本地返回 `failed_precondition`，不会发网络请求。
- 响应最多 1 MiB；invalid JSON、unsafe continuation、malformed Session/result 与 unknown contract fail-closed 为 `contract_mismatch`。
- stable error 只暴露批准 code；新增 `session_revision_conflict`，不保留 provider payload。

## Contract fixture 与状态门

MSW fixture 覆盖全部 `/auth/*` 合同，并记录安全 request metadata 用于断言。fixture 固定 readiness：

```text
state=contract_validated
identity_provider=needs_contract
diagnostic=fixture_contract_only
```

`deriveAuthBoundary` 要求 `readiness=ready` 且 managed Session `state=active` 才发布 managed authority；即使 fixture 返回 active-looking Session，也保持 `needs_contract`。local session 永远明确为 `local_session`，不获得 managed tenant authority。

production/dev local BFF 已显式保留 `/auth/*`：在 managed BFF 未配置时返回 HTTP 424 `identity_needs_contract` + `Cache-Control: no-store`，不再错误回退到 SPA `index.html`。

## 验证

```bash
task identity:bff-contract:test
task test:identity-bff-contract:component
bun run typecheck
```

最新通过证据：`temp/integration-test-runs/20260720102835-8f1ea56e-3235-446c-a200-ef2c4428e45f`；`layer=component`、`status=passed`、`exit_code=0`。

## 下一步

1. `C2-B1`：新增 local/managed BFF validated config；managed 缺 session DB、Identity contract、cookie key、CSRF key、audit prerequisite 时 fail-fast。
2. `C2-B2`：用 Drizzle + PostgreSQL 建立 session repository、migration CLI、expected revision 与 rotation transaction。
3. `C2-B3`：实现 `__Host-yeisme_workbench` cookie、Host/Origin/CSRF middleware、fixation/open-redirect/two-tab conflict tests。
4. `C2-B4`：实现 bounded Identity login/exchange/refresh client，固定 live contract digest 与 error redaction。
5. `C2-B5`：managed proxy 从 server session 注入短期 PrincipalContext，浏览器 cookie/Authorization 不转发到 workbenchd/Owner。
