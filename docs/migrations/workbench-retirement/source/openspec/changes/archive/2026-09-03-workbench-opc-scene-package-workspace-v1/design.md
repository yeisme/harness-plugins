# Workbench OPC 场景生产工作区设计

## 1. Owner boundary

Workbench 是 Scaena projection 的视觉 consumer。它拥有 UI selection、expanded shot、local density、download progress 和 route state；Scaena 拥有 package、ProductionGraph、readiness、review、receipt、manifest、grant 和所有 mutation。

依赖关系：

~~~mermaid
flowchart LR
  S[Scaena OPC summary] --> A[Workbench typed connector]
  A --> P[Scene package view model]
  P --> U[Scene Workspace]
  P --> I[Exception Inbox]
  U --> X[Action detail / copy command]
  I --> X
  X --> T[TaskService owner action submit]
  T --> S
  S --> G[Export receipt + short-lived grant]
  G --> D[Workbench secure download]
~~~

浏览器不直连 Scaena owner API、Auctra、Eikona、Sonora 或 Provider；所有请求经 Workbench typed client/TaskService。

## 2. View model

新增 Workbench-local adapter model OPCScenePackageViewModel，由 Scaena summary 投影得到：

~~~text
packageRef/version/sourceRef
scene/episode/show refs
primaryAspect/secondaryAspect/reframeVariant
recommendedDepth/confirmedDepth/depthReason
currentStage/surfaceState/readiness/freshness/evidenceClass
humanGates[]
roleLabels[]
primaryBlocker
primaryAction
cost/rights/asset safe summaries
partial/animatic/export/grant refs
receipt/reconcile refs
~~~

该 view model 只用于渲染和查询缓存，不持久化 canonical 状态，不推断 action，不把缺失字段转换为 ready/pass/zero。

## 3. Information architecture

默认区域顺序：

1. Context bar：show、episode、scene、package version、freshness。
2. Now card：当前阶段、surface state、evidence label 和 package status。
3. Primary decision：一个 action，说明为什么、影响、成本、是否可逆和 expected version。
4. Gate rail：direction confirm、visual foundation accept、export confirm。
5. Scene graph：Scene → Shot → Asset；默认 summary，逐镜按需展开。
6. Exception inbox：rights、cost、stale、unknown、partial、owner offline。
7. Skills detail：显示导演/连续性/制片/剪辑声音角色；展开后才显示 skill source/version/digest。
8. Delivery card：animatic、manifest/checksum、export receipt 和短期下载 grant。

## 4. UI state machine

~~~mermaid
stateDiagram-v2
  [*] --> unresolved
  unresolved --> loading: open scene package
  loading --> ready: summary current
  loading --> empty: no package/input
  loading --> blocked: blocking fact
  loading --> partial: partial facts
  loading --> stale: freshness/digest drift
  loading --> offline: owner unavailable
  loading --> contract_mismatch: schema invalid
  ready --> action_pending: submit server action
  action_pending --> ready: owner receipt success
  action_pending --> reconcile_required: unknown/timeout
  action_pending --> stale: expected version mismatch
  reconcile_required --> loading: refetch/reconcile
  stale --> loading: refetch
  blocked --> loading: owner repair/revalidation
  partial --> loading: completed wave or repair
  ready --> download_pending: valid grant
  download_pending --> ready: download verified
  download_pending --> loading: grant expired
~~~

No UI state may claim owner success from HTTP 2xx, animation completion, cached data or optimistic local state.

## 5. Interaction rules

- Scene summary is the default; shot/frame details open only on user request.
- Buttons render from Scaena ActionDescriptor. Unknown or missing descriptor means disabled with reason.
- Action detail always shows target ref, expected version, side-effect class, confirmation, idempotency and a copyable real command/API method when supplied.
- After every mutation or context switch, refetch the owner projection. Do not patch local canonical fields.
- Double click is de-duplicated by TaskService idempotency identity; navigate-away keeps operation receipt and resumes on return.
- Unknown/partial/stale/offline never auto-retry, auto-switch model, auto-change budget or auto-accept.
- Secondary aspect is shown as a separate reframe variant. A crop-only or metadata-only response is a contract error.
- Cinematic is shown as an upgrade recommendation with impact and cost; it does not reuse balanced approval.

## 6. Package download

Workbench receives an owner-authored export receipt and short-lived grant. It displays package status, manifest digest and blocker summary before enabling download. The browser downloads the granted artifact only; it never assembles ZIP/PDF/CSV, rewrites manifest, or treats a local file as accepted.

Expired grant, changed package version, checksum mismatch or content-type mismatch returns a typed download error and asks for refetch. Partial package remains downloadable only with visible partial and production_ready=false.

## 7. Accessibility and responsive behavior

- All gates and actions are keyboard reachable with visible focus.
- Loading, stale, partial, blocked and offline are conveyed by text plus icon/state, never color alone.
- Action detail uses an accessible dialog with focus return to the originating action.
- Scene graph supports 1440, 1024, 768 and 390px widths; mobile collapses inspector sections but keeps Now, Why, Next and blocker visible.
- Reduced-motion preference disables animated progress transitions.
- Screen readers receive current stage, gate state, blocker, action label and receipt status in a stable order.

## 8. Compatibility and rollback

- Existing Director Canvas, Film Project Index, Review Inbox and TaskService contracts remain readable.
- New adapter fields are optional and unknown-field rejection follows the existing contract normalizers.
- Feature flag/profile opc-scene-package-v1 gates the new view. When disabled, existing Creative Production Lens and /drama handoff continue.
- Rollback hides the new view and clears only view cache; it does not delete owner refs, receipts, manifests or package artifacts.
