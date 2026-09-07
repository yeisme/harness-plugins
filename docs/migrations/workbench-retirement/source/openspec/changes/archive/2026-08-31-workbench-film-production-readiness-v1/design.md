## Context

Workbench 的正确产品角色是“统一体验与安全组合”，不是“统一数据拥有者”。Film Production Readiness 需要把多个 owner 的事实投影成一个可操作的项目视图，同时让用户随时看见事实来自哪个 owner、是否新鲜、下一动作由谁授权。

## Goals / Non-Goals

### Goals

- 让 2–10 人团队在一个工作区理解项目、sequence、scene、shot/asset 的生产关系。
- 用 milestone 和 readiness matrix 显示“为什么还不能生产/交付”，而不是只显示素材数量。
- 让 blocker、预算、声音、连续性、editorial 和 final return 使用同一决策箱。
- 保持 owner state/refetch/receipt 语义，支持 stale 和 partial availability。

### Non-Goals

- 不保存 screenplay、Prompt、media blob、provider payload 或 owner 私有状态。
- 不实现完整 timeline、effect、color、mix 或 provider control plane。
- 不通过 UI selection、checkbox 或 optimistic update 构造 accepted/delivered。
- 不让浏览器直连 owner、读取 token 或执行任意 shell。

## Decisions

### 1. FilmProjectIndex 是组合真源，不是领域真源

```text
workbench.film_project_index.v1
  project_ref / revision / digest / freshness
  primary_profile / overlay_refs
  owner_bindings[]:
    owner / project_ref / revision / digest / cursor / availability
  milestones[] / scene_entries[]
  actor_role_bindings[]
  pending_decision_refs[] / last_receipt_refs[]
  package_refs[] / external_editor_refs[]
```

`scene_entry` 只保存 safe summary：intent readiness、package readiness、visual/audio readiness、budget state、run state、continuity、editorial/final state、blocker/next action refs。每次 mutation 后必须 refetch owner projection。

### 2. 产品层级固定为 Project→Sequence→Scene→Shot/Asset

默认左侧/画布用于层级与媒体关系；右侧 inspector/decision box 用于：

- current owner/revision/freshness；
- scene closure 与 missing dependencies；
- prototype/production lane；
- image/video/audio budget；
- Ordo run/attempt/blocker；
- audio segment replacement/final mix；
- critical/overall continuity；
- editorial/final return；
- allowed owner actions 与 receipts。

画布 layout、selection、filter 和展开状态由 Workbench 拥有；业务终态都来自 owner。

### 3. Milestone 是 derived projection

建议 milestone：

```text
Intent compiled
Prototype ready
Scene packages promoted
Production generated/reviewed
Editorial returned
Final verification passed
Delivered
```

milestone 由 owner facts 计算并显示证据/缺口，不单独写一张 canonical milestone 表。`blocked` 是 scene/run overlay，项目仍显示其他场景进度。

### 4. 四 profile 共用一套 UI，差异进入规则摘要

Workbench 显示 primary profile、overlay 和 profile-specific obligations。UI 不为四个 profile 复制导航或状态机；只在 readiness inspector 中突出不同 risk/evidence/rights 项。

### 5. Decision box 只消费 owner-authored action

每个 decision item 包含 owner、action token/ref、expected revision、impact、cost/rights class、expiry 和 safe preview。提交后 Workbench 保存 transport receipt/refetch cursor，不保存第二份 approval state。同一 decision 在 DSH/CLI 完成后，Workbench 显示 owner terminal receipt。

### 6. Stale、partial 和 unavailable 必须是一级 UI 状态

某 owner 不可用时，Workbench 保留最后安全摘要并标记 stale/unavailable；禁止相关 mutation，但其他 owner/scene 仍可浏览和操作。缺数据不推断 pass，unknown 不变成 zero/none。

### 7. 外编与包只提供 handoff，不复制编辑器

Workbench 展示 Scaena working/sealed package、editor capability、handoff/return/rebase/verification receipt，并可发起获批 deep link/action。精确 timeline editing 交给外部 NLE；Workbench 不持有 editor-native project canon。

### 8. Transport 使用现有 WorkbenchClient/TaskService

浏览器调用 Task SDK typed client；Go service 通过 allowlisted owner adapters 获取安全投影和提交 typed action。Operation 自动投影到 SDK/HTTP/gRPC/JSON-RPC，保持 permission、cost、expected-version、idempotency 和 receipt parity。

## Compatibility and rollback

- 新 index/lens/operations 为 additive；现有 director canvas 和 `/agent` pane 保持。
- feature flag 关闭后回到现有 creative production lens；owner state 与 receipts 不受影响。
- Workbench 不做数据库迁移式 canonical takeover，因此回滚不需要反向数据迁移。

## Verification strategy

- fixture owner adapters 覆盖 complete/blocked/stale/unavailable/permission/cost/decision/final states。
- SDK/HTTP/gRPC/JSON-RPC parity 和 browser consumer tests。
- UI tests 验证 generated/selected 不显示为 accepted、placeholder 不显示为 complete、unknown 不显示为 zero。
- critical user path Playwright：open project→inspect blocker→owner decision→refetch→external return→final receipt。
