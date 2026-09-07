## Context

依据 2026-09-07 创作台程序。Anatomia 公共接口与视频观察合同（时间坐标、来源访问、观察记录）是其消费真源；原文快照不构成实施权威。

## Goals / Non-Goals

目标：在 DSH Pane 内完成「打开观察 → 浏览时间坐标/关键帧 → 发起范围分析 → 审阅 → 固定版本参考回填」的一条真实路径。

不做第二观察账本、客户端媒体重解码、绕过授权的关键帧抓取，或把审阅结论写回非 owner 存储。

## Decisions

1. Owner-fit：split-owner。Anatomia 拥有观察、证据与参考包版本；DSH 插件拥有 Pane 呈现与动作入口。
2. 时间坐标显示使用 owner 合同坐标系；坐标换算只在 adapter 层，不在组件内各自换算。
3. 关键帧/来源访问只用 owner 授权范围与 rendition；无授权范围时显示原因，不做客户端截帧。
4. 范围分析走 server-authored descriptor + 预览 + 确认；长任务经既有订阅/游标恢复语义观察。
5. 参考包消费固定版本：stale 版本标明并要求显式刷新比较；不自动采用最新包。
6. 审阅动作与结论保存分离：结论落 owner 审阅合同，不进插件存储。

## UI Contract

- Surface classification: adopted（ui-surface；画布节点内嵌证据缩略用 ui-visual-kit）
- Surface kind: workspace（分析主 Pane）+ inspector（时间轴/关键帧详情）
- First / second / third visual priority: 当前观察与时间轴 / 主要分析动作 / 证据来源与版本
- Existing components reused: ui-visual-kit token、既有媒体 renderer（rich-media）、官方 primitives
- Cards that earn existence: 证据卡（引用固定版本参考包）；无统计卡片墙
- Primary scroll owner: 时间轴/证据列表；详情独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 观察列表 | 保留最后内容 | 解释无观察 | owner 原因 | 列表+freshness | 标明范围外 | 权限原因 |
| 关键帧/来源 | 范围加载中 | 无授权范围说明 | 读取错误 | 授权 rendition | stale 标注 | 无授权禁用并解释 |
| 范围分析 | 预检中 | 无可选范围 | owner 错误 | 回执摘要 | 游标 gap 重读 | 权限原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回；时间轴折叠 | 导航/内容切换 | 时间轴+详情并列 |

### Accessibility

- Keyboard path: 列表→时间轴→分析→审阅全程键盘；Escape 回发起行
- Focus owner/return: 时间轴行；完成回发起行
- Visible labels and accessible names: 坐标/状态/版本文本化
- Reduced motion and coarse pointer: 时间轴动画禁用可关；触控 ≥44px

## Validation

focused adapter/组件测试先行；稳定后全门禁。真实分析闭环在 Anatomia staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，脱敏媒体路径与原始 payload。
