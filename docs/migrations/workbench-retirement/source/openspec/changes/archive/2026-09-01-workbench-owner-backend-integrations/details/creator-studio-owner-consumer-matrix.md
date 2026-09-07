# Creator Studio Owner Consumer 就绪矩阵

## 1. 目的与状态口径

本矩阵为 Workbench Panels（root creator-studio task 5.2）提供逐 owner 的消费计划和诚实 readiness。它不是通用 `map<string, unknown>` 设计，不授予任何新路由、token、权限或生产可用性；每个 owner 只可通过已批准的 typed contract、generated client 与显式 capability/status 被渲染。

| `status` | 含义 | Workbench 行为 |
| --- | --- | --- |
| `ready` | owner 已发布匹配的 contract/client/digest，且本 consumer 的真实验证、redaction、回滚已通过 | 仅在对应 capability 为 `ready` 时启用该具体 read/action |
| `partial` | 只有表中列出的 contract slice 已有 owner 证据；其余 slice 不得推断可用 | 显示受限 read 或 owner handoff；未证明 action 保持关闭 |
| `needs_contract` | owner 或 Workbench consumer 尚缺本次需要的 typed contract/client/digest/receipt 之一 | 显示 blocker 和安全 fallback，不发起 owner action |
| `planned` | 只有 planning OpenSpec 或未来任务，未声明 live route/client | 显示计划状态；不得用 fixture、CLI 或私有存储模拟可用性 |

当前没有本矩阵可标为 `ready` 的 Workbench direct consumer。`partial` 仅表示下列明确 owner slice 已有证据，绝不表示整个 owner、事件流或 mutation 已上线。

## 2. 统一消费边界

```text
Browser Panel
  -> WorkbenchClient (typed read/status/receipt projection)
  -> Workbench BFF / workbenchd
  -> owner generated client or approved typed adapter
  -> Owner canonical API
```

- 浏览器只访问 Workbench BFF / `workbenchd`；不得保存、转发或读取 owner session、delegation token、base URL、私有路径、原始 payload、CLI 输出或数据库。
- BFF / `workbenchd` 负责 owner handshake、contract/schema/SDK digest 比对、capability/status、scope、redaction、freshness 与 receipt/status/reconcile 投影；browser 不拼 URL、DTO、SSE parser 或 action。
- 深链只可使用 allowlisted、版本化 opaque descriptor/ref。跳转到 owner client 后，owner 必须以自己的 session 重新授权；这不是浏览器直连 owner API，也不是 token 传递。
- action 只来自 server-authored typed descriptor，并经 Workbench Task admission、permission、`expected_version`/`expected_revision`、idempotency 和 owner receipt gate。timeout-after-send 显示 `unknown_accept` 并 lookup/reconcile；不得自动重放。`partial` child 查询 child status 后再 reconcile；未确认 cancel 保持 `cancel_requested`。
- 每个 read envelope 至少保留 `owner_id`、`projection_type`、opaque `source_ref`、`source_version`/`owner_revision`、`contract_digest`、`schema_digest`（若 owner 发布）、`observed_at`、`freshness`、`redaction`、capability `status` 与 safe diagnostic。event 只使 query stale 或提示 repair，不能作为 canonical projection body。

## 3. 逐 Owner 消费矩阵

