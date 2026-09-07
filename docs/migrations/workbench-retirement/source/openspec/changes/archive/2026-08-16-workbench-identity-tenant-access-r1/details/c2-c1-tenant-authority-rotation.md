# C2-C1 Tenant Authority Rotation 与 Cleanup 实现记录

## 状态

Tenant select/switch 的 server transaction、React AuthorityProvider、managed login/tenant/rescue Gate、BroadcastChannel、authority-prefixed核心 Query、resource registry、session SSE polling baseline 与 layout v3 已实现。服务端已能验证 membership selector、轮换 Session authority并拒绝旧 cookie；前端在服务端 commit 前保持旧 authority，commit 后统一清理。SSE cursor/limits/Identity revoke source、多 Pane/recent/approval 全接线、live provider/PostgreSQL 与 managed browser e2e 仍未完成，C2-C 不关闭。

## Server Rotation

- Identity client 固定 `POST /v1/session/tenant`，输入只有 server session ref、membership ref、`audience=workbench` 与 idempotency key。
- BFF route 先校验 exact Host/Origin、JSON、opaque cookie、CSRF 与 expected session revision，再调用 Identity。
- grant 必须保持相同 subject/session，并返回请求 membership 的 active tenant binding；失败时不修改旧 Session/context/cookie。
- binding 改变时使用 `SessionService.rotateAuthority` 单事务轮换 id digest、CSRF digest、revision、tenant/membership/version、authority key，并写旧 id tombstone。
- 同 binding freshness refresh 不轮换 revision，只更新 context expiry；旧 tab/cookie 在 rotation 后稳定失败。

## Frontend Transition

- `reduceAuthority` 在 `switch-requested` 只记录 pending membership，保留旧 authority/revision；只有 `switch-committed` 才激活新 authority。
- cleanup command 顺序固定：abort requests → close streams → clear queries → clear layouts → clear recent → activate authority。
- `AuthorityResourceRegistry` 按 authority 管理 AbortController 与 stream closeable；project file EventSource 已支持注册。
- `authorityQueryKey` 已用于 Overview/Workspace 的 owner、project、resource、capability、diagnostic 与 task queries；切换时仍先 cancel 后全清，直到 remaining mutation/Panes 全部绑定 authority 再收窄。
- `AuthorityProvider` 已挂载应用根，统一处理 local/managed bootstrap、tenant select/switch、refresh/logout、safe BroadcastChannel 与 session SSE client event。
- `AuthorityGate` 已覆盖 login、tenant selection、stale refresh、revoked/expired/signed-out 与 Identity unavailable rescue。
- Workbench layout 与 Studio layout 升级 schema v3，key/payload 均绑定 authority key；不同 tenant 不能恢复彼此 layout。

## 验证

```bash
task identity:tenant-authority:test
task test:identity-tenant-authority:component
```

覆盖 Identity tenant request、active grant validation、session revision 1→2、cookie/CSRF rotation、old cookie rejection、switch failure no-commit、cleanup order、Abort/SSE、safe BroadcastChannel、login/selection/rescue UI、authority query namespace、local session snapshot、authority storage removal 与 layout v3 isolation。

最新 component 证据：`temp/integration-test-runs/20260720114624-6c2003d2-9e5e-4fee-9bd1-9e40782057d0`，`status=passed`、`exit_code=0`；evidence runner 已生成六件套并完成脱敏扫描。

Authority Runtime 最新证据：`temp/integration-test-runs/20260720122820-45bd2065-0f26-4525-8a1e-b2991d6a9dd6`，覆盖 React Gate、BroadcastChannel、query isolation、local session 与有界 managed Session Event Hub。

## P1 Workbench 补救（2026-07-21）

- `membership_version` 继续持久化为 Task authority audit metadata，并继续用于 managed internal-principal authorization；它不再参与 `principal:v1` caller scope digest 或 Task idempotency unique index。相同 issuer、subject、tenant、membership 与 actor 的 caller 在 membership version 轮换后保留同一 idempotency namespace。
- GORM migration `0015_task_idempotency_scope_v2` 先在同一数据库事务中创建不含 `authority_membership_version` 的 temporary unique index，再删除旧 index、创建同名 canonical index，最后删除 temporary index。该流程使用 GORM Migrator，适用于 SQLite 与 PostgreSQL；若历史数据已经违反新 namespace 的唯一性，temporary unique index 创建会失败并阻止启动，不会静默合并或删除 Task/owner side effect。
- managed runtime recovery 现在要求 tenant、subject、membership、membership version、actor、caller scope 与 project 均完整。legacy empty-tenant 或不完整 authority 的 running Task 不会调用 event source，而是记录 `identity verification is unavailable` 并进入 `unknown_accept` / `task.reconcile_required`；local profile 保留其明确的 local-task recovery 行为。
- 本地验证已通过：`CGO_ENABLED=0 go test ./service/internal/runtime ./service/internal/repository ./service/internal/app ./service/internal/clientruntime`；`CGO_ENABLED=1 go test -race ./service/internal/runtime ./service/internal/repository ./service/internal/app ./service/internal/clientruntime`。覆盖 membership version 轮换后的 replay/conflict 与单次 handler execution、legacy empty-tenant managed restart quarantine、GORM index rebuild 与 `OwnerEventContext` fail-closed。
- 未执行真实 external provider、PostgreSQL 写入或 production/provider canary；Provider Contract Gate 与 C2-C 仍保持未完成。

## 未完成门

1. 实现 managed `/auth/session/events` server stream、cursor/reconnect、connection limit、revoke SLO 与多实例传播。
2. remaining mutation context、SSE cursor、SDK request、Pane state、recent workspace、approval draft、preview selection 与 persisted Studio workflow state 增加 authority key/revision。
3. 全部 tenant-bound state 完成后把 QueryClient 全清收窄为旧 authority namespace 删除。
4. 增加真实两标签页 stale revision、slow switch/revoke race、deep-link、keyboard/a11y 与 managed Playwright e2e。

UI/runtime 详细记录见 `details/c2-c2-authority-runtime-ui.md`。
