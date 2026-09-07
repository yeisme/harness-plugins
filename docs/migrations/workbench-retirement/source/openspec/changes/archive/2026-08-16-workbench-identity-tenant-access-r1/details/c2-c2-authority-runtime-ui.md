# C2-C2 Authority Runtime、Login/Tenant/Rescue UI 实现记录

## 状态

React Authority Runtime 与 managed auth UI baseline 已实现。应用根现在统一 bootstrap `/auth/session`，local profile 进入 `local-session`，managed profile 在未认证、tenant selection、active、stale、revoked、expired、signed-out 和 unavailable 状态之间 fail-closed 切换。

本记录只证明前端运行时与本地/组件合同。durable revoke consumer core 已完成，但真实 Identity event source、真实 PostgreSQL、managed Playwright 和 revoke SLO 尚未完成，因此 R1 仍为 partial。

## AuthorityProvider

- `AuthorityProvider` 持有 session snapshot、authority phase、revision、error 与共享 `AuthorityResourceRegistry`。
- tenant select/switch 在服务端结果返回前保持旧 authority；结果提交时先 abort request、close stream、cancel/clear query、删除旧 authority storage，再激活新 authority。
- local/managed 使用同一个 `/auth/session` 浏览器合同；Bun local host 与 Vite dev middleware 都返回无凭据的 `local_session` snapshot。
- login 只导航到 BFF 返回的 allowlisted `/auth/login/continue/<ref>`；浏览器不接收 Identity authorization URL、provider token 或 service credential。

## UI 状态

- `AuthorityGate` 在 `bootstrapping`、`unavailable` 时阻断业务数据渲染。
- `unauthenticated`、`signed_out`、`expired`、`revoked` 提供 Google/Lark approved provider login。
- `tenant_selection_required` 列出 active tenant membership，并在选择期间禁用重复提交。
- `stale` 阻止新工作流入口并提供显式 session refresh。
- local/active 才渲染 Workbench 路由；local preview 不被误标为 managed authority。

## Query、事件与跨标签页隔离

- `authorityQueryKey` 固定 `['authority', authorityKey, ...domainParts]` namespace。
- Overview/Workspace owner、project、resource、capability、diagnostic 与 task queries 已绑定 authority key。
- Task/Owner stream AbortController 注册到 AuthorityResourceRegistry；authority 改变时事件列表和 source cursor 重置。
- BroadcastChannel 只接受 `authority_changed`、`session_stale`、`signed_out` 与 decimal session revision，不广播用户资料、tenant 名称、token 或 payload。
- session SSE client 只解析 versioned safe event；revoked/expired 立即 cleanup，refresh/tenant changed 重新 bootstrap。
- managed `/auth/session/events` 已提供 cookie/session 验证、共享 session store 轮询、`Last-Event-ID` 续接、首帧 authority refresh、heartbeat、per-session/global 单实例限流与幂等连接释放；session 删除、过期、stale 或 authority/revision 改变会发送安全事件，不包含 principal、tenant display name 或 credential。详情见 `details/c3-a2-session-event-stream.md`。

## 验证

```bash
task identity:tenant-authority:test
task test:identity-tenant-authority:component
bun run --cwd apps/web typecheck
```

覆盖：managed bootstrap、tenant switch cleanup 顺序、authority storage deletion、safe BroadcastChannel reboot、session revoke cleanup、login provider action、tenant selection、stale refresh、authority-prefixed query key、local session snapshot 与 local auth mutation fail-closed。

最新 component evidence：`temp/integration-test-runs/20260720122820-45bd2065-0f26-4525-8a1e-b2991d6a9dd6`，`status=passed`、`exit_code=0`、redaction enabled。完整 Web 验证为 20 个 Vitest 文件 96 tests passed；Bun server 43 passed、4 个真实 PostgreSQL tests 因未配置 DSN skipped；production build、OpenSpec strict 与 preview smoke 通过。

## 未完成门

1. 将已完成 durable inbox/cursor consumer core 接入真实 Identity event source、consumer lease/gap recovery、跨实例 admission、lag/revoke SLO metric 与 staging drill。
2. 将 remaining mutation context、Pane/recent/approval draft、preview selection 和 Studio workflow state 全部绑定 authority。
3. 增加 two-tab stale revision、slow switch/revoke race、deep-link、keyboard/a11y 与 managed Playwright。
4. 使用 disposable PostgreSQL + live Identity 执行 login→tenant→switch→revoke→logout integration，并生成脱敏 evidence。