| Owner / typed consumer | 当前 `status` 与精确 owner 依据 | contract / client / digest / status 入口 | Workbench 消费与边界 | action、receipt、reconcile | Consumer owner / task / verification | rollback、deep-link、direct fallback |
| --- | --- | --- | --- | --- | --- | --- |
| **Auctra Service API**：capability projection、safe refs、receipt | `needs_contract`。当前以 `cli/auctra/docs/service-api-interface.md` 与 `auctra-workbench-contracts` 作为 owner 入口；未有 admitted contract 时不得把 fixture 晋级为 live。 | 未来只接受 Auctra 发布的 versioned Service API/OpenAPI 与 generated client；capability manifest、contract/schema digest、owner revision 和 safe refs 是 BFF 校验输入。未有 admitted contract 时 status 必须为 `needs_contract`。 | Panel 只显示 safe project/screenplay/scene、draft/proposal/review/version/evidence ref 与 freshness/diagnostic；canonical text、proposal body 和 review 状态仍归 Auctra。browser 不持有 Auctra token。 | 不显示 direct mutation。未来 action 必须由 admitted manifest 给出，回传 idempotency/expected version 与 typed receipt；receipt 缺失、版本冲突或 `unknown_accept` 一律交 owner lookup/reconcile，不重放。 | Owner：Auctra Service API；Consumer：Workbench Auctra adapter。验证：`cd cli/auctra && openspec validate auctra-scene-revision-mission-beta-v1 --strict --no-interactive`；consumer contract 验证：`bun run test:contract`。 | 禁用 Auctra capability，保留 safe diagnostic/receipt ref。可用时仅打开 owner-issued opaque handoff descriptor；owner Workbench 不可达时由 Auctra 保留 receipt ref 供 retry/copy，不能重复 mutation。direct proposal/review 是 Auctra owner 的 CLI/API 闭环，不是 Workbench API fallback。 |
| **Scaena data/action projections**：`ProductionGraphProjection`、`ActionDescriptor`、`ActionReceipt` | `partial`。`agent/scaena/openspec/changes/scaena-production-canvas-contract/tasks.md` 1.1–4.1 已完成 typed projection、capability-gated actions、idempotent receipt/version 与 OpenAPI；但广义 ProductionGraph freshness/redaction/SSE 合同仍在 `agent/scaena/openspec/changes/scaena-production-data-action-projections-v1/tasks.md` 1.1–2.1，均未勾选。 | BFF 只接受 Scaena published OpenAPI/generated client 中的 project-bound projection、stable ref、source authority、resource version、`observed_at`/stale、allowlisted refs 与 action/receipt schema。未补齐的 digest/freshness/action slice 标 `needs_contract`，不把 canvas 完成项外推为全量图。 | Navigator/Canvas/Inspector 只渲染 project-scoped shot/asset/review/delivery 摘要及各自 freshness/redaction；browser 只到 Workbench BFF，后者经 Scaena facade。不得向浏览器泄露 Scaena/下游 owner credential、private path 或 raw payload。 | 仅当对应 owner descriptor 已发布才可在 Task UI 显示 action；提交携带 server-authorized expected version/idempotency，显示 typed receipt。event gap、expired 或 scope mismatch 必须 authoritative reread/reconcile，不能从 event 猜测状态。 | Owner：Scaena Backend；Consumer：Workbench Panels 5.2a，衔接 Workbench 3.1/4.1。验证：`cd agent/scaena && openspec validate scaena-production-canvas-contract --strict && openspec validate scaena-production-data-action-projections-v1 --strict`；consumer contract 验证：`bun run test:contract`。 | 关闭未证明 action，保留可验证的 partial read 与 Diagnostics。深链只走 Scaena owner-issued allowlisted descriptor；fallback 为 Scaena production 以独立 session 重授权或只读，不让 Workbench browser 改为 owner direct fetch。 |
| **Eikona visual projection/read**：`EikonaAssetHandoffV2`、future `VisualWorkspaceTableProjection` | `partial`。`cli/eikona/openspec/changes/eikona-workbench-mediahub-contracts/tasks.md` 1.1–5.3 已完成 `/api/v1/assets/{handle}/handoff`、typed DTO/SDK、redaction 与 strict validation（legacy spec name; neutral media delivery contract, mediahub the product is retired 2026-08-22）；但 Workbench table/action contract 仍是 `cli/eikona/openspec/changes/eikona-visual-workspace-projections-v1/tasks.md` A1–D1 的 planning-only 未勾选任务。 | 当前只可消费已证明的 `eikona.asset_handoff.v2` safe URI、digest、MIME、dimensions、review/rights、lineage/evidence refs；BFF 比对 owner contract/schema/SDK digest 和 freshness。future table/action 必须等 A1/A3/B1/B3，不能把 handoff REST 成功宣称为 workspace read/action 就绪。 | Evidence/Inspector 可以渲染已批准 handoff projection；asset bytes、download grant、token、path、raw prompt 均不进入 browser。Browser 经 BFF / `workbenchd`，其 adapter 仅使用已批准 typed client。 | 不在此 `partial` slice 暴露 mutation。future action 必须是 server-authored descriptor，带 permission、`expected_revision`、idempotency、receipt/status/reconcile；generation/review/handoff canary 另按本 change 的 4.4 与 `details/eikona-first-canary.md` 晋级。 | Owner：Eikona API/SDK；Consumer：Workbench Panels 5.2a，依赖 Workbench 3.2/3.6 与 Eikona B1/B3。验证：`cd cli/eikona && openspec validate eikona-workbench-mediahub-contracts --strict && openspec validate eikona-visual-workspace-projections-v1 --strict`；consumer contract 验证：`bun run test:contract`。 | kill switch 先关闭 mutation/未批准 table，仅保留 approved handoff read/Diagnostics。深链使用 `eikona://artifact/<handle>` 或 owner-issued safe ref；fallback 为 owner read-only handoff，绝不读取 private run directory 或授予 grant 给 browser。 |
| **Sonora audio projection/read**：future `WorkspaceProjection`、`ActionDescriptor`、`ActionReceipt` | `planned`。`cli/sonora/openspec/changes/sonora-audio-workspace-projections-v1/proposal.md` 明确 Workbench direct transport 延后；`tasks.md` 第 3 行说明全部未执行且不得据此声称 live surface，4.1 又明确 Workbench 仍无 direct transport claim。 | 未来 contract 必须由 Sonora OpenAPI 生成 client，包含 `sonora://` opaque ref、spec/schema version、revision、digest、`generated_at`、freshness/fallback 与 redaction；在 1.2/1.3 前不登记 client/digest，也不显示为 partial。 | Workbench 当前只显示 planned capability/diagnostic，不渲染 waveform/chart/board/table payload，不连接 Sonora。未来 BFF 才可消费 typed read；browser 不得读 `.sonora`、SQLite、CLI 或 audio/provider payload。 | 当前无 action。future action 必须经 Sonora server-authored descriptor、permission、`expected_revision`、idempotency 与 typed receipt（tasks 3.1–3.3）；SSE gap 只触发 authoritative read repair。 | Owner：Sonora API/SDK；Consumer：Workbench Panels 5.2a，后置于 Sonora 1.2/1.3/2.1/3.1–3.3 和明确的 Workbench direct-transport change。验证：`cd cli/sonora && openspec validate sonora-audio-workspace-projections-v1 --strict`；未来 consumer 追加 `bun run test:contract`。 | 无读写 cache 或 mutation 可回滚；保持 planned。未来只允许 allowlisted deep-link/read-only fallback，direct fallback 为 Sonora owner client/API 的独立授权，不能以 Workbench browser 直连替代。 |
| **Ordo multi-agent runtime**：future capability、RunInspectorProjection、ReviewPacketProjection | `planned`。Ordo API/SSE/safe projection 与三角色 DAG 仍需独立 OpenSpec 验证；fixture 不得标 live。 | 未来 BFF 只接受 versioned `/api/v1` safe projection、capability/status、Auctra binding ref/base version/digest、cursor 和 redaction。worker/admin lease、token、DB path、provider payload 不可进入 client。 | Workbench 当前显示 multi-agent capability planned/disabled，Auctra direct writing 不受影响。future Panels 仅显示 Project Board、Run Inspector、Review Packet、Operations summary 的 safe projection；browser 仍只到 BFF / `workbenchd`。 | 当前不显示 orchestration action。future decision/action 必须由 capability manifest、permission、`If-Match`/idempotency 与 receipt/status/reconcile 控制；Auctra canonical accept 与 Ordo orchestration decision 分离，`unknown`/stale review 不可自动推进。 | Owner：Ordo API；Consumer：Workbench Auctra adapter 或其他获批 consumer。验证：`cd agent/ordo && task test`；未来 consumer 追加 `bun run test:contract`。 | disable/disconnect/contract mismatch 时清理 unsafe pending orchestration action，显示 Diagnostics；direct fallback 是 Auctra owner 的 CLI/API 闭环，不依赖 Ordo、不会丢失 canonical writing。 |

## 4. Panel registry、验收与晋级

Panel renderer registry 必须以封闭的 typed discriminated union 分别注册以上五类 consumer，按 `projection_type`、major version、digest 与 `status` 选择 renderer；未知 major、digest mismatch、redaction 不足或 unsupported projection 进入 Diagnostics/read-only fallback。不得把 owner payload 转成任意 key/value 表、持久化 canonical 副本，或以单个 owner 的 fixture 推断另一个 owner 已可用。

5.2a 完成前，Workbench 只可把本矩阵作为 planning/readiness UI 和 contract-test fixture 的来源。要将任一行由 `planned`/`needs_contract`/`partial` 晋级为 `ready`，必须同时有：

1. owner 已发布、版本化且 digest 可比对的 typed contract 与 generated client；
2. Workbench BFF / `workbenchd` read/status/receipt projection 已验证，且 browser network 只到 BFF；
3. source/version/freshness/redaction、offline/drift/revoke、deep-link/direct fallback 通过验证；
4. 若允许 action，具备 permission、expected version、idempotency、receipt lookup/status/reconcile/cancel/partial 语义及 kill switch；
5. 对真实批准环境的脱敏证据和 consumer contract test 通过。没有这些证据时保持原状态。
