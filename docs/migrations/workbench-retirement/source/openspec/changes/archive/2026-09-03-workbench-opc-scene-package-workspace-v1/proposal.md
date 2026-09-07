# Workbench OPC 场景生产工作区

## Why

个人 OPC 需要一个媒体优先的主创作入口，而不是在多个 provider/owner 页面之间跳转。Workbench 已有 Creative Production Lens、Director Canvas、Review Inbox、Film Project Index 和 TaskService；本 change 将它们组合为 Scaena OPC 场景包工作区，不复制 Scaena 的生产状态。

## What Changes

- 在现有 /agent Creative Production Lens 中新增 OPC scene package workspace projection adapter。
- 以 Scene → Shot → Asset 为主层级，默认先展示场景摘要、当前 gate、阻塞、成本、证据和一个 primary action；逐镜细节按需展开。
- 以按钮触发 server-authored action；详情面板显示真实 CLI/API action、target、expected version、side-effect class、成本、Skill role 和复制命令。
- 展示 9:16/16:9 primary 与 successor reframe variant，展示 balanced/cinematic recommendation、confirmed value 和 amendment 状态。
- Review Inbox 只呈现 direction confirm、visual foundation accept、export confirm 以及触发的 rights/cost/stale/unknown/partial 异常。
- 使用 Scaena export receipt 与短期 grant 下载 package；浏览器不拼包、不写 manifest、不调用 Auctra/Eikona/Sonora。
- owner offline、stale、partial、unknown、contract mismatch 均保留已知事实并禁用依赖缺失事实的 mutation。

## Non-Goals

- 不新增 Workbench domain state、ProductionGraph、review ledger、asset store 或 package assembler。
- 不直连 Auctra、Eikona、Sonora、Provider 或 Scaena 私有数据库。
- 不新增通用 Canvas、多人权限、自动发布、计费或行为 telemetry。
- 不修改现有 Director Canvas、Film Project Index、Review Inbox 和 TaskService 的旧语义。

## Impact

- UI：现有 Creative Production Lens / Director Canvas / Review Inbox 的 additive route/view。
- SDK：新增 Scaena OPC summary mapper 和安全 package download action 输入，复用现有 owner connector、action/receipt contracts。
- Tests：Vitest + Testing Library，关键下载和 action/reconcile 路径使用现有 Playwright harness。
- Handoff：Scaena owner contract 为 OPCScenePackageSummaryV1alpha1；DSH 通过同一 summary/action identity 消费。
