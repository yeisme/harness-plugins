# Film Production Readiness contract

合同版本为 `workbench.film_project_index.v1`。每个 owner binding 必须包含 owner/project ref、revision、digest、freshness 与 availability；每个 scene summary 必须有 sequence/scene ref、readiness、shot/asset refs、以及可选 blocker、next action、package、receipt 和 audio/budget/run/continuity/editorial/final 安全摘要。milestone 只携带 ref、状态与可选 owner/receipt ref。

允许状态：

- availability：`available|stale|partial|unavailable|needs_contract|permission_required|offline|contract_mismatch`
- scene readiness：`unknown|blocked|pending|prototype_ready|production_ready|final_verified|delivered`
- decision：`pending_refetch|stale|unknown_accept|already_decided|owner_receipt`

调用面使用统一 TaskService Operation：

- `film.project_index.get`：只读、fail-closed 投影查询；owner 未绑定时是 `needs_contract`，不得返回本地伪造 index。
- `film.owner_action.submit`：携带 `ownerRef`、`actionRef`、`expectedRevision` 和 transport idempotency key；它经过 permission/cost/expected-version gate，结果只记录 owner receipt 并要求 refetch。`unknown_accept` 必须保留到 SDK/UI，且只允许 reconcile/refetch。

两项 operation 都投影到 SDK、HTTP、gRPC 与 JSON-RPC。fixture adapter 通过 typed `source=fixture_provider_free` 和 closed `state=fresh|stale|unavailable|partial|needs_contract|permission_required|offline|contract_mismatch` 声明 provider-free 状态；未签约的 exact Owner SDK 不得冒充可用。
