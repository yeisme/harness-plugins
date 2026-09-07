# Identity 运维命令与运行文档基线

## 交付内容

- `Taskfile.yml` 新增可发现的 Identity migration、consumer integration、managed Team e2e、revoke drill 与 evidence readiness 入口。
- `test:identity-security` 现在由 evidence runner 包装，并组合 Go race、managed BFF security、identity redaction 与 TypeScript typecheck。
- 所有新增 component/integration/e2e 长任务写入 `temp/integration-test-runs/<run-id>/`；命令、stdout/stderr、环境与摘要均经过统一脱敏。
- `docs/operations/managed-identity-runbook.md` 明确 local/managed 边界、secret custody、命令矩阵、migration、canary、revoke drill、readiness 与故障复查。
- README 与 runtime 文档已从旧的“仅 JWKS consumer slice”描述更新为当前 managed BFF consumer baseline，同时保留真实 provider、staging SLO 与公网 ingress 的 promotion 门禁。

## 安全默认

- migration baseline 使用新建临时 SQLite 数据库，不触碰默认 `var/workbenchd.db`。
- contract canary 只接受无 credential 的 HTTP loopback URL，且只执行只读 contract GET。
- consumer integration 与 revoke drill 必须显式提供 disposable PostgreSQL URL；Taskfile 不保存或打印 credential。
- readiness report 只读取 evidence metadata/digest，不执行 mutation；文档明确共享 evidence root 的限制。
- deterministic revoke drill、route fixture e2e 与 loopback contract 不得解释为 live provider 或 staging SLO 证据。

## 验证证据

- `task --list`：新增命令可发现。
- `task test:identity-migration`：通过；evidence `temp/integration-test-runs/20260729050110-3edab35b-932e-48c1-bbc6-a416d7cd78c5/`，redaction gate 通过。
- `task test:identity-e2e`：Chromium 2/2 通过；evidence `temp/integration-test-runs/20260729050110-34897ce1-0458-461f-ad6d-968dca54129e/`，redaction=0。
- `task test:identity-security`：Go race、BFF security、identity redaction、typecheck 全部通过；evidence `temp/integration-test-runs/20260729050141-72f73db8-1421-4007-8d72-3dbe155607fc/`，脱敏 gate 通过。
- `task identity:readiness:report ENV=integration`：最新 Identity security evidence freshness/status/digest 均通过。
- `task test:identity-readiness:component`（2026-08-02）重新验证 Workbench identity readiness、revocation consumer/source/supervisor、BFF managed dependency gating、authorization stripping 与 typecheck；证据为 `temp/integration-test-runs/20260802004630-feb2d21f-6bf8-4cb1-82e6-c905a3ff6b85/`，`status=passed`、`redaction.total_redactions=0`。该证据只覆盖本地 consumer fail-closed，不替代 Identity provider/PostgreSQL/live browser handoff。
- `task spec:validate SPEC_CHANGE=workbench-identity-tenant-access-r1`：strict change validation 通过。

`test:identity-integration` 与 `identity:revoke-drill` 的真实 disposable PostgreSQL 执行留给 6.2/6.4；当前仅验证 Taskfile schema、required vars、evidence wrapper 和 fail-closed 文档边界，不伪造外部依赖证据。
