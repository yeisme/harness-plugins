# Workbench Desktop 与 Daily Operations R3 提案

## Why

Workbench 已有 React/Dockview shell、项目/资源安全投影、Task/Gate/Activity 面板和 Open Design Studio 体验，但当前 Chrome/Overview 等仍不完全由 root Dockview 管理，layout 主要保存在 `localStorage`，Asset、WorkItem、Inbox、Approval、Delivery 也尚未形成可持久化、可授权、可审计的生产闭环。R3 需要把现有可运行 demo 收敛成真实 tenant 团队可每天使用的运营桌面，而不是继续增加孤立面板。

## What Changes

- 将整个业务 viewport 迁入 root `WorkbenchDesktop`，使用版本化 PaneDocument/PaneInstance/PaneContext registry 管理 Overview、Workspace、Task、Connections、Asset、WorkItem、Inbox、Approval、Activity、Delivery、Team 与 Diagnostics。
- 建立 URL/history 与 Pane reducer：深链、刷新、back/forward、打开/聚焦/关闭/移动/最大化/全屏/恢复必须可预测且不会循环写 history。
- 用服务端 `LayoutService v3` 替代 `localStorage` 作为 canonical layout；支持 preset、save copy、expected-version、conflict rescue、corruption recovery 和 tenant-bound profile。
- 建立 Asset Catalog/Collection/SavedView/Search，只索引 R2 Owner safe projection、rights/lineage/freshness 和 opaque refs，不保存 artifact bytes、private path、raw payload 或完整内容。
- 建立 WorkItem 状态机、负责人、依赖、验收条件、Asset/Task links、version/audit；Task 成功不自动等于 WorkItem 完成。
- 建立 Action Inbox、Approval queue、Activity timeline 和 Delivery index，把 gate、unknown_accept、stale projection、failed/partial Task、review/handoff readiness 汇入同一运营闭环。
- Team Pane 只消费 R1 Identity projection/allowed actions；Owner/Studio handoff 只消费 R2 approved connector/descriptor/receipt。
- 增加 desktop/tablet/mobile responsive、keyboard equivalents、200% zoom、screen reader、reduced motion、virtualization、pagination 与容量预算。
- 不在 R3 创建 screenplay/ProductionGraph/image/audio editor、Owner canonical state、跨 Owner saga、Identity provider、Spatial Board 或 production release automation。

## Capabilities

### New Capabilities

- `workbench-pane-desktop`: 定义 root Pane Desktop、Pane registry、route/history、LayoutService v3、恢复/全屏/响应式/无障碍合同。
- `workbench-daily-operations`: 定义 Asset/Search、WorkItem、Inbox/Approval/Activity/Delivery 日常运营服务、状态、权限、版本、审计和用户闭环。

### Modified Capabilities

- 无；R3 在 R0 foundation、R1 identity/access 与 R2 owner integration 上增量交付。

## Impact

- Web：`apps/web/src/workbench/**` 重构为 app shell/desktop/pane registry/layout/router/features；现有 `studio/**` 保持专项 Owner workflow，不成为通用 desktop 真源。
- Go service：新增 `service/internal/layout/**`、`assets/**`、`search/**`、`workitems/**`、`inbox/**`、`approvals/**`、`activity/**`、`delivery/**` 与 GORM repositories/migrations。
- 合同/SDK：新增 Layout、Asset、Collection、SavedView、Search、WorkItem、InboxItem、Approval、Activity、Delivery typed contracts，并保持 HTTP/gRPC/JSON-RPC/SDK parity。
- 数据：只保存 Workbench-owned layout/work item/queue metadata 与 Owner safe projection index；不复制 Owner canonical content/blob/prompt/private path。
- 依赖：managed production 必须通过 R1 Principal/tenant/access；Owner projection/handoff 必须通过 R2 contract promotion。未晋级 dependency 必须显示 `needs_contract`/`degraded`，不得使用 fixture 伪造用户闭环。
- 性能基线：100k AssetEntries/workspace、50k active WorkItems/tenant、20 restored panes、200 SSE sessions/instance；最终 SLO 由 benchmark/soak evidence 冻结。
