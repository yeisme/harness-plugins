# C2-B1 Managed BFF Configuration 实现记录

## 状态

local/managed Bun BFF 配置合同与启动 fail-fast 已实现。C2-B5 已将该合同接入 production runtime composition；合法 managed 配置会继续执行 secret/contract/PostgreSQL startup probes，任一失败固定脱敏终止，不降级 local。tenant switch、mutation proxy 与 SSE 未完成前仍不得发布完整 managed capability。

## 配置边界

- local 默认模式只接受 loopback/HTTPS `WORKBENCH_HTTP_URL` 与绝对 `WORKBENCH_TOKEN_FILE`；出现任一 managed variable 即拒绝。
- managed 禁止 `WORKBENCH_TOKEN_FILE`，必须提供 HTTPS `WORKBENCH_PUBLIC_ORIGIN`、PostgreSQL session DSN、HTTPS Identity contract、`sha256:` schema digest、Identity service token file、HTTPS audit sink，以及 cookie/CSRF/context 三类绝对 secret file source。
- backend 只允许 HTTPS 或 loopback HTTP；Identity/Audit URL 固定 path，拒绝 userinfo/query/fragment。
- session idle、absolute、context TTL、clock skew 与 revoke lag 使用有界 duration parser；拒绝负值、溢出、未知后缀与超出批准范围。
- `ManagedBFFConfig` 使用 JavaScript private fields 保存 DSN、private endpoints 与 key paths；安全序列化只包含 mode、schema digest、limits 与布尔 diagnostic。
- direct handler 在未注入 managed runtime 时仍返回固定 `Managed BFF session foundation is not implemented`，防止测试/嵌入调用误启动；正式 `server/index.ts` 通过 `createProductionWebHost` 完成异步 runtime 初始化与优雅关闭。

## 验证

```bash
task identity:bff-config:test
task test:identity-bff-config:component
```

最新通过证据：`temp/integration-test-runs/20260720103340-e5cf38af-720c-4790-9014-af03b8fa7e1c`；`layer=component`、`status=passed`、`exit_code=0`，secret-shaped scan 未发现 DSN、private endpoint 或 key path。

## 后续

1. C2-B2 必须通过 Drizzle migration/service 创建 PostgreSQL session repository，不得让 handler 直接执行 SQL。
2. C2-B3 已实现 key file custody、cookie/CSRF digest 与 Host/Origin/revision policy；B4/B5 仍需完成真实 route wiring 与 startup composition。
3. C2-B4 已使用 private Identity contract URL/digest/service identity 实现 bounded client；B5 负责 startup composition 与 route wiring。
4. C2-B5 已移除正式 Bun host 的 startup circuit breaker；后续 capability promotion 仍受 live Provider/PostgreSQL、tenant switch、SSE、安全与浏览器 gate 约束。
