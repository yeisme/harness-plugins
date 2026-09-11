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

### 转写能力只读列表增量

- Surface classification：adopted，嵌在既有audio workspace Section中；不新建主壳、音频运行器或报价系统。
- 视觉顺序：能力探测边界→provider/model与fixture标记→语言/精度/费用/限制→失败provider。复用SurfaceSection、SurfaceState、官方Button及cs/vk token；以列表和dl表达，不做卡片墙。
- 状态：首次loading；空profiles仅说明未返回可用项；缺诊断标志显式unknown；刷新失败保留旧目录并标stale；不可用provider保留ID、稳定错误码与owner配置提示，无假执行按钮。
- 响应式：360/560/960下字段和值两列、长ref换行，沿用workspace滚动；键盘Tab/Enter刷新；不引入动画。完整context key变化卸载旧读，组件请求代次忽略迟到结果。
- 中英文及生成pseudo覆盖transcription.cap命名空间。能力目录不给出实际执行报价，不将external_runtime或未知费用换算为零，不从segment合成word能力。当前只覆盖转写，TTS/music/SFX/clone矩阵仍需各自owner合同。

独立目录读取：Creator Gateway/Remote新增readTranscriptionCatalog，浏览器传入当前完整Creator context；Host核对当前授权scope、directory generation和adapter身份，迟到结果不跨上下文返回。它不进入字幕执行snapshot，也不参与费用确认；即使目录探测等待，已审阅字幕仍可直接导出。客户端仅在snapshot上下文建立后读取，reset/dispose或上下文变化丢弃结果。

能力矩阵输入合同增量：Host仅消费Sonora的capability_probe目录，保留fixture、失败provider和诊断是否可用；cost_model为外部runtime或未知时不能显示零费用，探测成功不能代替生成预览/确认。缺失诊断标志表示未知，不能把缺失provider视为删除。此数据读取与字幕导出独立，后续UI不得要求ASR目录就绪才允许已审阅字幕导出。

### 字幕回执结果查看与下载增量

- Surface classification：沿用声音workspace内的adopted Section，不增加主壳或CSS系统；遵循`docs/design/dsh-unified-panel-visual-system.md`。
- 视觉顺序：已有确认/执行区域→字幕成果按钮→用户主动打开的固定版本正文。新回执只更新可选入口，不自动替换当前阅读。
- 复用SurfaceSection、SurfaceState、官方Button/CodeBlock、现有cs-actions和locale。正文读取继续走readArtifactContent，不放入snapshot或持久浏览器store。
- 状态：无成果不显示；打开时loading；读取失败/版本变化/超限显示可重试错误；成功预览并提供下载；下载前独立重新授权读取，拒绝时不生成Blob。正文绝不截断后作为完整文件下载。
- 响应式：360/560/960px沿用workspace scroll与按钮换行；不强制展开并排Pane。键盘Tab/Enter可完成查看/下载；无新动画、焦点劫持或颜色例外。
- 中英文及自动生成pseudo使用subtitle.results命名空间，CodeBlock使用字幕专用复制标签及共享复制成功标签。当前正文始终显示已选成果名称与完整版本号；新回执的入口不改变该标识，长摘要在窄Pane换行。完整Creator context作为组件key，项目/权限身份变化卸载并丢弃迟到读结果。
- 当前scope：标准正文接口支持的完整字幕可保存为SRT/WebVTT；超过256Ki字符仍需owner文件下载能力，不能把这个子路径视为整个声音台交付。
- 当前primitive构建的CodeBlock CSS导出为空，复制按钮缺少可读底色；仅在cs-subtitle-code内补充共享token按钮/焦点样式，不改变官方组件结构。外层查看/下载按钮直接使用既有vk-btn class。

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
