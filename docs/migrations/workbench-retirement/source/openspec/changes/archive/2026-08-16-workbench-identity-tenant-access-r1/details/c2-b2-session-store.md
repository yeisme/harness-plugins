# C2-B2 Server-side Session Store 实现记录

## 状态

Session domain、内存事务 repository、Drizzle PostgreSQL schema/migration 与 PostgreSQL repository 已实现。当前 component evidence 可证明 digest-only 模型、expected revision、并发 rotation 与 tombstone；环境未提供 `WORKBENCH_TEST_POSTGRES_URL`，本机 PostgreSQL 又需要未知密码，因此真实 PostgreSQL integration gate 尚未执行，C2-B2 不关闭。

## 聚合不变量

- repository 只接收 64 字节 hex digest 的 session id/CSRF，不接收 raw cookie、CSRF proof、provider/context token、email 或 raw profile。
- active/stale Session 必须同时绑定 tenant、membership 与 membership version；selection-required Session 不允许残留 binding。
- revision 使用正十进制 uint64 语义；所有 authority rotation 必须携带 expected revision。
- rotation 在单事务中删除旧 session、插入新 id/CSRF/revision/authority binding，并写旧 id tombstone。
- 并发相同 expected revision 最多一个成功；后续请求通过 tombstone 稳定得到 `session_revision_conflict`。
- next id 不能复用现有 session 或 tombstone；idle/absolute expiry、inactive state 与 context expiry 均 fail-closed。

## Drizzle 持久化

生成资产：

- `apps/web/server/session/schema.ts`
- `apps/web/server/session/migrations/0000_slimy_madame_web.sql`
- `apps/web/server/session/migrations/meta/**`
- `apps/web/server/session/postgres-repository.ts`

表：`workbench_sessions`、`workbench_session_tombstones`、`workbench_identity_context_cache`，以及 C2-B4 增量加入的 `workbench_login_transactions`。context cache 只保存 generation/expiry/state/refresh metadata；login transaction 只保存 transaction/state/receipt keyed digest 与生命周期 metadata，不存在 token、receipt 或 state 原文列。

PostgreSQL repository 使用 Drizzle ORM、serializable transaction、`FOR UPDATE`、compare revision delete、unique conflict 映射与有限 serialization/deadlock retry。migration/meta 由 `drizzle-kit generate` 创建，未手写结构化 metadata；`drizzle-kit check` 验证漂移。

## 验证

```bash
task identity:session:test
task test:identity-session:component
WORKBENCH_TEST_POSTGRES_URL='postgres://...' task test:identity-session:postgres
```

最新 component 证据：`temp/integration-test-runs/20260720104554-a8229e48-a16d-4ed0-b32f-8cce6cedd971`，`status=passed`、`exit_code=0`。PostgreSQL test 在无 DSN 时明确 skip，不计为 integration evidence。

前两个目标不构成真实 PostgreSQL 证据。只有使用 disposable DB 的最后一个 integration target 通过，才可把 repository 标记为 integration-ready。

## 后续

1. 提供 disposable PostgreSQL DSN，运行 migration + create/rotate/tombstone integration，并补并发双 rotation 数据库测试。
2. C2-B3 实现 secret file permission/key length、cookie/CSRF keyed digest、cookie issuance/clear、Host/Origin middleware 与 fixation tests。
3. C2-B4 将 context token 放入 bounded encrypted/in-memory custody；普通 session/context metadata 表不得新增 token bytes。
4. C3-A1 增加 event cursor/outbox/audit ref 表时继续由 Drizzle schema + generated migration 管理。
