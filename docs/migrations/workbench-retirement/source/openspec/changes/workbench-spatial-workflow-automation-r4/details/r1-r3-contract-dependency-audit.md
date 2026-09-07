# R4 对 R1–R3 合同依赖审计与对接门

## 1. 审计结论

截至 2026-08-23，R4 仍不得把 R1–R3 整体视为 `integration-ready`；但 R2 已有一个可被 R4 接收的 Eikona production-handoff slice：

| 上游 | 当前可证明能力 | 缺失的生产证明 | R4结论 |
| --- | --- | --- | --- |
| R1 Identity | Identity Proto/Schema/SDK、read models、session/revoke、真实 provider 与 security/browser gate 已有证据 | staging 24h soak、revoke/rotation/outage SLO、rollback drill 与 R1 `6.5` closeout | managed publish/dispatch 继续受 `0.1b` 门禁；本地 safe model 可用于开发 |
| R2 Owner | 正式 Owner Proto/Schema/generated Go、typed TS SDK、route catalog、receipt/status/reconcile/cancel、真实 Eikona mutation 与四传输/race、R2 `7.3` final gate；`INT-R2-01` 四门 ready | change 级 `7.4` 仍等待跨 R0–R5 全局 registry 与 per-owner disabled/needs_contract 子状态表达 | R4 接收 Eikona 已证明 slice 的 range/digest/receipt 语义；其他 Owner 继续 `needs_contract` |
| R3 Desktop/Daily | Layout v3、Pane fullscreen/file-preview，以及 Asset/WorkItem/Operations Proto/Schema/generated Go/typed TS 与本地 PostgreSQL baseline 已存在 | 把真实 Identity + Eikona 装入 Daily system harness、browser/security、capacity/soak、rollback 与 R3 `8.5` closeout | R4 可复用 Pane 和 typed refs 开发；Board target 与 wait_task/approval/delivery 的 production availability 仍受 `0.1e` 门禁 |

`openspec status`只证明 proposal/design/spec/tasks 四类文档存在，不证明 tasks 完成。R2 的 `7.3` 与 `INT-R2-01` 只提升已经逐项证明的 Eikona slice；不能用 change artifacts、全局 registry 的单个 ready package 或 Eikona canary 提升其他 Owner、R1 或 R3 capability。

## 2. 当前证据

本地已通过：

```bash
task identity:contract:test
task identity:models:test
task identity:revocation:test
task owner:contract:test
task layout:contract:test
task studio:pane-preview:test
```

资产审计：

- R1存在 `api/proto/workbench/identity/v1alpha1/identity.proto`、生成JSON Schema、TypeScript SDK、Go Identity service和BFF session/revoke实现。
- R2 已存在 `api/proto/workbench/owner/v1alpha1/owner.proto`、`api/schema/workbench/owner/v1alpha1/owner.schema.json`、`service/gen/workbench/owner/v1alpha1/**`、`packages/task-sdk/src/owner-{models,client}.ts`；真实 provider、四传输和全门禁证据见下方“R2 handoff 接收记录”。
- R3 已存在 `api/proto/workbench/{assets,workitems,operations}/v1alpha1/**`、对应 Schema/generated Go 与 typed TS models；这些合同资产和本地数据库 baseline 不等同 R3 real-dependency、browser、soak、rollback 或 closeout。

当前未执行且不得推断通过：R1 staging soak/revoke/rollback 与 closeout、R3 Daily 的真实 Identity+Owner system/browser/soak/rollback 与 closeout、R2 非 Eikona Owner 的 production promotion。R2 `7.4` 的全局 6/6 registry 也未通过，不得据此伪造其他 release package。

### R2 handoff 接收记录

| 项目 | R4 接收值 / 证据 |
| --- | --- |
| Workbench consumer contract | namespace `workbench.owner.v1alpha1`；Proto、JSON Schema、Buf 生成 Go 与 typed TypeScript client 均存在 |
| Eikona provider contract | `eikona.owner@1.0.0`；instance API 接受 `1.1.x`；schema `sha256:907884228cf5c77e0217237ec8efc2d348bde0251c637bd93eee02f7407c4df0`；SDK `sha256:e233933c22d67efb5c27451dae3a0f6b1511512bd63187bac58ce8a0545e7989` |
| Provider / rollback evidence | `20260823065844-86052f8c-6196-4260-ab37-dfd429aaed53`，真实 Identity + Eikona loopback mutation、durable receipt/status/reconcile/cancel、unknown reconcile-only、no duplicate dispatch |
| Consumer / transport evidence | `20260823122520-73fa0f3d-f0d1-4b74-b1c0-d9adda4c4e0c`，本次关闭前由当前源码重跑 Owner HTTP/gRPC/JSON-RPC + typed SDK、race ×3、cursor/error/safe-ref fail-closed，passed、97.739s、redaction 0 |
| Final gate evidence | `20260823120024-8b0f3889-64bb-4a1e-b8b6-73e40b6ceee2`，strict OpenSpec、Buf、Go/race、Bun、build、contract、integration、Web E2E 全部通过 |
| Release CAS | `temp/release/handoff.json` revision 5；`INT-R2-01` 的 provider_ready、consumer_done、integration_passed、rollback_passed 均为 true |
| 保持关闭的范围 | Scaena、Auctra、Pinax、Sonora、Ordo、Ordo、Quaestor 未由 Eikona 证据晋级；未知/未接入 action 继续 `disabled/offline/needs_contract` |

## 3. Workflow step依赖矩阵

