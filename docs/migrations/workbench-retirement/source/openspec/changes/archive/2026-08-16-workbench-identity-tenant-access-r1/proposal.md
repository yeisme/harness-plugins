# Workbench Identity、Tenant 与 Access R1 提案

## Why

Workbench 当前只有本机 loopback token，能够支撑开发预览，但不能证明远程用户是谁、属于哪个 tenant、成员关系是否仍有效，也无法安全承载多 Owner mutation、审批、审计和 managed 部署。R1 必须先建立可信 Principal 与 tenant isolation，后续 Owner integration、工作流执行和生产发布才有可验证的授权边界。

## What Changes

- 引入统一 `PrincipalContext`：规范 issuer、audience、subject、tenant ref、membership ref/version、session ref、scopes、authentication time、expiry 与 actor type。
- 通过 Yeisme Identity Platform 连接 OIDC/OAuth provider；Google、Lark 等 provider token 只在 Identity/BFF 服务端处理，浏览器只持有受保护的 Workbench session cookie。
- 增加登录回调、session refresh/rotation、登出、session revoke、tenant list/switch 和 current principal 接口。
- 建立 tenant 与 membership 安全投影，并通过 membership version、revocation event 和短 TTL fail-closed 防止已撤销成员继续操作。
- 建立 permission policy：Workbench operation、workspace/project/resource ref、Owner capability 和 approval gate 必须共同授权；UI 只消费服务端返回的 allowed actions。
- 引入 service/workload identity，区分 browser actor、automation actor 和 internal service，不允许复用用户 cookie 调用 Owner。
- 所有 tenant switch、role change、invite、remove、session revoke、permission denial 和 privileged mutation 写入脱敏审计事件。
- local profile 继续支持现有 loopback local-session；managed profile 未配置 approved issuer/audience/key material 时 readiness 必须失败。
- 不在本 change 中实现 Owner 领域状态机、计费、组织 HR 主数据、provider SDK 直连、跨 tenant 共享资源或公网匿名访问。

## Capabilities

### New Capabilities

- `workbench-identity-tenant-access`: 定义 Principal、浏览器会话、tenant/membership、授权决策、服务身份、撤销传播、审计与 managed readiness 的生产合同。

### Modified Capabilities

- 无；R1 作为独立 child capability，在 R0 production foundation 上增量交付。

## Impact

- Web/BFF：`apps/web/src/bff/**`、登录/回调/tenant switch 页面、同源 cookie、CSRF 与 subject-bound cache 清理。
- Go service：`service/internal/security/**`、`service/internal/runtime/**`、authorization middleware、principal context、audit event 与 readiness probe。
- SDK/合同：`packages/task-sdk/**`、HTTP/gRPC/JSON-RPC principal/tenant/access projection、JSON Schema 与 protobuf。
- 外部依赖：`backend-server/identity-platform` 的 discovery、JWKS、session/member API 与 event contract；Workbench 不直接集成 Google/Lark SDK。
- 数据：仅保存 opaque principal/tenant/membership/session refs、source version、decision metadata 与审计摘要，不保存 provider token、credential、完整个人资料或 Owner 私有数据。
- 后续依赖：`workbench-owner-backend-integrations`、durable workflow/reconcile、production UI、release operations 必须在 R1 canary gate 通过后才能晋级 managed availability。
