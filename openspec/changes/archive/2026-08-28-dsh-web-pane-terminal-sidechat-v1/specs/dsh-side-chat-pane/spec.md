## ADDED Requirements

### Requirement: Side chat SHALL 只经官方 sessions face 读写且不触碰主选择
侧边对话的一切读写 MUST 经由 `ISessions` 公开面（`binding()/fork()`）与 `SessionFace`（`prompt()/cancel()`、ConversationSnapshot 订阅）完成；结构化探测到的 runtime `create()` 仅用于新建会话。Side chat 的任何路径 MUST NOT 调用 `sessions.open()/openSubagent()/clear()`，MUST NOT 改变主对话区 current selection。

#### Scenario: 附着既有 session 不切换主区
- **WHEN** 用户在 side chat picker 选择一个非 current 的 session 并发送消息
- **THEN** 消息经该 session 的 `SessionFace.prompt()` 提交并在 pane 内渲染回复
- **AND** 主对话区 current selection 保持不变

#### Scenario: runtime 不支持 create
- **WHEN** sessions 服务上没有可探测到的 `create` 方法
- **THEN** "新建会话"入口禁用并说明原因，fork 与附着既有 session 的路径不受影响

### Requirement: 会话来源 SHALL 覆盖附着/新建/fork 三径且各自诚实降级
视图 MUST 提供：(a) 从 `sessions.list` 快照选择既有 session 附着；(b) 新建空白 session（探测通过时）；(c) 以指定源 session `fork()` 子会话（`increaseTitle` 默认开启）。任一路径失败 MUST 以行内错误呈现 typed 原因，MUST NOT 静默重试或伪造会话。

#### Scenario: fork 当前会话
- **WHEN** 用户从 current session 发起 fork 并在 pane 内继续对话
- **THEN** 子会话经官方 `fork()` 创建、标记 fork origin，pane 绑定子会话且主选择不变

#### Scenario: 附着目标不可解析
- **WHEN** 所选 session 既不在列表也未 scope，`binding()` 返回空
- **THEN** pane 显示该 session 不可附着的行内提示，不回退到其他 session

### Requirement: 渲染 SHALL 为有界投影且 composer 语义与官方一致
渲染 MUST 基于 `ConversationSnapshot` 的有序节点投影：用户与助手文本、折叠的工具卡摘要（名称与有界参数摘要，不含原始全文）、错误/截断节点、queue 计数。composer MUST 以 `prompt([{type:'text'}], mode)` 提交；running 时默认 `steer` 且可切 `queue`；`cancel()` 仅在 running 态可用；`promptError` MUST 如实显示。视图 MUST NOT 发起 `readAttachment` 之外的任意网络请求。

#### Scenario: running 会话中的发送
- **WHEN** 附着 session 正在运行且用户发送新消息
- **THEN** 以 steer 模式提交，UI 呈现转向提示
- **AND** promptError 出现时展示 typed 错误且不清空用户草稿

#### Scenario: session 被移除
- **WHEN** 附着 session 从列表移除（removed）
- **THEN** 视图进入已移除态、输入禁用，不做任何恢复尝试

### Requirement: 装配与命令面 SHALL 探针优先
`@yeisme/dsh-side-chat` bundle MUST 以 `cordis.patch.yml` 单行 insert 登记（纯 client face）。`paneWorkbench` 缺席时 MUST 零注册且 launcher 禁用+原因；`/side-chat` slash 目录缺席时命令入口禁用+原因，pane 内操作不受影响。close pane MUST 只 detach 视图，不归档、不终止、不清除所附着 session 的任何状态。

#### Scenario: 无 pane workbench 的宿主
- **WHEN** 宿主未提供 `paneWorkbench` 服务
- **THEN** side chat 零注册、不渲染任何入口，卸载无副作用

#### Scenario: 关闭侧边对话 tab
- **WHEN** 用户关闭 side chat 视图
- **THEN** 仅取消本地订阅与 dispose controller，session 继续存在于列表且可再次附着

### Requirement: 视图 resource key SHALL 支持预选且多个侧边会话并存
`openView` 的 resource key MUST 形如 `side-chat:<sessionId>`（预选目标）或 `side-chat:picker`（空 picker 起步）；视图 descriptor MUST 为非 singleton（`singleton: false`），允许同时打开多个侧边会话 tab。预选 session 不可解析时视图 MUST 落到 `unresolvable` 行内提示，MUST NOT 静默改绑其他 session。

#### Scenario: 携带预选打开
- **WHEN** 以 resource key `side-chat:s-7` 打开视图且 s-7 可绑定
- **THEN** 视图直接附着 s-7 并渲染其对话，无需用户再选

#### Scenario: 多 tab 并行对话
- **WHEN** 用户为 s-2 与 s-3 各开一个侧边会话 tab 并分别发送
- **THEN** 两个 tab 各自绑定、互不串扰，主选择始终不变

### Requirement: 文案 SHALL 提供 zh/en 并支持 locale 回退
视图与 `/side-chat` 命令文案 MUST 经 `locale.register(ns, tables)` 注册 zh/en 双表；locale 服务缺席或键未命中时 MUST 回退 en 内建表；带参文案（queue 计数、工具名摘要）MUST 以命名插值呈现。

#### Scenario: 无 locale 服务的宿主
- **WHEN** client 激活时 `locale` 服务不可用
- **THEN** 视图文案使用 en 内建表，注册零副作用

#### Scenario: zh 环境的新建禁用原因
- **WHEN** locale 绑定命中 zh 表且 runtime 无 `create`
- **THEN** "新建会话"禁用态展示中文原因并指引 fork/附着路径
