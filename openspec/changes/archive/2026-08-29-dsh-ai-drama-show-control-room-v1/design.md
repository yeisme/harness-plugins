## Context

主规格此前把 Episode Board、批量 Review、跨集 Asset Wall 与 Delivery 全部留给 Workbench。用户现在要求 DSH 内提供全剧控制台，但本仓仍不能拥有 Episode、Review、Approval、Run 或 Delivery canonical state。仓内也没有真实 Auctra/Scaena/Eikona/Sonora adapter，因此实现必须以 adapter contract、typed fake 和 fail-closed probe 完成。

## Goals / Non-Goals

**Goals:**

- 提供单 show 绑定的全剧 safe projection、分页与 owner action gateway。
- 新增四个高密度 Pane、命令和 show-control preset。
- 支持最多 100 个显式已加载目标的 preview-before-submit 批量动作。

**Non-Goals:**

- 不创建 show/episode/review/delivery ledger、scheduler 或 writer lease。
- 不接受“当前筛选全部未来项”式动态批量目标。
- 不通过浏览器参数切换 tenant/workspace/principal。

## Decisions

1. Director Host 增加独立 `DramaShowControlOwnerAdapterV1` 目录；adapter 由领域 bundle 注册并返回 opaque refs、有界摘要、version、freshness、evidence refs 和 action descriptor。
2. Remote 采用 `v1alpha1` additive methods：summary snapshot 与 episodes/reviews/assets/delivery 分页分离，避免一个无界 snapshot。
3. 所有 page 默认 limit 50、最大 100；cursor opaque。Client selection 仅含当前加载实体，最大 100，filter/show/snapshot generation 变化即清空。
4. 批量 preview 请求仅含 intent、显式 target refs/versions、show revision 和 idempotency key。Owner 返回以 opaque batch target 为 targetRef 的标准 PaneActionDescriptorV1，dispatch 继续复用 PaneActionRequest/Receipt。
5. `show-control` preset 与旧 `director` preset 并存。Tier 0 打开 Show Board、Review Inbox、Run、Delivery 四个 tab；Asset Wall 按需。
6. UI Spec：SaaS operations console；Show Board/Asset Wall 使用 table/list + inspector，Review Inbox 使用 approval queue，Delivery 使用 readiness matrix；桌面高密度，390px 转为纵向 list/detail。

## Risks / Trade-offs

- [真实 owner adapter 尚未存在] → 本仓以 conformance fake 验收，生产 UI 显示 needs_contract 和安装指引。
- [多个 owner freshness 不一致] → 页面保留 segment freshness，任何批量 mutation 要求所有目标与 descriptor fresh。
- [大剧资源量] → cursor paging、bounded selection、只渲染当前 page，不持久化 domain content。

## Migration Plan

1. 发布 Host contracts/directory/gateway 与 disabled-only probe。
2. 发布 Client controller 与四 Pane。
3. 注册新 commands/preset/Creator Home 入口。
4. owner adapters 后续独立接入；未接入不阻塞本仓完成。
5. 回滚为关闭 `drama.show-control.v1` probe 或回退 bundle RC；旧 Director 不受影响。

## Open Questions

无；跨租户与动态全选明确不进入 V1。
