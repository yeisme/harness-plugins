# dsh-selection-conversation-actions Specification

## Purpose
TBD - created by archiving change dsh-selection-conversation-actions-v1. Update Purpose after archive.
## Requirements
### Requirement: Conversation-first selection actions
选区操作 SHALL 以“添加到对话”和“引用并询问”为主要使用路径，提供来源详情，将批注、复制和批量收集保留为可发现的次级动作。

#### Scenario: Add a selection to an existing draft
- **WHEN** 用户选择添加到明确会话且宿主接受引用
- **THEN** 引用加入该会话草稿，已有文字与书签保留，反馈显示目标名，来源焦点保持，且不创建批注、不发送消息

#### Scenario: Ask with a selection
- **WHEN** 用户选择引用并询问
- **THEN** 同一选区被加入明确目标的草稿并聚焦官方输入框，用户可以继续输入问题，系统不覆盖原草稿或自动提交

### Requirement: Explicit conversation targeting
系统 SHALL 使用宿主明确的 workspace/session 引用捕获插入目标，在多 Pane 与跨项目场景显示目标；工具条 DOM 焦点或异步解析 SHALL NOT 静默改变该目标。

#### Scenario: Focus changes during resolution
- **WHEN** 在 A 捕获目标后焦点移至 B，引用解析才完成
- **THEN** 操作仍校验并指向已展示的 A，或要求重新选择，不隐式写入 B

#### Scenario: Target unavailable or ambiguous
- **WHEN** 目标关闭、不可访问、不明确或草稿 revision 不再满足 owner 条件
- **THEN** 保留选区与已有草稿，解释原因并提供目标选择，不伪造已添加反馈

#### Scenario: Choose or create a target
- **WHEN** 用户显式选择另一会话或新建对话
- **THEN** 系统显示新目标并重新捕获其输入书签；取消不创建对话，创建失败保留选区，成功最多创建一个目标且插入一次

### Requirement: Explainable references and source actions
引用 SHALL 复用官方草稿节点，显示来源与有界摘要，并提供独立的详情、有效定位和移除操作；来源授权与版本由原 owner 校验。

#### Scenario: Inspect and remove a draft reference
- **WHEN** 用户展开详情、定位或移除引用
- **THEN** 展开与定位不写草稿，移除只删除当前草稿中的对应引用，保留原文和其它输入并遵循宿主 undo/redo

#### Scenario: Source resolver missing
- **WHEN** 选中文字没有结构化来源 resolver
- **THEN** 不伪造 owner/ref/version；说明无法定位来源，允许显式复制或以未关联来源的文字引用加入，不将结构化失败静默转为普通文本发送

#### Scenario: Internal diagnostic content
- **WHEN** 来源能力返回类似 no inspect resolver 的内部错误
- **THEN** 主流程显示可理解的限制和真实可用的恢复动作，技术细节仅在显式详情中呈现，且不把错误消息替代用户的有效选区

### Requirement: Pin the visible toolbar position
最右侧控件 SHALL 支持单击固定位置和再次单击取消固定，并使用语义图标、说明与 aria-pressed。位置固定 SHALL 保持工具条可见且可操作，不改变旧 pin 事件的选区收藏／恢复语义。

#### Scenario: Pin and scroll
- **WHEN** 用户单击手柄后滚动页面
- **THEN** 固定状态可见，工具条保持可见位置及内容动作，不因进入固定阶段直接隐藏

#### Scenario: Pinned source becomes invalid
- **WHEN** 固定工具条引用的来源已失效
- **THEN** 显示失效原因并禁用受影响的内容动作，允许关闭或重新选择，不因固定而继续执行旧上下文

### Requirement: Distinguish clicking from dragging
手柄 SHALL 使用指针阈值、捕获和实际坐标完成移动；主指针位移超过 6 CSS px 才视为拖动，阈值内释放视为单击。完成拖动 SHALL 保留落点并固定位置，且抑制尾随 click。

