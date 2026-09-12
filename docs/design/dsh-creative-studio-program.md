# DSH 创作画布与五个专业工作台

本方案依据 2026-09-07 已确认的产品访谈。已进入实施：画布编辑内核、Host保存与首个React Flow Pane切片已有分层测试证据，详见[实现基线](../../openspec/changes/dsh-project-canvas-continuity-v1/implementation-baseline.md)。五个专业闭环和跨领域执行尚未验收；八份 tasks 均独立验收，不继承旧 Workbench 完成证据。独立 Workbench 已退役，本项目不恢复其主壳、BFF、TaskService 或托管平台。

新增的做剧可视化流水线设计由 [dsh-creative-pipeline-visual-workbench-v1](../../openspec/changes/dsh-creative-pipeline-visual-workbench-v1/) 承接：它复用本方案的项目画布和专业 Pane，把 Agent 定位为背景上下文与已确认流水线的控制辅助。

## 1. 产品结构与能力保留

用户在同一 DSH 项目中组织素材、配置操作、运行选定范围、比较并采用成果，再完成跨领域制作。用户可以直接操作，Agent 可以辅助编辑授权范围内的草稿；执行需独立确认。

| 能力 | 准入与权威 | 用户入口 | 承接 change |
|---|---|---|---|
| 项目画布、位置、Draft、选区与恢复 | fit；DSH 插件 host 保存呈现数据 | 项目 Pane | [画布](../../openspec/changes/dsh-project-canvas-continuity-v1/tasks.md) |
| 可执行连接、范围预览与运行观察 | split-owner；插件编辑草案，领域 owner/Ordo 执行 | 画布节点、运行 Inspector | [工作流](../../openspec/changes/dsh-creative-workflow-v1/tasks.md) |
| 图像生成、修改与资产 | split-owner；Eikona | [生成台](../../openspec/changes/dsh-eikona-studio-v1/design.md) | [Eikona](../../openspec/changes/dsh-eikona-studio-v1/tasks.md) |
| 视频分析、证据与参考提取 | split-owner；Anatomia | [分析台](../../openspec/changes/dsh-anatomia-analysis-studio-v1/design.md) | [Anatomia](../../openspec/changes/dsh-anatomia-analysis-studio-v1/tasks.md) |
| 镜头级制作、编排与交付 | split-owner；Scaena | [制作台](../../openspec/changes/dsh-scaena-production-studio-v1/design.md) | [Scaena](../../openspec/changes/dsh-scaena-production-studio-v1/tasks.md) |
| 小说、剧本和文本版本 | split-owner；Auctra | [文本台](../../openspec/changes/dsh-auctra-writing-studio-v1/design.md) | [Auctra](../../openspec/changes/dsh-auctra-writing-studio-v1/tasks.md) |
| 配音、音乐、音效、字幕与交接 | split-owner；Sonora | [声音台](../../openspec/changes/dsh-sonora-audio-studio-v1/design.md) | [Sonora](../../openspec/changes/dsh-sonora-audio-studio-v1/tasks.md) |
| 完整创作路径及跨项目故障恢复 | split-owner；各 owner 维护自身状态 | 共用画布和 Pane | [综合验收](../../openspec/changes/dsh-creative-cross-owner-journeys-v1/tasks.md) |

五个专业 Pane 都是 required，分别交付；任何一个 Pane 都不以其他专业 Pane、画布或 Ordo 完成为其直接操作前置。单领域内部 workflow 使用该 owner 的原引擎；跨领域调度使用 Ordo，不在浏览器或插件 host 新建执行循环。

## 2. 统一布局

```text
DSH 原有导航 / 项目与会话
┌────────────────┬──────────────────────────┬────────────────────┐
│ 当前会话       │ 项目画布 或 专业主 Pane  │ 专业 Pane / 详情    │
│ Agent 对话     │ 节点、媒体、时间线、正文 │ 完整参数、版本比较  │
│ 原有 Composer  │                         │ 来源、证据、运行    │
└────────────────┴──────────────────────────┴────────────────────┘
```

该图表达区域关系，不创建固定三栏布局器。分屏、放大、移动和焦点由已有 Pane 宿主决定。专业 Pane 能从目录、命令、画布节点或 owner 资源引用独立打开；重复打开相同绑定时 focus 原 Pane。新成果默认显示通知和定位动作，不抢焦点。

画布节点提供最常用输入、参数、状态、选定结果与运行/打开专业 Pane 动作。复杂编辑器只在专业 Pane 展开；节点与 Pane 使用相同 owner/ref/version 和同一个查询订阅，不能各存一份业务对象。

## 3. 画布与工作流语法

节点分为素材、文字草稿、操作步骤、成果、分组框。素材支持图片、视频、声音、文件与领域对象引用。媒体按需加载，离屏暂停视频，节点显示有界缩略预览。渲染固定 `@xyflow/react@12.11.6`，依赖已通过pnpm安装并写入锁文件；媒体和完整交互仍须逐项验收。

参考关系只描述灵感、来源、归属和证据，不参与执行。执行连接明确输出版本与输入用途；连接时选择参考图/提示词/声音/镜头资产等用途，不兼容时保留草案并显示原因，禁止隐式转换。缺少选定候选时作为缺失输入，不自动采用最新生成结果。

