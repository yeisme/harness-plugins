## Context

依据 2026-09-07 创作台程序。Sonora workflow/subtitle/tts 命令合同是消费真源；现有 segment-to-cue 不是 word-level alignment 的证明。

## Goals / Non-Goals

目标：在 DSH Pane 内完成「选择声音/字幕工作 → 动作预览 → 确认执行 → 成果试听/校对 → 交接回填」的一条真实路径。

不做第二音频运行时、客户端 TTS/对齐、把 segment-to-cue 当 word-level alignment，或无导出合同时伪造 SRT/VTT 下载。

## Decisions

1. Owner-fit：split-owner。Sonora 拥有声音执行、对齐与字幕产物；DSH 插件拥有 Pane 呈现与动作入口。
2. provider 能力矩阵来自 owner 描述（声音列表、字幕格式、对齐精度、导出格式），支持/缺失/未验证逐项标注；缺失不渲染入口。
3. 试听使用 owner 授权 rendition 与既有媒体 renderer；不做本地转码。
4. 动作走 server-authored descriptor + 预览 + 确认；长任务订阅/游标恢复；取消以 owner 确认为准。
5. 交接分别取得 owner receipt、版本与目标 scope；字幕/对齐产物按固定版本消费。
6. 对白文本编辑属文本台/引用工作区职责；本台只消费对齐后的 segment 结构。

## UI Contract

- Surface classification: adopted（ui-surface；画布节点内嵌波形/字幕缩略用 ui-visual-kit）
- Surface kind: workspace（声音主 Pane）+ inspector（segment/字幕详情）
- First / second / third visual priority: 当前声音工作与状态 / 主要执行动作 / 能力矩阵与产物版本
- Existing components reused: ui-visual-kit token、rich-media 音频 renderer、既有候选比较、官方 primitives
- Cards that earn existence: 产物/交接证据卡；无统计卡片墙
- Primary scroll owner: 声音工作/segment 列表；详情独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 声音工作列表 | 保留最后内容 | 解释无工作 | owner 原因 | 列表+freshness | 标明缺失 | 权限原因 |
| 能力矩阵 | 加载中 | 无 provider 说明 | owner 错误 | 矩阵 | 未验证标注 | 缺失能力禁用并解释 |
| 执行/交接 | 预检中 | 无可执行说明 | owner 错误 | 回执+产物 ref | 游标 gap 重读 | 未确认禁用 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回 | 导航/内容切换 | 列表+详情并列 |

### Accessibility

- Keyboard path: 列表→详情→动作→确认全程键盘；Escape 回发起行
- Focus owner/return: 列表行；完成回发起行
- Visible labels and accessible names: 能力/版本/状态文本化；音频有文字替代
- Reduced motion and coarse pointer: 动画可关；触控 ≥44px

## Validation

focused adapter/组件测试先行；稳定后全门禁。真实声音闭环在 Sonora staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，脱敏 provider payload 与凭据。
