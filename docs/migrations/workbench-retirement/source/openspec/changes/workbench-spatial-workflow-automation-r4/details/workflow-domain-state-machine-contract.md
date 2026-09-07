# Workflow Domain 状态机与完整功能合同

## 1. 目标与边界

本合同把 Workflow runtime 的业务事实集中到纯 deterministic domain 层。transport、repository、scheduler、worker 和 Web 只能提交 typed command、读取 projection 或执行 CAS persistence，不得各自维护状态迁移表。完整功能不是“能跑通一次 DAG”，而是定义版本、执行、等待、审批、外部 mutation、reconcile、取消、恢复和人工干预在故障后仍保持同一事实。

Domain 层不得执行数据库、网络、时钟、credential、Owner payload、日志或事件发布；调用方显式传入 expected version、DB observed time、fence、receipt/gate/evidence refs 与 policy snapshot。

## 2. 原子交付切片

| Slice | 产物 | 必须证明 |
| --- | --- | --- |
| `1.4a` | Definition/DAG validator | typed registry、边界、cycle、schema/timeout、确定性 |
| `1.4b` | Definition lifecycle/checksum | published immutable、version pin、canonical checksum |
| `1.4c` | Run machine | pause/cancel/reconcile/terminal/intervention 全矩阵 |
| `1.4d` | Step/Attempt machine | lease/fence、wait、receipt/gate、duplicate completion |
| `1.4e1` | Retry evaluator | bounded retry、unknown outcome、preserve idempotency |
| `1.4e2` | Cancel evaluator | cancel truth、dispatch intent、reconcile decision |
| `1.4e3` | Compensation planner | explicit binding、reverse DAG、intervention truth |
| `1.4f` | property/fuzz gate | bounded、可重放、无panic、跨合同一致 |

只有 `1.4f` 完成后，`1.5` transport、`5.1` scheduler、`5.3` publish/start service 才能宣称消费了完整 domain contract。

## 3. Definition 不变量

- draft 与 published version 均固定 `tenantRef/workspaceRef/definitionRef/version/registryDigest/inputSchemaRef/outputSchemaRef/steps/edges/policies/checksum`。
- step 数量 `1..1024`，edge 数量 `0..4096`；ref/schema ref/code/列表长度遵循 Proto/JSON Schema 上限。
- step type 必须来自 canonical snapshot；descriptor contract、timeout、side-effect、authority、receipt 与 adapter range 不允许 consumer 重写。
- step/edge ref 唯一；edge endpoint 必须存在；禁止 self-loop、重复 `(from,to,condition)` 和 cycle。
- 多 root、fan-out、fan-in 合法；遍历使用 bounded iterative algorithm，不按用户输入递归。
- published version 不可原地修改；任何编辑派生 `version+1` draft。run 固定 published version、checksum 与 registry digest。
- checksum 对 canonical typed representation 计算，不包含数据库时间、审计展示文本、map iteration 或 transport-specific 字段。

## 4. Definition 生命周期

```text
draft --publish(valid, authorized, expectedVersion)--> published
published --derive_new_version--> new draft(version + 1)
published --deprecate(expectedVersion)--> deprecated
deprecated --derive_new_version--> new draft(version + 1)
```

`published` 与 `deprecated` 内容均不可更新。deprecate 只阻止新 run；已固定该 version 的 run 继续执行。重复 publish/deprecate 只有在 idempotency/version/checksum 完全一致时可被 service 判为 replay，不由 domain 隐式成功。

## 5. Run 状态迁移

| From | Allowed To | 关键前置 |
| --- | --- | --- |
| `pending` | `running`, `cancelling`, `cancelled`, `failed` | pinned definition有效；未dispatch时可直接cancel |
| `running` | `waiting`, `paused`, `cancelling`, `reconciling`, `succeeded`, `failed`, `needs_intervention` | success需全部step terminal-success/skip；unknown external truth进入reconcile |
| `waiting` | `running`, `paused`, `cancelling`, `reconciling`, `failed`, `needs_intervention` | event/timer/gate/Owner状态改变 |
| `paused` | `running`, `waiting`, `cancelling`, `reconciling` | resume重新验证authority、budget、registry、Owner readiness |
| `cancelling` | `reconciling`, `cancelled`, `failed`, `needs_intervention` | maybe-sent mutation不得直接cancelled |
| `reconciling` | `running`, `waiting`, `succeeded`, `failed`, `cancelled`, `needs_intervention` | 必须有status/receipt/reconcile证据 |
| terminal | none | `succeeded/failed/cancelled/needs_intervention` 不可逆 |

Run transition 必须检查 expected version；状态改变后 version 单调递增。pause 只停止新 claim，不把已接受 mutation 伪造为paused；cancel 先形成 durable intent，再由 step truth 决定能否进入 `cancelled`。

