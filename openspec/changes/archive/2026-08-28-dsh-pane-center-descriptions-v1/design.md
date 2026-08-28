# Design: DSH Pane Center 窗格详细描述

## Context

窗格中心（`PaneManagementCenter`）由 `dsh-pane-management-center-v1` 建立：单一 Modal 内聚合 pane/tab/history/conversation/workspace 五类条目，`buildPaneManagementEntries` 产出 `PaneManagementEntryV1`，`filterAndRankPaneEntries` 做匹配排序，>50 行走固定行高虚拟滚动。协议层 `PanePresentationSchema` 已含 `description`（`SummarySchema` 有界），`PaneViewRegistrationV1.i18n.descriptionKey` 已在 `dsh-pane-management-i18n` 中定义并被 registry 校验，但两者均无消费面。

## Goals / Non-Goals

- Goals：描述进条目模型、进搜索匹配、进结果行；提供一处查看窗格完整元信息的详情位；内置窗格有真实可看的描述。
- Non-Goals：不做 markdown/富文本描述；不做描述点击跳转；不持久化描述；不改排序权重公式（描述只参与「是否命中」，不改变既有 score 构成）；不做详情侧栏布局重构。

## Decisions

### D1 描述解析链固定为 i18n key → descriptor

`registration.i18n.descriptionKey` 经 `t()` 解析（missing key 回落，不显示 raw key）；否则 `descriptor.presentation.description`。pane/tab/history 条目共享同一注册的描述（instance 上没有文本摘要字段——`preview` 是 boolean 标志——因此不做实例级兜底）；conversation 条目以 host 片段为描述，workspace 条目用 host 提供的 optional `description`。解析在 `buildPaneManagementEntries` 内完成，locale revision 进入 useMemo 依赖保证热切换刷新。

### D2 详情条用「列表外 sticky 面板」而非行内展开

候选方案：a) 行内展开详情块——破坏 `windowVirtualRows` 的 44px 固定行高假设，>50 行时滚动数学漂移；b) VSCode Quick Pick 式详情条——置于筛选区与列表之间，单份 DOM，零虚拟化影响。选 b。详情条由 `detailEntry` 状态驱动：info 按钮 / ArrowRight（在行主按钮上）设置，ArrowLeft / 关闭按钮清除，query 变化时自动清除避免陈旧。同时行内仍保留一行省略描述（`title` 全文提示），满足快速扫读。

### D3 `PaneWorkspaceSearchItemV1.description` 为 optional additive host 摘要

远端工作区搜索结果的描述由 host projection 提供，客户端只做长度上限（240 字符）截断保护后展示；不校验语义、不执行任何内容。缺失即不渲染。

### D4 元数据有界集

详情条展示：完整描述（诚实空态「暂无详细描述」）、来源、提供方、类型、角色、区域、状态 tokens、关键词、工作区（workspaceRef 解析 label）、关闭时间（history 批次 closedAt）、对话片段（conversation snippet）+ 更新时间。全部来自既有 entry 字段，无新增 host 请求。

### D5 详情条是嵌套浮层：Escape 先收最内层，收起后焦点回归触发行

窗格中心已有一条嵌套链：Escape 先关 target（打开位置）选择器再关对话框。详情条是最内层浮层，插入链首：Escape → 收起详情条 → 关 target → 关窗格中心。焦点方面，Hide 按钮收起后自身卸载，若不显式归还焦点会落到 body（键盘用户丢失位置）；因此收起时把焦点移回触发行的 info 按钮——行仍在 DOM（详情条清除不卸载行），可寻址、可继续 ArrowUp/Down。

## Risks / Trade-offs

- 行高从两行 copy 变三行（含描述行）会略增高度：描述行仅在存在描述时渲染，min-height 不变，无布局合同破坏。
- 详情条占据列表上方空间：空态不占位（无 detailEntry 时完全不渲染）。
- locale 热切换需要 entries 重算：locale revision 已是既有订阅面，进依赖即可。

## Migration Plan / Rollback

纯 additive UI 层变更，无持久化 schema 变更，回滚即还原渲染；descriptor 的 `presentation.description` 对旧版本 registry 是已定义 optional 字段，天然向后兼容。

## Open Questions

无。
