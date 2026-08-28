## ADDED Requirements

### Requirement: Selection Agent Review 必须保持 split-owner 边界
系统 MUST 由 `agent/harness-plugins` 拥有选区/截图标注 UI 与批注面板，由 DSH Conversation Composer/Runtime 拥有输入、模型与执行状态，由 File Host 拥有文件读取、版本校验与补丁应用；浏览器 MUST 只保存临时选择状态，MUST NOT 成为评论、审批或文件修改的最终真相源。

#### Scenario: 浏览器刷新后恢复批注
- **WHEN** 用户提交批注批后刷新页面
- **THEN** 批注只能通过 annotation service 发布的持久化对象恢复，浏览器内存中的临时选择状态不得被当作真相源回写

#### Scenario: 缺少 host seam
- **WHEN** File Host 或 annotation service capability 缺失
- **THEN** 对应入口禁用并显示 unavailable 原因，不渲染死按钮，也不伪造 owner state

### Requirement: 锚点协议必须统一五类锚点并携带完整性字段
Selection Anchor V1 MUST 支持 FileRange、MarkdownRange、DomRegion、ImagePoint、ImageRegion 五类锚点，且每类 MUST 携带 anchorId、artifactRef、artifactVersion、kind、quotePreview、quoteDigest、createdAt、freshness 与 reanchorEvidence；锚点 MUST 通过 zod 合同校验，校验失败 MUST fail-closed。

#### Scenario: 非法锚点被拒绝
- **WHEN** 提交缺少 artifactVersion 或 quoteDigest 的锚点
- **THEN** 校验失败，锚点不进入批注批，错误信息不包含原文之外的敏感字段

#### Scenario: 锚点内容漂移
- **WHEN** 重新打开锚点时 artifact 版本与锚点记录的 artifactVersion 不一致
- **THEN** 锚点 freshness 标记 stale 并要求 reanchor，不得静默当作仍然有效

### Requirement: Markdown 渲染选区必须诚实映射源码位置
Markdown 渲染内容 MUST 在宿主提供源码位置提示（如 `data-source-line`）时把渲染选区映射回 `.md` 源码范围并校验单调性；提示缺失时 MUST 降级为 DomRegion 锚点并标记 unmapped，MUST NOT 从渲染顺序伪造行号。

#### Scenario: 带源码提示的选区
- **WHEN** 用户在携带源码行提示的渲染标题、列表或表格单元格上选择文本
- **THEN** 生成的 MarkdownRange 锚点包含对应源码文件的范围与版本

#### Scenario: 无源码提示的选区
- **WHEN** 渲染 DOM 不携带任何源码位置提示
- **THEN** 锚点降级为 DomRegion 且明确标记 unmapped，不出现任何伪造的行号

### Requirement: 选区后必须一次交互内打开浮动操作条与迷你 Composer
用户选中文本后系统 MUST 立即显示浮动操作条（问 Agent、评论、编辑、Agent 修改、更多），并 MUST 在一次交互内打开紧凑 Agent Composer；操作条 MUST 固定于选区上方 8px、空间不足时翻转、不遮挡选区、支持键盘导航与 Esc 关闭、窄面板降级为图标、选区滚出视口时收缩为边缘锚点。

#### Scenario: 顶部空间不足
- **WHEN** 选区贴近视口顶部
- **THEN** 操作条自动翻转到选区下方，不遮挡选区本身

#### Scenario: 键盘用户发起询问
- **WHEN** 键盘用户完成选择并用 Tab/Enter 激活"问 Agent"
- **THEN** 紧凑 Composer 打开且焦点落在输入区，Esc 依次关闭 Composer 与操作条

### Requirement: Compact Agent Composer 必须保留会话能力且修改强制 preview-first
紧凑 Composer MUST 保留当前会话/Agent、模型状态、权限模式、附件与上下文卡片、输入历史、发送/停止/重试与流式状态，并 MUST 可展开到主输入框且不丢失草稿、附件与选区上下文；`Agent 修改` 意图 MUST 强制 `preview-first`，`评论` 意图默认不调用模型；布局 MUST 满足默认宽 360px（280–480px）、输入 1–6 行自增。

