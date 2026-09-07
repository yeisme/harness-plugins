# Workbench Project Data Next Slice Tasks

- [x] 1.1 form intake 视图：schema 校验复用 + 视图 kind 合同 + 断网/冲突状态（owner: web lane；dependencies: project-data v1 归档）
  - **Evidence (2026-08-27):** 决策落台账 `details/next-slice-decision-ledger.md` §1.1：`deliver-next`、owner-fit `fit`（workbench web lane，v1 P14 unresolved owner 就此收敛）。理由：表单=新视图 kind + schema 校验复用，无新真值；table/kanban 已验证列/字段渲染管线；12.3 staging soak r5 通过（24h、10087 次观测、p95=1ms/p99=2ms、error=0，receipt `a048fd98-…-e04477cd6914`），lag/latency 预算不构成降级理由。实现 change 必备合同（视图 kind 进 ProjectView closed union、断网/冲突走 expected-version 语义、反滥用未设计前公开入口保持 `needs_contract`）已逐项列出。
- [x] 1.2 formula 字段合同（求值顺序/失败语义/hidden 参与）；实现拆为独立 change（owner: project lane）
  - **Evidence (2026-08-27):** 决策落台账 §1.2：`retain-next`（拆两期），owner-fit `fit`（workbench project lane）。理由：计算字段引入求值真值与缓存失效责任，求值顺序/失败语义/hidden 字段参与规则构成独立合同，本 change 未验证。Reopen 门槛（独立 spec + 表达式闭集安全证据 + 50k 性能证据）已写明；合同设计与实现分两个后继 change，不在本期。
- [x] 1.3 cross-dataset 读取权限裁剪与 N+1 预算验证后 reopen lookup/relation（owner: project lane）
  - **Evidence (2026-08-27):** 决策落台账 §1.3：lookup 与 cross-dataset relation 均 `retain-next`，owner-fit `fit`（workbench project lane），绑定同一组前置证据同期 reopen。理由：11.4 容量证据只验证单 dataset 查询，多 dataset 权限裁剪与 N+1 预算无实测；relation 的删除/归档级联语义未设计。Reopen 门槛（权限裁剪设计+越权矩阵、多 dataset 扇出实测、级联 spec+迁移兼容证据）已写明。
- [x] 1.4 dashboard：收集 table/kanban 聚合真实使用信号后再提案（owner: product）
  - **Evidence (2026-08-27):** 决策落台账 §1.4：`reject-now`（非永久删除），owner: product。理由：无真实使用证据，table/kanban 分组/聚合视图已覆盖首期诉求；v1 ledger 中 dashboard 为 P15 optional→later，非用户硬要求能力，reject-now 不违反不静默删项纪律。信号收集路径与再提案门槛（量化使用信号）已写明。
- [x] 1.5 comment/notification：跨项目通知通道合同提案（owner: root routing）
  - **Evidence (2026-08-27):** 决策落台账 §1.5：`retain-next`（跨项目），owner-fit `split-owner`，owner: 跨项目 routing（root）。理由：通知通道合同（identity/IM 投递、通道、偏好）不在 Workbench 边界内，需 root routing 先开跨项目 OpenSpec 定 owner 拆分与通道合同；Workbench 侧只作可见宿主（safe projection/深链），不自建投递。跨项目提案本身如实 open，由 root routing 另行开立，不在本 change 任务范围。
