## ADDED Requirements

### Requirement: CAW-01 Conversation-adjacent artifact workspace
成果 SHALL 在宿主侧边 Pane 展示，支持放大；窄屏 SHALL 切换对话／成果视图并保留草稿、选择和阅读位置。内容 SHALL 复用现有 renderer、editor、Surface 与 artifact handoff，不新增客户端领域仓库。

#### Scenario: Switch views on a narrow container
- **WHEN** 用户在窄屏从编辑中的对话切到成果再返回
- **THEN** 对话正文、引用编辑状态、selection 和阅读位置可恢复，成果不会创建第二个 Composer

#### Scenario: Owner artifacts disappear and return
- **WHEN** 同一上下文的成果列表从空变为可用，或暂时消失后恢复
- **THEN** 成果组件不因状态切换崩溃，已有本地编辑可恢复；权限上下文变化仍按原规则隔离并清理缓存

#### Scenario: Navigate artifact views with the keyboard
- **WHEN** 用户在预览、源码和比较页签使用方向键、Home 或 End
- **THEN** 焦点与选中页签同步，仅选中页签进入 Tab 顺序，面板与页签具有可访问名称关联，RTL 方向正确且 IME 组合事件不切换页签，编辑内容保留

### Requirement: CAW-02 Complete engineering and media interactions
工作台 SHALL 覆盖 Markdown、代码、Mermaid、表格、HTML 的预览及直接编辑；图片 SHALL 支持缩放、框选、批注、基础裁剪，音视频 SHALL 支持播放、时间段标注和基础裁剪。生成修改 SHALL 通过现有 Agent／成果 owner 的显式动作，不因标注或预览自动执行。

#### Scenario: Edit a diagram or table
- **WHEN** 用户编辑 Mermaid 源码或表格数据
- **THEN** 预览呈现编辑结果，语法错误保留编辑并定位原因，不破坏已采纳成果

#### Scenario: Annotate or crop media
- **WHEN** 用户选择图片区域或音视频时间段并进行批注／基础裁剪
- **THEN** 范围在预览中可见；裁剪提交产生候选而不覆盖原资源，Agent 修改需显式提交

#### Scenario: Preview HTML structure without executing the document
- **WHEN** 用户预览或编辑 HTML 成果，正文包含脚本、样式、外部资源或表单
- **THEN** 静态视图仅呈现允许的标题、列表、表格等结构，不执行脚本、加载资源或连接表单；完整源码仍可编辑，超限或净化失败明确显示状态，可运行页面沿用独立环境预览接口

#### Scenario: Inspect an image and then select a region
- **WHEN** 用户从框选切换到图像查看，缩放／平移后再返回框选
- **THEN** 查看变换与归一化选区分开保存，框选恢复无变换坐标系，原选区和批注不丢失，查看模式拖动不会改写选区，发送仍使用明确选区

#### Scenario: Correct a malformed or bounded CSV preview
- **WHEN** 用户编辑的 CSV／TSV 包含未闭合引号或超出渲染预算的行、列、单元格
- **THEN** 预览显示首个格式错误位置或受限内容提示，不把部分表格冒充完整内容；完整源码保留，修正后重新呈现表格，预览内容不回写源数据

#### Scenario: Bound a Unicode table preview by bytes
- **WHEN** CSV／TSV 正文包含中文或 emoji，预览达到 maxBytes
- **THEN** 预算按 UTF-8 字节计量，截断保留完整码点并显示受限状态，源码不被修改；非法非正或非整预算被拒绝

#### Scenario: Retry a temporary content read failure
- **WHEN** 正文首次读取失败或暂不可用，用户显式点击重新读取
- **THEN** 重新通过当前 owner 读取同一版本，加载期间不重复发起读取，不自动重试或提交写操作，其他草稿不清空，成功后恢复当前预览

#### Scenario: Switch diagram theme during rendering
- **WHEN** Mermaid 仍在渲染时用户切换亮暗主题
- **THEN** 新主题不复用旧主题的在途请求或缓存，迟到的旧图不得覆盖当前视图，同一源码的当前主题图形保持可读

