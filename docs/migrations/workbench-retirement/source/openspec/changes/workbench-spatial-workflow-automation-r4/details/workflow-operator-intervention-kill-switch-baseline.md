# Workflow operator intervention 与 kill switch 基线

## 1. 结论

截至 2026-07-29，R4 `7.3` 已实现allowlisted typed operator actions、fresh session revalidation、危险操作strong-auth/approval gate、dead-letter安全requeue限制，以及global/tenant/definition/capability/Owner分层kill switch。所有写操作使用expected version CAS并生成typed audit record；没有提供任意SQL、任意状态字符串或force success接口。

Kill switch关闭新claim与新dispatch，但始终允许既有已发送mutation、cancel与compensation继续receipt/status/event reconcile，避免关闭开关造成truth丢失。

## 2. Operator identity 与授权

`security.OperatorSession` 只接受human/operator Principal：

- 必须具有tenant、subject、session、membership/session version与authentication time；
- internal task、service或bot auth method不得转换为operator session；
- ordinary action要求 `workflow.operator`；requeue/pause/resume/cancel/force_fail/switch还要求 `workflow.operator.dangerous`；
- 每次action调用authority adapter重新验证allowed/revoked/current session version；
- dangerous action的strong authentication必须在配置TTL内，future/stale timestamp fail closed。

## 3. Typed intervention

Allowlist固定为：

```text
read
reconcile
requeue
pause
resume
cancel
force_fail
```

每条ActionRecord绑定tenant、actor、session/version、run/step、expected resource version、command ref、reason、evidence与approval safe refs。并发相同version只有一个winner，其余返回version conflict。

- `reconcile`不会创建新mutation；
- `requeue`只允许明确retryable dead-letter，且不存在dispatch intent/external unknown；
- `force_fail`需要strong auth、approval、safe evidence以及明确external truth settled；
- unknown receipt、maybe-sent mutation或持久化dispatch intent存在时，requeue/force_fail均拒绝；
- service不提供force success、receipt删除、DB字段编辑或任意command type。

## 4. Hierarchical kill switch

Switch scope固定为global、tenant、definition、capability与Owner，更新必须versioned、audited、strong-auth；disable需要approval。

Evaluation按global到Owner顺序检查相关switch。任一disabled时：

```text
allow_claim=false
allow_dispatch=false
allow_reconcile=true
blocked_by=<safe switch ref>
```

Runtime readiness将此状态报告为 `workflow_mutation_disabled` degraded，但保持ready与reconcile capability；任何 `allow_reconcile=false` 组合被视为invalid switch contract。

## 5. 故障矩阵

测试覆盖：

- ordinary user、internal/service identity、revoked/stale session与stale strong auth拒绝；
- typed reconcile审计与10路并发CAS单winner；
- unknown/dispatching dead-letter禁止requeue；
- force_fail缺approval、缺settled truth或unknown时拒绝；
- Owner switch关闭claim/dispatch且保留reconcile；
- stale switch version与unsafe/global-without-approval拒绝；
- runtime degraded readiness不阻断reconcile。

## 6. 验证与证据

可重复命令：

```bash
task workflow:operator-controls:test
CGO_ENABLED=0 go test ./service/internal/workflows/operators ./service/internal/security ./service/internal/runtime
task test:workflow-component SCENARIO=workflow-operator-controls
```

Component evidence：

```text
temp/integration-test-runs/20260729034355-95247852-2607-4ecb-8169-728b24668acb/
status=passed
exit_code=0
redaction=enabled
total_redactions=0
```

证据包含operators/security/runtime完整tests、race detector、`go vet`与标准六件套/digest/redaction gate；无credential、session secret、raw provider error、private path或chain-of-thought落盘。

## 7. 后续边界

- production Store必须将ActionRecord与SwitchRecord原子持久化到既有intervention/dead-letter模型，缺Store时capability保持needs_contract。
- `7.4` canary必须证明kill switch关闭后零新dispatch且已发送mutation继续reconcile。
- `8.3` Operations Pane只能消费typed commands与safe audit projection，不提供数据库编辑器。
