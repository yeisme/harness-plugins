## ADDED Requirements

### Requirement: 窗格中心条目 SHALL 按固定解析链携带详细描述
`buildPaneManagementEntries` SHALL 为每条管理条目解析 additive `description` 字段，解析链固定为：本地 registration `i18n.descriptionKey` 的 locale 解析结果 → `descriptor.presentation.description`。pane/tab/history 条目共享同一注册的描述。缺省时字段 SHALL 缺席，MUST NOT 以 raw key、空串或占位符填充。locale 热切换 SHALL 使描述随条目重算刷新。

#### Scenario: descriptor 声明 presentation.description
- **WHEN** 一个 pane registration 的 descriptor 声明 `presentation.description` 且未声明 i18n descriptionKey
- **THEN** 该窗格条目与对应已打开 tab 条目的 `description` 均为该值
- **AND** 搜索结果行内渲染一行省略描述并带全文 title 提示

#### Scenario: registration 声明本地 descriptionKey
- **WHEN** registration 声明 `i18n.descriptionKey` 且当前 locale 词典含该 key
- **THEN** 描述使用词典值，优先于 `presentation.description`
- **AND** 词典缺 key 时回落 `presentation.description` 而非显示 raw key

#### Scenario: 注册完全无描述来源
- **WHEN** 某窗格的 registration 既无 descriptionKey 也无 `presentation.description`
- **THEN** 其 pane/tab/history 条目 `description` 缺席，行内不渲染描述行，详情条显示诚实空态

#### Scenario: 语言热切换刷新描述
- **WHEN** 依赖 descriptionKey 的窗格条目已渲染，宿主切换 active locale
- **THEN** 行内与详情条描述在下一次渲染使用新 locale 词典值，无需重开窗格中心

### Requirement: 对话与远端工作区结果 SHALL 以宿主摘要作为行描述
conversation 结果行的 `description` SHALL 为 host 返回的命中片段，并携带 `updatedAt` 供详情条展示更新时间；workspace 搜索结果行 SHALL 显示 host `description`。两者与注册描述共用同一省略规则与展示上限，MUST NOT 为获取描述触发额外 host 请求。

#### Scenario: 对话命中展示片段
- **WHEN** 用户开启对话内容搜索并获得命中
- **THEN** 该结果行以 host 片段作为描述行，详情条显示同一片段与更新时间

#### Scenario: 远端工作区条目无描述
- **WHEN** workspace 搜索结果条目未携带 `description`
- **THEN** 该行不渲染描述行，其余字段与交互不受影响

### Requirement: 描述文本 SHALL 参与窗格中心搜索匹配
`filterAndRankPaneEntries` SHALL 把 `description` 纳入大小写不敏感的子串匹配面，与 title/kind/owner/keywords 同权参与「是否命中」；既有排序 score 构成 SHALL 保持不变。

#### Scenario: 仅描述命中关键词
- **WHEN** 用户输入只出现在某窗格描述文本中而未出现在其标题、类型或关键词里
- **THEN** 该窗格条目出现在搜索结果中

### Requirement: 每条结果 SHALL 可展开窗格详情条
窗格中心 SHALL 为每条结果提供 info 按钮与行主按钮上的 ArrowRight 展开、ArrowLeft 收起详情条。info 按钮 SHALL 暴露实时 `aria-expanded`，详情条 SHALL 为带可访问名称的 region。详情条 SHALL 在列表容器之外渲染为单一面板，展示完整描述与有界元数据（来源、提供方、类型、角色、区域、状态、关键词、工作区标签、history 关闭时间、conversation 片段与更新时间），MUST NOT 影响既有 ArrowUp/Down/Home/End/Enter 键盘导航与 >50 行的虚拟滚动行为。描述缺失时详情条 SHALL 显示诚实空态。query 变化或面板收起后详情条 SHALL 清除，不再显示陈旧条目。Escape SHALL 先收起详情条再进入既有 target/关闭链；通过 Hide 按钮或 Escape 收起后，焦点 SHALL 回到触发行的 info 按钮，MUST NOT 留在已卸载元素或 body 上。

#### Scenario: 展开无描述的窗格
- **WHEN** 用户对一个无任何描述来源的窗格条目点击 info 按钮
- **THEN** 详情条显示该窗格的元数据行
- **AND** 描述区域显示「暂无详细描述」类诚实空态而非空白占位

#### Scenario: 键盘展开与收起
- **WHEN** 焦点在某行主按钮上按 ArrowRight 再按 ArrowLeft
- **THEN** 详情条先展示该行条目详情再收起
- **AND** ArrowUp/ArrowDown 焦点移动行为与未展开时完全一致

#### Scenario: 搜索词变化清除详情
- **WHEN** 详情条展开时用户修改搜索词
- **THEN** 详情条被清除或切到新结果，MUST NOT 继续展示已不在结果中的条目

#### Scenario: Escape 先收起详情条
- **WHEN** 详情条展开时用户按 Escape
- **THEN** 详情条收起且窗格中心保持打开
- **AND** 再次 Escape 才进入既有打开位置/关闭链

#### Scenario: 收起后焦点回归触发行
- **WHEN** 用户通过 Hide 按钮或 Escape 收起详情条
- **THEN** 焦点移回触发行的 info 按钮并保持可继续键盘操作

#### Scenario: 关闭历史详情显示关闭时间
- **WHEN** 用户展开一条关闭历史结果
- **THEN** 详情条显示其所在批次的关闭时间

### Requirement: 描述来源 SHALL 保持安全边界
条目描述 SHALL 只来自本地已注册 registration/descriptor 与 host projection 提供的有界摘要。远端 `PaneWorkspaceSearchItemV1.description` 超过 240 字符时 SHALL 截断；描述 MUST NOT 被解析为 URL 跳转、可执行内容或富文本。既有 restore-state 安全校验与 descriptor schema 校验 SHALL 保持不变。

#### Scenario: 远端条目携带超长描述
- **WHEN** 工作区搜索结果条目的 `description` 超过 240 字符
- **THEN** 行内与详情条展示截断后的文本，其余合同字段不受影响
