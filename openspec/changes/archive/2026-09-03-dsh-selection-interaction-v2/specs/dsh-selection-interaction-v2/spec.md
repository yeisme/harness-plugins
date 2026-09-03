# dsh-selection-interaction-v2 Capability

全局单例 selection interaction layer：统一上下文、动作注册、显示密度、偏好、
触控/键盘路径、扩展 owner dispatch 和迁移生命周期。

## ADDED Requirements

### Requirement: 所有选区动作必须来自统一 typed registry
系统 SHALL 通过 `SelectionActionRegistryV2` 注册和解析动作。descriptor MUST 使用
namespaced id、bounded label、context 列表、capability requirements、priority、
danger、owner、presentation 和可选 shortcut；descriptor MUST NOT 包含 DOM/React
callback、HTML、URL、patch、provider payload 或 credential。Pane 不得创建私有
selection toolbar。

#### Scenario: 扩展注册动作
- **WHEN** 插件注册 `acme:review` 并声明适用 `text`、需要 `annotation.comment`
- **THEN** registry SHALL 校验、排序并在 capability 可用时投影该动作
- **AND** handler SHALL 只通过 typed intent 交给声明的 owner

#### Scenario: 非法 descriptor
- **WHEN** descriptor 含未知 context、未命名空间 id、远端 URL 或 callback 字段
- **THEN** registry MUST fail-closed 拒绝该 descriptor
- **AND** 其他已注册动作与交互层 MUST 继续工作

### Requirement: 动作显示必须 context-aware、确定性且不过度暴露
系统 SHALL 先过滤不适用动作；适用但缺 capability 的动作 MUST 只在 More 中 disabled
并显示可读 reason；可用动作 SHALL 按 priority、安装顺序、id 进行确定性排序，并
投影为 1 个 primary、最多 2 个 secondary 与 More。用户自定义顺序不得突破 context、
capability、danger 和 owner 边界。

#### Scenario: 文本选区
- **WHEN** 当前 context 为 `text` 且 ask/comment/copy/edit 均可用
- **THEN** primary SHALL 为“问 Agent”，secondary SHALL 为评论和复制引用
- **AND** 编辑 SHALL 进入 More 而不是占据主操作位

#### Scenario: 能力缺失
- **WHEN** 图片 context 支持 comment 但不支持 edit
- **THEN** comment SHALL 可用，edit SHALL 在 More 中 disabled 并显示原因
- **AND** 不得渲染可点击但无 owner handler 的 edit 按钮

### Requirement: 交互层必须是短生命周期 singleton 并可完全释放
页面最多 SHALL 存在一个 active interaction layer。它 MUST 在 stable selection 后
挂载，在 reselect/scroll/Esc/outside/invalid context 后关闭；Pin 是唯一持久化入口。
HMR、profile dispose、pane close 和重复 mount MUST 释放 listener、observer、portal、
controller、timer 和 scoped styles，不得留下重复浮层或陈旧动作。

#### Scenario: 两个 Pane 同时提供选区
- **WHEN** Workbench 和 Conversation 同时报告 selection context
- **THEN** 页面 SHALL 只显示一个由最新有效 context 驱动的 Actions
- **AND** 旧 context 的动作不得继续 dispatch

#### Scenario: HMR 重载
- **WHEN** selection bundle dispose 后再次 attach
- **THEN** DOM、listener、style 和 timer SHALL 各只有一套
- **AND** 旧 controller 不得响应新选择

### Requirement: 用户偏好必须按层级合并且只保存安全 UI 数据
系统 SHALL 支持 built-in、user、workspace 三层 preference，优先级为
workspace > user > built-in。每个 context 可独立配置 visibility、order、shortcut、
density 和 preset；只保存 canonical action id 与 bounded UI 值，不保存 anchor 内容、
路径、URL、会话状态或 owner payload。无效偏好 MUST 回退到内置默认并给出诊断。

#### Scenario: Workspace 覆盖 user
- **WHEN** user 隐藏 `copy-quote`，workspace 对 `text` preset 显示该动作
- **THEN** text context SHALL 显示 workspace 规则
- **AND** image/table context SHALL 继续使用各自合并结果

#### Scenario: 冲突快捷键
- **WHEN** 自定义快捷键与宿主编辑器快捷键冲突
- **THEN** Actions shortcut MUST 不注册或进入 disabled reason
- **AND** 原生编辑器快捷键 MUST 保持优先

### Requirement: 触控、键盘和 reduced-motion 必须共享语义
桌面端 SHALL 使用 1+2+More；窄屏或 coarse pointer SHALL 使用单一 Actions 入口和
Bottom Sheet。默认 `Alt+Enter` SHALL 聚焦 Actions，且快捷键可由 Workspace Designer
配置。所有表面 MUST 提供可见 focus、ARIA 状态、Esc 逐层退出和 reduced-motion 退化。

#### Scenario: 触控窄屏
- **WHEN** viewport 为 360px 且 pointer 为 coarse
- **THEN** 页面 SHALL 显示单一 Actions 入口
- **AND** 点击后 Bottom Sheet 的每个 action hit target 至少 44px

#### Scenario: 键盘退出
- **WHEN** 用户从原编辑器焦点用 Alt+Enter 打开 Actions，再打开 More
- **THEN** Esc SHALL 先关闭 More、再关闭 Actions
- **AND** 焦点 SHALL 返回原编辑器节点

### Requirement: owner dispatch 必须保留安全与 receipt 不变量
动作激活 SHALL 发送 typed `SelectionActionIntentV2`（contextId、anchor ref、canonical
action id、owner、approval policy），不得发送任意 patch 或路径。copy 等本地动作可立即
完成；comment/edit/apply 必须按 owner capability、preview-first、baseVersion 和
receipt 合同执行。owner 缺失时动作 disabled，浏览器不得模拟成功。

#### Scenario: 编辑动作
- **WHEN** 用户在 source context 激活 edit
- **THEN** client SHALL 发送 preview-first typed intent
- **AND** 只有 owner 返回 preview/receipt 后才可进入审批或应用

#### Scenario: owner 不可用
- **WHEN** comment owner capability 缺失
- **THEN** comment SHALL 在 More 中显示 unavailable reason
- **AND** 不得产生本地伪造评论或 success receipt

### Requirement: 扩展卸载与 alias 必须可预测
扩展动作 MUST 绑定 registration/dispose scope；卸载后 registry、More、快捷键和
帮助投影 MUST 同步移除。既有 V1 action id（`ask`、`comment`、`edit`、`agent-edit`、
`copy-quote`、`add-to-batch`、`open-full`）MUST 作为 alias 解析到新的 namespaced
descriptor，receipt 与 Activity MUST 记录 canonical id。

#### Scenario: 热卸载扩展
- **WHEN** 提供 `acme:review` 的 bundle 被卸载
- **THEN** 该动作、快捷键和 disabled reason SHALL 从当前 context 消失
- **AND** 不得影响 built-in actions

#### Scenario: 使用旧 action id
- **WHEN** 旧宿主请求 `agent-edit`
- **THEN** registry SHALL 解析到 canonical edit descriptor
- **AND** intent/receipt SHALL 标记 alias 来源但使用 canonical id 执行
