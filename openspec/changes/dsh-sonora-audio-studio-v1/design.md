## Context

依据 2026-09-07 创作台程序。Sonora workflow/subtitle/tts 命令合同是消费真源；现有 segment-to-cue 不是 word-level alignment 的证明。

## Goals / Non-Goals

目标：在 DSH Pane 内完成「选择声音/字幕工作 → 动作预览 → 确认执行 → 成果试听/校对 → 交接回填」的一条真实路径。

不做第二音频运行时、客户端 TTS/对齐、把 segment-to-cue 当 word-level alignment，或无导出合同时伪造 SRT/VTT 下载。

## Decisions

1. Owner-fit：split-owner。Sonora 拥有声音执行、对齐与字幕产物；DSH 插件拥有 Pane 呈现与动作入口。
2. provider 能力矩阵来自 owner 描述（声音列表、字幕格式、对齐精度、导出格式），支持/缺失/未验证逐项标注；缺失保留禁用入口并显示原因。
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

## 页面、控件与验收补全

[完整页面设计](../../../docs/design/dsh-sonora-audio-studio.md)是本change的UI细化，和本design共同约束实施。所有页面均为required；配音、音乐、音效都为required设计能力，不能只验证TTS就关闭整个声音台。当前部分provider的voice clone未稳定开放，music fixture/preview不代表生产ready；字幕精度/导出按owner能力处理。对确认缺口创建Sonora配套任务，不以永久disabled结项。

| 工作页 | 控件与动作 | 关键行为 |
|---|---|---|
| 声音与生成 | 台词/角色声音、配音/音乐/音效、provider/target、参数和预算 | 分任务类型发现实际能力；确认后生成或导入授权配音 |
| 候选与片段 | 播放、时间范围、候选切换、时长/质量、基础修改与采用 | 版本固定，新的候选不抢当前试听；缺能力不本地伪造 |
| 字幕与对齐 | 转写、cue、时间码、可读性/对齐finding、镜头关联 | segment-to-cue不等于word-level alignment或SRT/VTT导出 |
| 资产与交接 | 声音版本、权利/质量/审阅、目标镜头与交接 | 试听、handoff_ready与Scaena生产采用保持不同 |

完整路径：选定台词/片段→配音/音乐/音效→试听比较→审阅采用→字幕/对齐核验→镜头绑定或支持的导出。重点恢复：unknown费用、clone不可用、试听切版本、cue越界、rights拒绝、stale handoff digest、fixture不冒充production。第4组质量/真实验收依赖新增5.1–5.4，不能只交付列表和通用descriptor便关闭。

### UI Contract补全

- 内容主体是主要滚动owner，参数/证据独立滚动；不劫持Composer滚轮或IME。
- 复用CreatorActionComposer、artifact-workspace、ui-surface/visual-kit、官方Button/Input/Menu/Modal/DiffBlock与rich-media；不新建私有atoms。
- 图形/媒体选择必须有列表或菜单等价操作；新结果不抢焦点，关闭对话框回到触发控件。
- 视觉例外：无；不复制Workbench CSS，不增加第二主壳或万能领域表单系统。

## 依赖与回滚补全

本领域直接操作只依赖DSH host与`cli/sonora`；画布回填、跨领域编排按能力单独接入，不阻塞独立页面。已确认缺口在owner创建最小配套change，而不是在插件中实现领域状态。任务5.1必须留下负责方/操作/所需交付物/受影响任务/双向链接。

默认additive演进；旧kind、方法和closed schema保持兼容。新接口schema由CLI/owner生成，未知critical版本拒绝。禁用本Pane不删除草稿、资源或运行；原operation仍通过原owner查询/对账。采用candidate不自动写源文件、晋级Canon或发布。