## 6. Step 状态迁移

| From | Allowed To | 关键前置 |
| --- | --- | --- |
| `pending` | `ready`, `skipped`, `cancelled` | dependencies已满足或分支明确 |
| `ready` | `leased`, `paused`, `skipped`, `cancelled` | claim需compatible worker与有效lease |
| `leased` | `running`, `ready`, `reconciling`, `cancelled` | `ready`仅限dispatch intent前安全release；maybe-sent进入reconcile |
| `running` | `waiting_approval`, `waiting_owner`, `reconciling`, `succeeded`, `failed` | output/receipt/gate policy满足 |
| `waiting_approval` | `succeeded`, `failed`, `cancelled` | decision scope/membership/version未过期 |
| `waiting_owner` | `reconciling`, `succeeded`, `failed` | receipt/status/event推进；cancel不覆盖external truth |
| `reconciling` | `waiting_owner`, `succeeded`, `failed`, `cancelled` | typed reconcile result与evidence |
| `paused` | `ready`, `skipped`, `cancelled` | resume重新校验 |
| terminal | none | `succeeded/failed/skipped/cancelled` 不可逆 |

所有 leased/running/external completion transition 必须携带 current lease ref、fence epoch、run version 与 step version。terminal duplicate 由 service 依据 command idempotency 判 replay；不同 receipt/output/evidence 的 late completion 必须冲突。

## 7. Attempt outcome 与 retry truth table

```text
pending -> accepted | rejected | retryable_rejected | unknown_accept
accepted -> reconciling | succeeded | failed
unknown_accept -> reconciling
reconciling -> succeeded | failed | superseded
terminal -> no transition
```

| Retry class | 自动 retry 条件 | 禁止 |
| --- | --- | --- |
| `none` | never | 任意自动新 attempt |
| `bounded_read` | 未超过上限且错误为批准的 transient read | schema/authority/contract错误 |
| `cursor_reconnect` | 使用同一 durable cursor reconnect | 从头猜测或跳过 retention gap |
| `pre_send_or_rejected` | 无 durable dispatch intent，或 Owner 明确 rejected/retryable_rejected | timeout/maybe-sent/unknown_accept |
| `receipt_contract` | receipt/status contract明确允许继续或恢复 | 换 idempotency key重发 |

任何 `unknown_accept`、网络断开 after-send、receipt missing but dispatch intent exists 的 mutation 都进入 `reconciling`，不会自动创建新业务 mutation。

## 8. Pause、Cancel、Compensation 与 Intervention

- Pause：写 run intent，停止新 claim；已发送 mutation 继续收 receipt/status，不中断真相。
- Cancel：取消 pending/ready；leased 仅在 dispatch intent 前安全释放；waiting_owner/unknown 进入 reconcile；全部step有可证明终态后 run 才能cancelled。
- Compensation：不是通用 rollback，也不是首版 executor step。定义必须显式引用批准的反向 operation contract，并固定 operation registry 与 operation schema digest；按成功step的反向依赖顺序生成独立 plan，每项使用独立authority、idempotency、cost、receipt/reconcile合同。
- Compensation 部分失败不把原 mutation 改写为失败；run 进入 `needs_intervention`，保留原 receipt 与 compensation attempt/evidence。
- Intervention：只能是 allowlisted typed action；不得 force success、改数据库、删除receipt或跳过unknown truth。高风险 action需要re-auth/双人审批/审计由service层验证。

## 9. 错误、输出与证据

Domain error 只包含稳定 reason code，不回显 tenant/run/step/receipt、输入、schema body 或用户文本。Service 将 reason 映射为 Workflow stable error，并原子写 state event/outbox。测试必须覆盖：

- every state × command 的允许/拒绝矩阵；
- 0/1/max step、deep chain、multiple roots、fan-in/out、cycle、dangling edge；
- stale version/fence、duplicate completion、conflicting receipt；
- cancel before/after dispatch、unknown_accept、reconcile success/failure；
- fixed fuzz seeds、bounded execution、panic-free、deterministic checksum。

## 10. 完整功能退出条件

1. `1.4a-1.4f` 全部有 unit/property/fuzz 与 component evidence。
2. repository/service 只持久化 domain 决策，无法绕过 terminal/fence/version规则。
3. scheduler/worker/四 transport/Web conformance 使用相同 registry digest、state/error语义。
4. 至少一个 read/approval canary 与一个真实 Owner mutation 在 crash/timeout/revoke/cancel/reconcile 下收敛。
5. 未完成 external truth 公开显示 waiting/reconciling/needs_intervention，不用 demo toast 或本地状态伪装成功。