#### Scenario: Drag and release
- **WHEN** 用户按住手柄拖到新的有效位置并释放
- **THEN** 工具条实际几何改变并保留落点，固定状态为真，内容按钮不被触发，释放不产生第二次固定切换

#### Scenario: Select ordinary text
- **WHEN** 用户在正文选择文字、点击内容动作或在手柄外进行触控滚动
- **THEN** 这些操作不启动工具条移动

### Requirement: Cancel gestures and constrain geometry
Escape、blur、pointercancel、丢失捕获或来源失效 SHALL 取消进行中的拖动并恢复开始前的几何与固定状态；视口变化 SHALL 修正越界位置，不保存半成品状态或引用正文。

#### Scenario: Cancel an active drag
- **WHEN** 拖动中发生取消条件
- **THEN** 手势结束、捕获释放、位置与固定状态还原，后续 click 不触发内容或 pin 动作

#### Scenario: Narrow or zoomed viewport
- **WHEN** 视口缩小或启用 200% 缩放
- **THEN** 工具条与手柄仍处于可操作边界内，主操作不被裁切，触控关键目标至少 44×44px

### Requirement: Preserve drafts and require real acknowledgement
添加和询问 SHALL 保留宿主已有文字、引用及 IME／撤销状态；生成中仅加入下一条草稿；重复处理中操作不产生重复节点；失败或 unknown SHALL 保留内容并禁止自动重发。

#### Scenario: Add while generating or while insertion is pending
- **WHEN** 会话正在生成或引用插入尚未确认
- **THEN** 原运行不被中断，目标为下一条草稿；处理中重复点击不重复插入，仅 owner 确认后展示成功

### Requirement: Host-native appearance and accessible controls
工具条、引用节点与详情 SHALL 使用宿主主题、字体、官方 primitives 和 scope 内统一 token；固定、询问、详情、目标选择和移除 SHALL 可由键盘与触控完成，包含明确焦点回归和减少动效支持。

#### Scenario: Real host theme and adjacent plugins
- **WHEN** 实际宿主在亮／暗／系统主题间切换，并同时显示其它插件
- **THEN** 浮层的 computed style 与宿主层级一致，不出现无解释的亮灰遮罩、字体重置或相邻插件污染

#### Scenario: Keyboard operation
- **WHEN** 用户仅使用键盘操作工具条
- **THEN** 可固定、移动、添加、询问、查看详情与取消；添加保留来源焦点，询问聚焦目标输入框，详情关闭返回触发项

### Requirement: Probe-gated additive reference protocol
引用插入的激活聚焦与显式目标选择 SHALL 通过 additive 可选协议字段暴露并由插件探测；能力缺失时对应入口 SHALL 禁用并显示原因，不伪造成功反馈或静默退化为其它语义。

#### Scenario: Activation capability absent
- **WHEN** 宿主引用桥不支持插入后激活并聚焦输入框
- **THEN** 引用并询问入口显示不可用原因，添加到对话保持可用，且不产生只插入未告知的部分动作假象

#### Scenario: Target selection capability absent
- **WHEN** 宿主不提供目标选择或新建对话能力
- **THEN** 选择对话／新建对话入口禁用并说明原因，当前目标、选区与已有草稿保持不变

### Requirement: Evidence distinguishes planning from acceptance
本 change SHALL 保持等待实施状态，直到用户明确恢复实施。后续验收 SHALL 使用真实指针输入、宿主草稿目标断言和脱敏证据；本次文档校验 SHALL NOT 计为功能或视觉验收通过。

#### Scenario: Current documentation delivery
- **WHEN** 此次规格和文档更新完成
- **THEN** 实施与验收任务仍未勾选，不启动实现、构建、profile 变更或真实模型调用

#### Scenario: Future browser acceptance
- **WHEN** 后续执行固定、拖动和引用验收
- **THEN** 检查实际几何、pin 状态、引用节点、workspace/session 目标、草稿与回执，并在本项目 temp/integration-test-runs 中保存脱敏结果、日志和截图，不仅检查动画或按钮存在