| Step/机制 | R1依赖 | R2依赖 | R3依赖 | 缺失时行为 |
| --- | --- | --- | --- | --- |
| `read_projection` | tenant/allowed action | Owner projection时需要read contract | Asset/WorkItem/Task/Delivery safe projection | 相关schema/ref显示`needs_contract`，不读取fixture |
| `condition` | 输入可见性已在服务端确认 | 无直接调用 | typed input schema | 可本地执行；未声明字段fail-closed |
| `submit_operation` | automation actor、delegation、fresh authority | operation/idempotency/receipt/status/reconcile | Task/Gate/source command | Eikona contract slice可被R4绑定；在R1/R3与聚合snapshot未完成前仍零managed dispatch，definition可保存但不可publish为available |
| `wait_task` | Task可见性 | receipt-linked Task时需要Owner状态 | Task/Gate/reconcile snapshot/event cursor | 不轮询fixture；保持`needs_contract` |
| `approval` | actor/membership/policy/revoke | mutation approval绑定operation | Gate/Approval source command | 不创建可执行gate或复用旧approval |
| `wait_event` | event visibility与authority lease | Eikona safe event/cursor contract已接收；其他Owner逐项门禁 | Daily/Task event contract | 缺对应source cursor合同则拒绝publish，不从Eikona证据外推 |
| `delay` | 无外部authority变化时仍需run tenant | 无 | 无 | 可用DB time本地执行 |
| `emit_delivery` | delivery permission/delegation | child Owner receipt/reconcile | Delivery manifest/Task/child receipt | 零emit，保持`needs_contract` |
| compensation | 独立fresh authority | Eikona cancel/reconcile slice已接收；其他Owner需approved reverse operation | Gate/Task evidence | R1/R3/聚合门未完成时不生成managed可执行plan item |

## 4. Board target依赖矩阵

| Node type | 权威合同 | 当前状态 |
| --- | --- | --- |
| `workflow_definition`, `workflow_run`, `note` | R4 Workbench-owned | R4实现后可用 |
| `asset`, `work_item`, `task`, `delivery` | R3 safe-ref contracts | `needs_contract` |
| `project`, Owner-backed artifact | R2 Eikona discovery/projection + R3 catalog | Eikona typed projection可供开发；production palette仍因R3 catalog/`0.1e`保持`needs_contract` |
| `member` | R1 Principal/Membership safe projection | consumer model可开发，managed availability待R1 closeout |

Board合同 MAY 先冻结全部allowlisted node type，但server palette/readiness MUST 只为当前合同已晋级类型返回`available`。浏览器不得因为有图标或fixture card而提升状态。

## 5. `needs_contract` 安全诊断

所有API、worker readiness和Web capability projection使用同一最小诊断：

| 字段 | 规则 |
| --- | --- |
| `dependencyId` | allowlisted稳定id，如`identity.principal`、`owner.receipt`、`daily.delivery` |
| `capability` | canonical step/node/operation capability id |
| `state` | `unavailable`, `needs_contract`, `degraded`, `available` |
| `reasonCode` | allowlisted稳定reason，不包含raw error |
| `requiredContractRange` | consumer支持范围 |
| `observedContractVersion` | 仅在安全probe成功读取时返回 |
| `requiredDigest` / `observedDigest` | 仅返回`sha256:` digest，不返回schema body |
| `checkedAt` | server observed time；worker依赖DB time的地方明确标记source |
| `evidenceRefs` | bounded safe refs，可为空 |

禁止字段：endpoint、issuer URL、JWKS body、credential source value、tenant/member title、Owner payload/message、private path、SQL、raw provider error。`needs_contract`不能被Web override；恢复必须重新执行server probe并发布新的authority/capability revision。

## 6. 上游关闭条件

### R1 handoff

- `workbench.identity.v1alpha1` models/read/runtime与provider contract digest一致。
- managed BFF session/revoke与worker service identity/delegation均通过显式PostgreSQL和live provider证据。
- wrong audience、rotation、revoke、cross-tenant、provider outage均fail-closed。
- R1 `6.5` closeout完成并提供contract/policy digest与rollback flag。

### R2 handoff

- **已接收（R4 `0.1c`）**：正式 Owner Proto/Schema/generated Go/typed TS SDK 与 route catalog 已交付。
- **已接收**：receipt lookup/status/reconcile/cancel 和 unknown/partial 语义被真实 Eikona provider/canary 实现并验证。
- **已接收**：四 transport consumer conformance、race 与 no-duplicate mutation fault evidence 通过。
- **已接收**：R2 `7.3` final gate 完成，`INT-R2-01` 四个 CAS gate ready。
- **边界**：R2 `7.4` 继续等待跨 release 6/6 registry 与 per-owner 子状态表达；其他 Owner 保持诚实 `disabled/offline/needs_contract`，不阻断 R4 接收 Eikona slice，也不被其晋级。

### R3 handoff

- Asset/WorkItem/Inbox/Approval/Delivery contracts与services交付，safe refs、event cursor、receipt child semantics稳定。
- Layout/Pane baseline继续通过，Daily真实dependency、browser、安全、性能、rollback完成。
- R3 `8.5` closeout提供允许R4消费的contract ranges/digests。

## 7. R4 聚合门

只有 `0.1b`、`0.1c`、`0.1e`全部完成后，`0.1f`才可关闭。关闭证据必须包含：

1. 每个required contract的owner、version range、digest、availability与rollback flag。
2. 明确哪些Owner/node/step仍为exploratory或`needs_contract`。
3. live integration命令与脱敏六件套，而不是fixture-only测试。
4. R4 consumer对ahead/behind/digest mismatch、revoke与dependency outage的fail-closed测试。
