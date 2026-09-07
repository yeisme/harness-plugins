# C2-B5 Managed Runtime 与 Auth Routes 实现记录

## 状态

正式 Bun host 已接入 managed production composition baseline。启动会校验 secret custody、Identity contract/digest 与 PostgreSQL session/login transaction schema；运行时已支持 unauthenticated bootstrap、login、continue、callback exchange、safe session、refresh、logout、tenant select/switch、有界 session SSE、durable revoke consumer core，以及 active server context 的 read-only workbenchd proxy。mutation proxy、真实 Identity event source 与 live integration 尚未完成，因此 R1 仍不关闭。

## 启动与关闭

- `createProductionWebHost` 明确区分 local/managed；managed 禁止 local token fallback。
- 并行读取三类 session key、service bearer 与 Identity contract seal，随后用 Drizzle repository 对 session/tombstone/login transaction 表做只读 startup probe。
- 任一 secret、contract、database 或 schema failure 只返回固定 `Managed BFF initialization failed`，不回显路径、DSN、endpoint 或底层错误。
- `server/index.ts` 使用异步初始化，并在 SIGINT/SIGTERM 停止 listener、关闭 PostgreSQL pools。

## Auth Flow

1. `GET /auth/session` 在无 cookie 时签发 pre-auth `__Host-yeisme_workbench` 与派生 CSRF proof，返回 safe unauthenticated projection。
2. `POST /auth/login` 验证 exact Host/Origin、JSON、cookie/CSRF、provider 与 return allowlist；生成 callback state 并创建 Identity transaction。
3. login transaction 绑定 provider transaction、state 与发起浏览器 cookie digest；`GET /auth/login/continue/:ref` 只跳转到 sealed Identity 同源固定路径。
4. `GET /auth/callback` 只接收 transaction/state/one-time receipt，不接收 Google/Lark code/token；消费成功后 exchange Identity grant、签发新 session cookie 并创建 server Session。
5. `POST /auth/refresh` 验证 expected revision/CSRF 与 subject/session/tenant binding，更新 context expiry 与 private in-memory context vault。
6. `POST /auth/logout` 先撤销 Identity session，成功后删除本地 Session、写 tombstone、清 context 与 cookie。

## Proxy Isolation

- managed workbenchd proxy 当前只允许 GET/HEAD；mutation 在 authority cleanup 与 SDK revision contract 完成前返回 fail-closed。
- 每次请求从 opaque cookie digest 加载 active Session，再从 private context vault 取得短期 `aud=workbench` context。
- 浏览器 `Authorization`、Cookie、proxy/forwarded/connection/host headers 全部剥离；上游只收到 server-held context bearer。
- context token 不进入响应、JSON、log、evidence 或 PostgreSQL；进程重启后 Session 返回 `context_refresh_required`，由显式 refresh 恢复。

## 验证

```bash
task identity:bff-managed:test
task test:identity-bff-managed:component
```

后续 C2-C/C3-A2 已在 managed handler 上增加 `/auth/session/events` cookie/session 验证、共享 session store polling、cursor resume、heartbeat 与连接限流；详细客户端和证据见 `details/c2-c2-authority-runtime-ui.md`、`details/c3-a2-session-event-stream.md`。

覆盖 login/callback/session/refresh/logout happy path、pre-auth browser binding、CSRF reload bootstrap、safe session projection、Identity revoke-before-local-delete、context vault expiry、managed proxy browser credential stripping 与 local mode regression。

最新 component 证据：`temp/integration-test-runs/20260720113755-a9eb34c3-323e-4d4c-a4b8-7d13b46c3fc3`，`status=passed`、`exit_code=0`；evidence runner 已生成六件套并完成 credential/PII/private path 脱敏扫描。

## 未完成门

1. 使用 disposable Identity + PostgreSQL 执行真实 login/exchange/refresh/revoke/select/switch integration。
2. C2-C 已实现 tenant select/switch、session id/CSRF rotation、AuthorityProvider/UI 与 cleanup baseline；仍需 remaining Pane/recent/approval/mutation context 和 managed browser race gate。
3. 为普通 Task mutation 冻结 session revision header/SDK contract 后开放 managed mutation proxy。
4. C3 在已完成 durable inbox/cursor consumer core 上继续增加 Provider source/lease/gap recovery、freshness/policy、telemetry 与跨实例 admission。
