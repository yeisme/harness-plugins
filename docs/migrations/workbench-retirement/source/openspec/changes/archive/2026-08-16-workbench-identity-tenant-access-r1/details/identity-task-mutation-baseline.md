# Identity Task Mutation 本地基线

## 1. 交付结论

R1 `4.2` 已将invite、accept、remove与role change冻结为provider-neutral Owner Task mutation合同。四个operation复用现有Task permission gate、expected owner version、idempotency、attempt、receipt、unknown acceptance与reconcile状态机；Workbench不先更新Team projection，也不保存成员邮箱、角色正文、provider payload或credential。

```text
workbench.identity.membership.invite
workbench.identity.membership.accept
workbench.identity.membership.remove
workbench.identity.membership.role_change
project_mode=identity-admin
```

## 2. 输入与事实边界

Task replay只持久化：

```json
{"inputRef":"input:identity:command"}
```

`inputRef`指向Identity拥有的typed command；具体邀请地址、目标member、角色集合与其他业务正文不进入Workbench Task storage。Task自身持久化当前tenant、actor subject/membership/version、`ExpectedOwnerVersion`与`IdempotencyKey`。dispatch前adapter重新比对当前principal和Task authority；membership version漂移、actor revoke或tenant/subject不一致时，在调用Identity gateway前fail-closed。

Identity receipt是mutation事实来源。`accepted`映射为running，`succeeded`映射为succeeded，version conflict/provider deny映射为receipt-backed failed。gateway timeout、unsafe receipt或未知结果统一进入`unknown_accept`，不会自动重放mutation。

## 3. Reconcile 与幂等

重复Submit使用TaskService现有tenant/subject/operation/idempotency scope返回原Task与submission receipt；相同key输入漂移返回`idempotency_conflict`。timeout后只允许`ReconcileUnknownAccept`调用Identity lookup接口，沿用原action、tenant、input ref、expected version与idempotency identity，不再次调用mutation入口。

remove self、last owner、revoked actor等业务拒绝由Identity返回typed denied/conflict receipt；Workbench不猜测canonical membership状态，也不乐观删除或修改Team projection。

## 4. 四 transport 与 SDK

operation registry为四个mutation启用SDK/HTTP/gRPC/JSON-RPC projection，并要求：

- `ModeOwner`
- `Mutation=true`
- `PersistSafeInput=true`
- `SupportsReconcile=true`
- `SupportsCancel=false`
- `RequiresIdempotency=true`
- `RequiresPermission=true`

TypeScript SDK导出稳定operation ids、`identity-admin` project mode与严格`IdentityMutationInput` normalizer；额外字段、private path与非`input:`引用fail-closed。

## 5. 验证与证据

```bash
task identity:mutations:test
task test:identity-mutations:component
```

```text
temp/integration-test-runs/20260729041932-784c7449-cede-4b85-9d45-87e07bf0c03f/
status=passed
redaction.enabled=true
```

最新本地 consumer 复核（2026-08-02）：`task test:identity-mutations:component` 重新执行 Go adapter/app/conformance、`go vet`、10 轮 race、SDK 与完整 contract suite；证据为 `temp/integration-test-runs/20260802004659-af810c9b-49ee-4510-880e-56b320a5a921/`，`status=passed`、`redaction.total_redactions=0`，250 个 Bun 测试与 862 个断言通过。该结果仍是 provider-neutral Task/delegation boundary，不是 live Identity mutation 或 R1 closeout。

Freshest local consumer recheck（2026-08-02 05:33）：`task test:identity-mutations:component` 通过，证据为 `temp/integration-test-runs/20260802053331-206e6d3f-e974-46b7-99f2-28dc00ea5d15/`，`status=passed`、`exit_code=0`、`duration_ms=135526`、`redaction.total_redactions=0`。该证据只刷新 provider-neutral adapter/app/conformance、SDK、race/vet 与 contract 的本地边界；没有 live Identity issuer、PostgreSQL 或 Owner-audience delegation canary，因此不关闭 R1 production handoff/closeout。

门禁覆盖Go adapter/app/conformance、`go vet`、10轮race、SDK identity mutation tests与完整`bun run test:contract`（241项）。验收矩阵包含success、exact replay、version conflict、provider deny、policy deny、timeout、reconcile、stale/revoked actor与四transport catalog parity。

## 6. 未提升边界

- 当前交付是可注入的provider-neutral adapter与Task合同；真实Identity mutation endpoint、authentication、receipt/status实现仍由R1 production handoff与`6.2-6.5`门禁提升。
- `workbenchd`不得在缺少真实Identity mutation gateway时把这些operation标记为available；R1 `4.4` managed UI/BFF mutation proxy必须消费同一Task合同，不能直调Identity或乐观更新Team projection。
