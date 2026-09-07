# 02 · owner 合同摘要冻结（task 1.3）

冻结时点：2026-09-05。方法：每面记录 contract id、Workbench 消费实现、定义文件 SHA-256（任何漂移——含注释级改动——都要求重新冻结本表）、fail-closed 测试证据与合同状态。**Acceptance 对照**：unknown major/field fail closed 由 §1/§2 的既有测试证明，§3/§4 按 `needs_contract` fail closed（无 stub、无猜测）；旧 SDK 签名不改——本任务零 SDK 代码改动，仅记录摘要。

## 1. Conversation Runtime public SDK/egress（已冻结，可消费）

- Contract：`workbench.conversation.v1alpha1`
- 消费实现：`packages/task-sdk/src/conversation-models.ts`、`conversation-client.ts`
  - sha256 `1f00f7ef3fd88eab6da83546356f131abaf4d947bc0682791287c9147ac077cf`（models）
  - sha256 `de0f68cb2c24985edb438a0f25f0171d229fb8ec0ff4ed1556204d9f81d358fd`（client）
- fail-closed 证据：`conversation-models.test.ts`（unknown profile/freshness 枚举 → truthful unknown；missing owner/unsafe refs/oversize title/malformed beats/unknown thumbnail role → fail closed；optional unknown fields 丢弃不失败；operation status drift fail closed）。
- egress 合同：sealed turn intent 沿 `workbench.agent.turn.submit.v1`；旧 turn Task 只持 safe refs，raw prompt/provider payload 不建模。

## 2. Auctra screenplay room（已冻结，可消费）

- Contract：`auctra.screenplay_room.v1alpha1`
- 消费实现：`packages/task-sdk/src/auctra-screenplay-models.ts`、`auctra-screenplay-client.ts`
  - sha256 `bab4803b85ba3b290a5d2365146034218d7ec2bf4bf814567708b62cc272eb7e`（models）
  - sha256 `286d3d1cc9883037b2f67898f8fe87202ba4d85c82867ebfc0bdb0ea38b8d13e`（client）
- fail-closed 证据：`auctra-screenplay-models.test.ts`（"fails closed on unknown values without guessing"；mutation submission 只接受 selected operations）。
- Validation run（§1+§2 合并）：`bun test packages/task-sdk/test/conversation-models.test.ts conversation-client.test.ts auctra-screenplay-models.test.ts auctra-screenplay-client.test.ts` → **48 pass / 0 fail**（2026-09-05）。

## 3. Auctra Text Working Copy（已冻结，可消费——2026-09-05 task 2.2 重冻结）

- Contract：`auctra.text_working_copy.v1alpha1`（family：receipt `…_receipt.v1alpha1`、snapshot `…_snapshot.v1alpha1`、candidate `…_candidate.v1alpha1`、change-set `…_change_set.v1alpha1`、event `…_event.v1alpha1`）。
- owner 侧发布：cli/auctra change `auctra-text-working-copy-v1` 归档（commit `b286c12`，34/34，2026-09-05）；loopback HTTP family `/api/v1/projects/current/text-working-copies`（`?major=1` 协商 + `auctra.api.envelope.v1` 封套）。
- owner 合同 spec sha256（消费侧 pin；漂移需重冻结本表）：
  - `sha256:ed1edf33…f7f1013c8`（consumer-contract）
  - `sha256:3d7a61bd…07fa9af2`（lifecycle）
  - `sha256:82f67516…5daa3ee`（patch-contract）
  - `sha256:21293361…d8528816`（recovery）
- 消费实现（task 2.2）：
  - Go connector：`service/internal/owners/auctra/workingcopy.go`（open/status/apply/reconcile/checkpoint create-list/review submit/candidate show-apply-reject/watch；owner ref 真值语法 `twc-|chk-|cand-|text:|chapter:|screenplay-draft:`；裸 64-hex digest；body-free events + typed cursor gap）。
  - Go BFF：`service/internal/transport/textdevhttp`（同源 `/v1alpha1/text-development/*`；Browser 只到 Workbench；未接线面 needs_contract）。
  - SDK：`text-development-models.ts` AUCTRA_REF/DIGEST union owner 真值语法；`text-development-client.ts` candidate/submit 方法携带 `workingCopyRef`（owner 路由 wc-scoped）；http 工厂接线（jsonRpc/ordo team 待 2.4）。
- fail-closed 证据：`workingcopy_test.go`（unsafe unit ref/schema drift/stale base conflict/non-checkpoint ref/typed cursor gap/ref 语法负例）+ `handler_test.go`（port 缺席 needs_contract/unknown owner status BadGateway/幂等键缺失拒绝/CAS conflict/SSE 无 insert/Bearer·URL 不泄漏）+ SDK `text-development-bff-routes.test.ts`（同源路由映射/幂等键只进 header/owner 真值 ref+裸 hex digest normalizer 绿、非法 ref fail closed）。

## 4. Ordo Team control provider/consumer（`needs_contract`，provider 在制）

- Contract：`ordo.workbench.team_control.v1alpha1`
- provider 侧：`agent/ordo` active change `ordo-workbench-team-control-v1`（1/33）；schema/state/reason/cursor/receipt 源文档 `agent/ordo/docs/product/workbench-team-control.md`
  - sha256 `8ad05d843709b7eb36ce3d15691e484a03f93da57ded3863024c5bd8c6156d3c`（2026-09-05 时点的 provider 意图快照；provider change 推进后需重新冻结）。
- Workbench 立场：task 2.4 只经 typed server adapter 消费 preview/simulate/start/status/events/cancel/reconcile；Browser 不直连 Ordo；合同未就绪时 projection 保持 read-only unavailable，不伪造 simulation 结果。