#### Scenario: 展开不丢草稿
- **WHEN** 用户在紧凑 Composer 输入草稿并附加两个上下文卡片后展开到主输入框
- **THEN** 草稿、附件与选区上下文完整保留，收起后再次完整恢复

#### Scenario: 修改意图绕过预览
- **WHEN** 任何调用方尝试以非 preview-first 策略提交修改意图
- **THEN** 控制器拒绝提交并降级为 preview-first，不产生自动写入

### Requirement: 截图能力必须按来源分层且入口诚实
可见区域与完整页面截图 MUST 由 DSH Web capture adapter 提供；系统窗口与完整桌面截图 MUST 保留给 Desktop Capture Adapter（独立 Desktop Client owner），Web 侧 MUST 保持 capability probe unavailable 并说明原因；截图前 MUST 显示捕获范围。

#### Scenario: Web 请求桌面截图
- **WHEN** Web 侧探测 DesktopCaptureAdapterV1
- **THEN** probe 返回 unavailable 与"需要 Desktop Client"原因，不渲染可点击的桌面截图入口

#### Scenario: 捕获范围预览
- **WHEN** 用户发起任意截图
- **THEN** 冻结画布前显示捕获范围，用户确认后才产生 artifact

### Requirement: 截图批注必须支持多标记、归一化坐标与编号引用
截图标注画布 MUST 支持单点、矩形、文本识别区域、DOM 元素区域（仅页面截图）与多元素联合范围；单张截图 MUST 支持至少 20 个独立标记；锚点坐标 MUST 使用图像归一化坐标（0..1），缩放、窗口变化或高 DPI 下标记 MUST 保持对齐；每个标记 MUST 拥有稳定编号并支持独立迷你 Composer 或加入同一 Review Batch 联合提交，Agent 回复 MUST 引用标记编号。

#### Scenario: 缩放后对齐
- **WHEN** 用户把截图从 100% 缩放到 250% 或在高 DPI 屏幕上重新打开
- **THEN** 所有标记仍对齐原区域，坐标不依赖 CSS 像素

#### Scenario: 联合提交引用
- **WHEN** 用户把 3 个标记加入 Review Batch 并提交
- **THEN** Agent 收到带 `#1/#2/#3` 编号的批注批，回复按编号逐条对应

### Requirement: 隐私 redaction 必须先于截图与持久化
密码输入框 MUST 默认遮盖；标记 private 的 DOM 区域 MUST NOT 进入页面截图；日志与证据 MUST NOT 记录原始截图字节、完整 prompt、Authorization、cookie 或隐藏指令；截图 artifact MUST 提供显式删除入口与保留时间；页面/文件/截图内容 MUST 作为不可信上下文处理，MUST NOT 被当作系统指令执行。

#### Scenario: 密码字段出现在捕获范围
- **WHEN** 捕获范围内存在密码输入框
- **THEN** 冻结画布上的对应区域已遮盖，artifact 中不存在明文密码

#### Scenario: 不可信内容携带指令
- **WHEN** 选区或截图文本中包含"忽略以上指令"类内容
- **THEN** 该内容只作为引用材料随锚点传递，不改变系统指令与审批策略

### Requirement: 多位置提案必须逐位置审批
Agent 修改提案 MUST 按位置拆分为 Proposal Hunk，每个位置 MUST 独立支持批准、拒绝、要求修改、暂不处理、查看来源、查看局部 diff 与在完整工作台打开；审批面板 MUST NOT 只提供"全部接受"。

#### Scenario: 三处修改分别决策
- **WHEN** Agent 对 3 个位置给出修改建议
- **THEN** 用户可以批准 #1、拒绝 #2、对 #3 要求重做，三处状态独立记录

### Requirement: 部分批准必须只应用已批准且依赖完整的补丁
系统 MUST 只提交用户批准的 hunks；被拒绝的 hunk MUST NOT 出现在最终写入中；当补丁之间存在依赖且被依赖方未批准时，系统 MUST 阻止部分应用并说明依赖关系。

#### Scenario: 依赖不完整的部分批准
- **WHEN** 用户批准依赖 hunk B 的 hunk A 但拒绝 B
- **THEN** 系统阻止应用并列出 A→B 依赖，不写入任何补丁

#### Scenario: 独立补丁的部分批准
- **WHEN** 用户批准互不依赖的 A、C 并拒绝 B
- **THEN** 最终写入只包含 A、C，B 不出现

