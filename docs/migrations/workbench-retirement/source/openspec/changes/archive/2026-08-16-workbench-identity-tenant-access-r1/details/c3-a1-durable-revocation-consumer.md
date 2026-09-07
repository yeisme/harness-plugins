# C3-A1 Durable Identity Revocation Consumer 实现记录

## 状态

Workbench managed BFF 已实现 durable revocation consumer core：versioned safe event validation、event id digest inbox dedupe、opaque source cursor、session/membership/tenant selector、version monotonicity、原子 session transition、stale recovery authority rotation 与 lag diagnostic。Drizzle 已生成 additive PostgreSQL migration，内存 component tests 已通过，真实 PostgreSQL test target 已建立但尚未提供 DSN 执行。

本切片不宣称 live Provider 接通。Identity provider watch URL、transport framing、consumer lease/gap recovery、contract-change/JWKS event adapter、跨实例 leader/admission、telemetry exporter 和 staging revoke SLO 仍是后续门。

## 事务与状态机

单个 source event 的顺序固定为：

```text
validate contract/schema/envelope
  -> hash event id + safe payload
  -> claim inbox
  -> lock/select matching sessions
  -> apply monotonic transition
  -> complete inbox outcome
  -> commit opaque cursor
```

- `session.revoked`：按 `identitySessionRef` 撤销所有非终态 session，`revision + 1`。
- `membership.changed`：仅当 event version 大于当前 authority version 时置 `stale`；不提前激活新 membership version。
- `membership.revoked`：tenant + membership 双重匹配；旧版本 event 不得覆盖更新 authority。
- `tenant.suspended`：撤销该 tenant 的全部非终态 session，不影响其他 tenant。
- duplicate event：不重复修改 session；同 event id 携带不同 safe payload digest 时 fail-closed `contract_mismatch`。
- cursor 只在 inbox/session 操作成功后提交；事务失败不能留下提前推进的 cursor。

stale browser refresh 收到 Identity 新版本 grant 后，不调用普通 context refresh，而是签发新 cookie/CSRF、原子 rotate session、写 old-id tombstone、切换 authority generation，再返回 active session。旧 cookie 立即失效。

## 持久化

Drizzle 生成 migration：`apps/web/server/session/migrations/0003_aberrant_bishop.sql`。

- `workbench_identity_event_inbox`：`source_id + event_id_digest` 主键、payload digest、event type/schema、occurred/applied time、outcome。
- `workbench_identity_event_cursors`：每 source 一条 opaque cursor、last event digest、occurred/applied time。
- 不保存 raw event id、provider payload、token、cookie、email 或 Identity context。

## 兼容性与回滚

- **Database surface**：只新增表与索引，不修改或删除现有 session/login 表；属于 additive expansion。
- **TypeScript surface**：在 pre-1.0 internal `SessionTransaction` 增加 inbox/cursor 方法，仓内两个实现同步更新；无外部 package consumer。
- **Wire surface**：本切片没有新增或修改 Provider HTTP/SSE endpoint，避免在 Provider OpenSpec 未冻结前硬编码 URL/framing。
- **Rollback**：停止未来 event worker 即可回退到短 TTL + Session Store polling baseline；新增表保留不影响旧 runtime，后续 cleanup 只能在独立 contract phase 执行。

## 验证

```bash
task identity:revocation:test
task test:identity-revocation:component
WORKBENCH_TEST_POSTGRES_URL=postgres://... task test:identity-revocation:postgres
```

覆盖 duplicate/concurrent delivery、payload drift、out-of-order membership version、session/membership/tenant isolation、cursor commit、schema/migration secret scan、stale refresh cookie/session/authority rotation 和旧 cookie tombstone。

最新 component evidence：`temp/integration-test-runs/20260720124629-9ea13031-ef39-4839-a0a8-b70f679b8eff`，`status=passed`、`exit_code=0`、redaction enabled。完整 Web 验证为 20 个 Vitest 文件 96 tests passed；Bun server 48 passed、5 个 PostgreSQL tests 因未配置 DSN skipped；production build、OpenSpec strict 与 preview smoke 通过。

## 未完成门

1. Identity provider 发布 additive watch contract：same-origin endpoint、auth、heartbeat、cursor expired/gap、retry/backoff、maximum event/body 和 schema drift 语义。
2. 实现 bounded event source worker、single-source lease、shutdown drain、cursor-expired online resync 与 contract/JWKS event adapter。
3. 执行 disposable PostgreSQL integration，证明 inbox/session/cursor 在真实 serializable transaction 中原子提交。
4. 接入 low-cardinality lag/revoke metrics、safe audit、readiness degradation、alert 与 runbook。
5. 完成 two-tab managed Playwright、真实 Provider revoke、24h soak 和 60 秒 revoke enforcement SLO。
