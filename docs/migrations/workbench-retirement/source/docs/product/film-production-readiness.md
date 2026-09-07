# Film Production Readiness

## 2026-09-02 OPC 场景包入口

个人 OPC 的默认视觉入口是 /agent Creative Production Lens 中的 Scene Workspace。它消费 Scaena 的 OPCScenePackageSummaryV1alpha1，以 Scene → Shot → Asset 为层级，先显示当前阶段、首要 blocker、一个 primary action、三个核心人类门、成本/权利摘要和交付状态，再按需展开逐镜细节。

9:16 与 16:9 都是 formal aspect；secondary aspect 只能以独立 successor reframe variant 出现。balanced 为默认质量档，cinematic 是带影响和成本说明的显式升级。Workbench 不拼包、不写 manifest、不调用 provider，也不复制 Scaena canonical state；partial、stale、offline、unknown 均保留已知事实并禁用依赖缺失事实的 mutation。跨入口 action/receipt 语义与 DSH /drama 保持一致。

`/agent` 的 Film Production Readiness 是一个 `fit` 的 Workbench 组合视图：它帮助团队浏览 Project → Sequence → Scene → Shot/Asset 的安全投影与下一步，但不拥有剧本、素材、预算账本、生产 acceptance、音频、时间线或最终交付状态。

## 四种生产 profile

同一视图承载短片、剧集、广告/品牌片与长片四种 profile。profile 只改变 owner 投影中的 obligations、风险与证据摘要；它不创建四套导航或本地状态机。

## 真值与可用性

`workbench.film_project_index.v1` 只包含 refs、revision、digest、freshness、availability、milestone、Project → Sequence → Scene → Shot/Asset 关系以及 audio/budget/run/continuity/editorial/final 的安全摘要。`stale`、`partial`、`unavailable`、`needs_contract`、`permission_required`、`offline`、`contract_mismatch`、`unknown` 和 `blocked` 均为一级事实：unknown 不显示为零风险/完成，selected/generated 不显示为 accepted。

一个 owner 缺失或过期时，相关 mutation 禁用；其他 scene 和 owner 继续可读。浏览器不直连 owner，也不会读取 owner 私有数据库、路径、blob、provider payload 或 credential。

## 决策与外编

Decision box 仅接收 owner-authored action ref、expected revision 与 idempotency key。只允许 project lead 提交；提交后必须重新读取 owner receipt，Workbench 不乐观写入 accepted、delivered、waiver 或 final 状态。`pending_refetch`、`stale`、`unknown_accept`、`already_decided`、`owner_receipt` 以原样显示；`unknown_accept` 只提供 reconcile/refetch，绝不自动重试或伪造终态。

本地 adapter 的 binding source 和 classification 必须显式标成 `fixture_provider_free` 及其 availability。它是 provider-free 测试输入，不是 Owner SDK；Auctra/Eikona/Sonora/Aigora/Scaena/Ordo exact binding 在稳定 typed contract 发布前始终是 pending。

工作/密封 package、外部编辑器 handoff、return/rebase 和 final verification 只以 safe ref/approved action/deep-link 形式出现。精确 timeline editing 留在外部 NLE 和 Scaena；Workbench 不实现第二个 NLE。