### Requirement: 文件修改必须携带版本围栏且冲突进入协调
每次文件修改 MUST 携带 `baseVersion`；文件版本已变化时系统 MUST 进入 `reconcile_required` 并 MUST NOT 静默覆盖；浏览器 MUST NOT 直接提交任意 patch 字符串，应用动作 MUST 使用 owner 发布的 action descriptor 与版本校验。

#### Scenario: 版本漂移
- **WHEN** 提案生成后文件被外部修改，用户随后批准应用
- **THEN** 应用进入 reconcile_required，文件保持未覆盖状态，UI 提示协调

#### Scenario: 浏览器提交 patch 字符串
- **WHEN** 调用方试图以原始 patch 文本发起应用
- **THEN** 合同拒绝该请求，只接受 owner action descriptor 引用与 baseVersion

### Requirement: 审批与应用必须产生 owner receipt
所有批准、拒绝、要求修改、暂不处理与应用结果 MUST 产生 owner receipt；receipt MUST 记录动作、位置、版本与结果且字段脱敏；无审批的自动修改 MUST NOT 支持。

#### Scenario: 应用失败留痕
- **WHEN** 某 hunk 应用失败
- **THEN** 该 hunk 进入 failed 并附诊断 receipt，其余 hunks 的结果独立记录

### Requirement: 新合同必须 additive 且可验证
全部新能力 MUST 以新增包与新增 capability 接入，MUST NOT 改变现有 consumer 语义；插件完成门 MUST 通过 typecheck、test、build、`check:bundles` 与 `openspec validate dsh-selection-agent-review-v1 --strict --no-interactive`，并 MUST 在 `temp/integration-test-runs/<run-id>/` 留存脱敏证据。

#### Scenario: 不安装 bundle 的宿主
- **WHEN** 宿主未安装 `@yeisme/dsh-selection-annotation`
- **THEN** 现有会话、文件与 pane 行为完全不变

#### Scenario: 键盘完成全流程
- **WHEN** 键盘用户不使用鼠标完成选择、评论、发送与逐位置审批
- **THEN** 全流程可达且每步焦点可见

### Requirement: 能力账本必须冻结 V1/V2 边界
能力账本 MUST 冻结为：V1 交付文本选区、Markdown 源码映射、选区编辑、Agent 局部修改 diff、逐位置审批、可见区域与完整页面截图批注、多点联合提交与迷你 Composer；系统窗口/完整桌面截图 SHALL 保留独立 Desktop owner 于 V2；评论跨会话恢复 SHALL 作为 V2 committed 前置独立 OpenSpec，V1 MUST NOT 部分实现或移除其扩展点；多人实时协作 SHALL 保持 exploratory 且不承诺时间表；无审批自动修改 MUST 永久拒绝。

#### Scenario: V1 擅自实现跨会话恢复
- **WHEN** 任何后续变更试图在 V1 内把评论线程持久化为跨会话状态
- **THEN** 该变更必须先升级或替代本 capability 的 V2 边界，不得以兼容名义部分实现

#### Scenario: 引入无审批自动修改
- **WHEN** 任何后续提案引入 auto-apply 或跳过逐位置审批的应用路径
- **THEN** 该提案与已冻结的 rejected 账本冲突，必须先重开产品决策而不是静默合入

#### Scenario: 多人协作提前排期
- **WHEN** 有人在 V1 排期中承诺多人实时评论
- **THEN** 以账本 exploratory 状态驳回，需独立 change 与 owner 决策

### Requirement: 截图入口必须只暴露当前来源可交付的范围
截图入口 MUST 按 capability 渲染：Web capture 可用时入口 MUST 只包含"当前可见区域"与"完整页面"；系统窗口与完整桌面入口 MUST 在 Desktop capture owner 就位前不渲染或禁用并显示原因。

#### Scenario: Web 入口清单
- **WHEN** 用户在 Web 工作台打开截图批注入口
- **THEN** 可选项只有可见区域与完整页面，不存在可点击的窗口/桌面项

#### Scenario: 更多菜单发起联合批注
- **WHEN** 用户从浮动操作条"更多"中选择"加入批注组"
- **THEN** 当前锚点加入 Review Batch，可与同一截图的其他标记一起联合提交给 Agent