流程入口同时支持模板、手动连线和 Agent 草案。执行范围为单节点、选中分支或完整流程；分支指从选定节点沿执行边可达的下游，不包含参考边。运行预览明确列出将执行的节点和范围外输入：范围外输入必须已有可用的固定版本，否则列为阻塞，不能静默扩大执行范围。执行图有向无环；迭代通过新运行或复制分支表达，不支持无限循环。

确认预览后冻结输入、参数、选定版本与计划摘要。预算未知显示 unknown，不作为零；需用户理解未知费用并显式确认，owner 仍可因预算合同不满足而拒绝。运行中继续编辑只影响下一份草案，不改变原运行。人工审阅点暂停，范围扩大或成本授权变化重新确认。

上游修改标记受影响节点并保留已采用结果。重跑只产生新候选；用户比较和采用后才推进当前结果指向。unknown 只对账原操作；confirmed failed 是否可重试由 owner 决定。关闭 Pane 不取消运行，刷新或恢复布局不重放命令。

## 4. Agent 与版本规则

Agent 可在用户指定范围内整理节点、添加建议步骤、修改流程参数与插件草稿，必须给变更摘要并支持撤销；不得修改运行快照和已采用成果。Auctra 正文和其他 owner 持有的内容不是插件草稿，Agent 修改须走 owner candidate。

候选采纳、源文件写回、Checkpoint、Review/Canon 和最终交付是独立动作。浏览器 pending 或 HTTP 成功不代表 owner 已保存；只有相应 owner 回执确认后才改变保存与采用状态。版本冲突保留编辑输入与候选，提供重新读取、比较和另存草案，不能覆盖新版本。

## 5. 实施结构和防重复规则

- 共用 [引用与成果工作区](../../openspec/changes/dsh-prompt-reference-creative-workspace-v1/tasks.md) 的内容编辑、媒体选择、候选比较、采用、写回和 Composer prepare/ack。该 change 正在实施，其新增 candidate/action 类型属于源码事实，不代表五个真实 provider 已接通。
- 画布 change 只拥有项目布局、节点交互、选区和呈现存储；工作流 change 只拥有执行连接编辑、计划预览与执行 owner 的消费界面。二者不能各建一套 graph document。
- 每个专业 change 只拥有自己的 adapter、内容区、映射与验证。共享组件只有在至少两个实际消费者语义一致时抽取，不为五个页面预建万能表单系统。
- 合同缺口必须先核实，区分“接口存在”“消费适配未完成”“能力本身缺失”“真实环境未验证”。已存在接口不得重复造；确实缺失时在领域 owner 创建最小配套 OpenSpec/tasks，并在本 change 记录双向链接与受影响任务。
- 执行依赖、取消、重试、审批与预算事实都来自 owner；DSH 只显示和调用。无任意 shell/URL、私有数据库或静默 mock fallback。

## 6. 成熟度与验收

每个能力分别记录 specification、protocol-verified、fixture-ui-verified、real-owner-verified；这些是交付说明，不新增平台状态机。仅勾选已有对应证据的最小任务；已通过的内核、存储或fixture浏览器测试不能据此宣称完整产品已可用。

协议完成以本仓 bundle/host/client 合同为界，不依赖官方上游合入。用户可用性另要求真实 DSH staging/profile 和真实 owner；fixture、skip、零匹配不能关闭该任务。可用能力逐 Pane 晋级，综合流程单独验收。

基准为个人桌面、跨会话共享项目；不含实时多人协作、完整多轨剪辑、独立 SaaS。测试 300 个混合节点、持续一小时，记录固定机器/视口/媒体样本、输入延迟、拖拽帧、节点/订阅/内存趋势与保存回执；缓存切换 p95≤200ms，输入 p95≤100ms，零已确认丢失、零重复操作。十次续接至少八次在内容显示后三十秒内找到正确成果和下一步；网络等待单列但失败样本不删除。

统一质量与证据入口见 [接口、owner 与测试合同](../interfaces/dsh-creative-studio-contracts.md)。未验证的小云雀/LibTV 登录后交互由可丢弃原型走查补证，不照搬其私有页面或代码。

参考：[小云雀公开页](https://xiaoyunque.jianying.com/)、[LibTV 公开页](https://www.liblib.tv/)、[LibTV CLI](https://www.liblib.tv/zh/cli)。以上仅作为产品组织参考，不构成 DSH 技术实现或市场效果证据。

## ComfyUI 风格工作台与工作面切换

做剧工作台采用 ComfyUI 参考图的空间组织：顶部项目下拉与工作区入口，左侧资产/Productions，中部节点画布，右侧 Inspector/Versions/Comments，底部只读运行观察。顶部常驻 `[ ✦ Agent ] ⇄ [ ▦ 工作台 ]` 胶囊切换同级工作面；切换不改变项目、选区、运行或权限。参考图只冻结信息层级、空间关系和密度，真实组件、状态文本、无障碍与运行证据仍以 DSH 视觉系统和 OpenSpec 合同为准。
