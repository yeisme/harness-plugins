# Workbench Project Data Next Slice 提案（project-data 12.4）

## Why

`workbench-project-data-workspaces-v1` 的首期切片（四视图、五角色、9 custom field kinds、三类首发 trigger、一个低风险 Owner canary）已交付并取得真实证据：disposable PostgreSQL 上的 50k WorkItem/64 字段查询容量（无 N+1、keyset 深分页、EXPLAIN 命中索引）、200 流 watch 扇出、真实 Owner mutation canary（receipt/status/reconcile/kill switch）、schema 字段替换迁移引擎（expand→shadow→compare→enable）。First-slice freeze（0.2）保留的下一批 capability 需要基于这些证据重新做 fit/split-owner/reject-now 决定，而不是默认全部排期。

## What Changes（next-slice ledger）

| capability | 决定 | 依据（证据驱动） | owner |
|---|---|---|---|
| form intake 视图 | deliver-next | 表单=视图 kind + schema 校验复用，无新真值；table/kanban 已验证列/字段渲染管线 | workbench web lane |
| formula 字段 | retain-next（拆两期） | 计算字段引入求值真值与缓存失效责任，须独立合同（求值顺序、失败语义、hidden 字段参与规则）；本 change 未验证 | workbench project lane |
| lookup 字段 | retain-next | 依赖 cross-dataset 读取的权限裁剪与 N+1 预算（11.4 只验证了单 dataset 查询） | workbench project lane |
| cross-dataset relation | retain-next | 同上；关系完整性（删除/归档级联）未设计 | workbench project lane |
| dashboard 聚合 | reject-now | 无真实使用证据；table/kanban 聚合视图已覆盖首期诉求，先收集使用信号 | product |
| comment/notification | retain-next（跨项目） | 通知通道合同（identity/IM）不在 workbench 边界内；需要跨项目 OpenSpec | 跨项目 routing |

非目标：通用低代码/BPMN 平台化范围（0.2 non-goals 维持）；schema 9 kinds 之外的新字段 kind（走独立合同 change）。

## Impact

- Affected specs: `workbench-project-data-workspaces`（新增 next-slice 决策要求：retain-next 项不得静默删除，逐项 reopen 时须重新 fit/split-owner）。
- Affected code: 无（本 change 仅冻结决策；各 deliver-next/retain-next 项各自开实现 change）。
- 依赖：12.3 staging soak 结论（lag/latency 预算）可能调整 form intake 的优先级。r5 run 已通过（24h、p95=1ms/p99=2ms、error=0），不触发降级。
- 决策台账：逐项判定、理由、owner-fit 与 reopen 证据门槛落 `details/next-slice-decision-ledger.md`（2026-08-27 冻结，Tasks 1.1–1.5 全部完成）。