#### Scenario: Page through an exactly full final table page
- **WHEN** TSV 或 CSV 的总行数恰好是分页大小的整数倍，用户进入最后一页
- **THEN** 下一页禁用而上一页可用，不进入空白越界页；窄屏仍能翻页并显示中文单元格

### Requirement: CAW-03 Owner-backed drafts and candidate adoption
编辑草稿持久保存、候选版本、比较和采纳 SHALL 由成果 owner 提供，客户端只保留临时编辑值与安全投影。新候选 SHALL 不自动成为已采纳成果。缺少保存能力 SHALL 明确说明临时保存边界并保护离开时的未保存内容。

#### Scenario: Compare and adopt a candidate
- **WHEN** owner 返回新候选且用户打开比较
- **THEN** 文本显示 diff，图片显示并排或切换，音视频可切换对应片段；用户明确采纳并获得成功回执后才更新已采纳版本

#### Scenario: Save fails or owner capability is absent
- **WHEN** 自动保存失败或 owner 未提供草稿保存能力
- **THEN** 用户编辑不消失，界面不能显示已持久保存，离开时提示未保存内容，产品对应能力保持未验收

#### Scenario: Opt in to debounced owner draft saving
- **WHEN** 当前成果的 owner 提供低风险、无需额外确认、正文及版本参数完整的保存动作，用户开启自动保存并连续编辑
- **THEN** 编辑停顿后合并提交一次正文和 owner 内容版本；只在完成回执及更新版本的正文读回一致后清理相同草稿，期间新增编辑保留并使用新版本继续保存，候选创建／采纳／写回不被自动触发

#### Scenario: Pause automatic saving on uncertain settlement
- **WHEN** 自动保存失败、正文读回不一致或返回 unknown／partial，或者用户关闭自动保存／离开成果
- **THEN** 未确认状态暂停自动提交并保留输入，unknown／partial 沿原操作身份查询，不自动重发；关闭或离开取消尚未触发的计时器，在途提交仍按其原身份处理

### Requirement: CAW-04 Adoption and source writeback are separate actions
采纳 SHALL 只更新成果 owner 的已采纳版本；写回 SHALL 是独立显式动作，显示目标和差异并携带源版本条件。写回冲突 SHALL 重新比较，不覆盖未知的新内容。

#### Scenario: Adopt without writing a source file
- **WHEN** 用户采纳候选但未执行写回
- **THEN** 原工作区文件或素材保持不变

#### Scenario: Source changes before writeback
- **WHEN** 比较之后原文件版本发生变化，用户提交写回
- **THEN** owner 拒绝过期条件，界面保留候选并要求重新比较

### Requirement: CAW-05 Re-reference selected artifact snapshots
再次引用 SHALL 捕获所选成果版本和内容范围，通过现有 attach_context 合同将授权内容／媒体加入明确目标草稿。后续编辑引用 SHALL 不修改原成果，成果变化 SHALL 不改变已发送历史。

#### Scenario: Reference an older candidate selection
- **WHEN** 用户从仍有权限的旧候选选择片段再次引用
- **THEN** 插入所选版本的内容而非当前最新内容，来源说明保留版本，用户可独立改写草稿

### Requirement: CAW-06 Owner receipts and missing dependencies remain explicit
所有成果 mutation SHALL 消费当前 server-authored descriptor 与 receipt，沿用既有风险、权限和任务流程。unknown、partial、cancel_unknown 与 reconcile SHALL 保留原身份，不自动 fallback 到其他 handler 或创建重复动作。缺失 owner 能力 SHALL 登记外部依赖。

#### Scenario: Adoption returns unknown
- **WHEN** 采纳请求结果未知
- **THEN** 界面显示对账状态，不显示采纳成功，不自动重试或提交另一 owner

#### Scenario: Writeback descriptor is unavailable
- **WHEN** 成果 owner 没有提供可用写回 descriptor
- **THEN** 显示具体不可用原因并记录依赖，预览仍可用，不用客户端文件写入冒充支持
