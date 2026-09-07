# Identity Observability Baseline

## 结论

R1 5.2 已建立 Workbench identity audit、metrics 与 trace baseline。所有 metric label 使用固定 operation/outcome/reason 枚举；actor、tenant、session 与 correlation 仅以 domain-separated SHA-256 digest 出现在 audit/trace/log；token、cookie、email、provider payload 与 private URL 不进入 telemetry、evidence 或错误响应。

## Go Runtime

- `MetricsSnapshot` 新增低基数 `identity` 序列，并由 OTLP metric producer 输出：
  - `workbench.identity.events.count`
  - `workbench.identity.events.duration_ms`
- `RecordIdentity` 统一写入 identity metric、短 span 与 structured log；所有 ref 先 digest，未知 operation/outcome/reason 归一为 `unknown`。
- managed bearer verifier 记录 `authorization_decision`，JWKS/readiness 检查记录 `jwks_refresh`。
- Identity Task operation 生命周期自动映射到 `membership_mutation`，`unknown_accept` 保持 `unknown`，不伪造成功或自动重试。
- `serviceidentity.ExchangeOnce` 提供 observer hook，覆盖 delegation success、needs_contract、unavailable、audience conflict、expired 与 invalid argument；当前无批准 Owner connector 时仍保持 `needs_contract`。

## Managed BFF

- 新增 `IdentityTelemetry` 与固定 HTTPS `HTTPIdentityAuditSink`。
- production runtime 使用既有必填 `WORKBENCH_AUDIT_SINK_URL`；不复用 Identity service token，避免 audience/credential 混淆，认证由批准的网络或 mTLS sink 边界承担。
- login exchange、session refresh/revoke、tenant select/switch 在执行任何副作用前写 audit intent；sink missing/write failure 时返回安全 503，policy、Identity 与 session mutation 不执行。
- completion telemetry 记录 success/deny/conflict/unavailable；CSRF/Origin 拒绝另记 `csrf_origin_rejection`。
- revocation consumer 在 durable event inbox/session transaction 成功后记录 `session_revoke`/`membership_revoke` 与 `revoke_lag`；exporter 故障不回滚已经持久化的撤销事务。
- telemetry span ring 有界为 256，HTTP audit timeout 有界为 100ms–10s，redirect 固定为 manual。

## Redaction / Backpressure

- `tests/security/identity-redaction.test.ts` 注入 bearer token、cookie、email、provider profile 与 private callback URL，全部只留下 digest 或 `unknown`。
- privileged audit sink outage fail-closed；non-privileged completion/export failure只增加 `audit_sink/unavailable`，不阻断 durable revoke transaction。
- Audit sink 与 OTLP endpoint validation error 不回显 private endpoint、userinfo 或 provider payload。

## Verification

- `task test:observability`
  - Go observability/runtime：通过。
  - BFF identity telemetry/auth/revocation：11 pass，0 fail。
- `bun test tests/security/identity-redaction.test.ts`
  - 2 pass，0 fail。
- `CGO_ENABLED=0 go test ./service/internal/serviceidentity -count=1`
  - 通过。
- `CGO_ENABLED=0 go vet ./service/internal/serviceidentity ./service/internal/observability ./service/internal/runtime`
  - 通过。
- `bun run typecheck`
  - 根与 Web TypeScript 均通过。
- `task test:observability:collector`
  - OTLP span delivery 与 bounded outage 通过。
  - evidence：`temp/integration-test-runs/20260729045126-e4606e18-128d-4736-a15a-9d6b0d946433/`
  - redaction：0，passed。

## 运行时边界

该 baseline 不把尚未接入的 Identity provider、Owner delegation connector 或真实 production audit sink 伪装为 available。真实环境必须继续提供批准的 fixed audit endpoint、网络认证边界、Identity contract 与 service identity；任一 prerequisite 缺失时 managed startup/readiness 继续 fail-closed。
