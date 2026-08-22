## ADDED Requirements

### Requirement: Workbench Core SHALL 提供模块/标签/命令合同
`WorkbenchModuleDefinitionV1` SHALL 包含 id、version、title、requiredCapabilities、tabs 与 commands。`WorkbenchTabV1` SHALL 包含 id、moduleId、title、order、closable 与 scope。`WorkbenchCommandV1` SHALL 包含 id、moduleId、title 与可选 shortcutHint。所有描述符 MUST NOT 携带 raw path、凭据、任意 module URL 或脚本。

#### Scenario: 注册媒体模块
- **WHEN** `@yeisme/dsh-rich-media` 注册一个包含媒体库 Tab 与打开媒体命令的 Workbench module
- **THEN** Registry SHALL 接受并排序该模块
- **AND** Shell SHALL 只通过本地已注册视图渲染该 Tab

### Requirement: Registry SHALL effect-scoped 且可排序
`WorkbenchRegistry` SHALL 按 module id 去重，按 tab order 排序，并返回精确 disposer。重复 module id MUST 拒绝；dispose SHALL 移除该模块的 tabs/commands，不残留引用。跨模块重复 tab id 或 command id MUST 拒绝，不得静默覆盖。

#### Scenario: 热更新模块
- **WHEN** 开发时模块热更新并重新注册同一 id
- **THEN** 旧 disposer SHALL 先移除旧贡献
- **AND** 新注册 SHALL 成为唯一有效贡献

#### Scenario: 跨模块 Tab 冲突
- **WHEN** 第二个模块注册了与现有模块相同的 tab id
- **THEN** Registry SHALL 拒绝注册
- **AND** SHALL NOT 覆盖已有模块贡献

### Requirement: Registry SHALL 对 requiredCapabilities fail closed
`WorkbenchRegistry` SHALL 在注册时校验模块声明的 `requiredCapabilities`；缺失 capability 的模块 MUST 被拒绝。Host SHALL 能通过 `declareCapabilities` 或构造参数提供可用能力；能力声明返回精确 disposer。

#### Scenario: 缺少 capability 的模块注册
- **WHEN** 模块声明 `requiredCapabilities: ['fs.read']` 但 Registry 未声明 `fs.read`
- **THEN** Registry SHALL 抛错并保持未注册
- **AND** Host 声明 `fs.read` 后同一模块 SHALL 注册成功

### Requirement: Shell SHALL 使用可访问 tablist 语义
`WorkbenchShell` SHALL 使用 role=tablist/tab/tabpanel，支持 aria-selected、方向键/Home/End 切换、Delete 或独立关闭按钮关闭 closable tab、拖拽/键盘排序，以及 role=status 的状态栏。Tab 自身 SHALL NOT 是 button，关闭按钮 SHALL 是独立可访问按钮且不得嵌套在 tab 选择按钮内。颜色不得是唯一状态信号。

#### Scenario: 键盘切换工作台 Tab
- **WHEN** 用户聚焦 tablist 并使用方向键/Home/End 或点击
- **THEN** 激活 tab SHALL 更新 aria-selected 并移动焦点
- **AND** tabpanel SHALL 显示对应模块视图

#### Scenario: 关闭与排序 Tab
- **WHEN** 用户点击 closable Tab 的关闭按钮或按 Delete
- **THEN** Shell SHALL 调用 onCloseTab
- **AND** 用户拖拽或按 Alt+方向键时 SHALL 调用 onReorderTabs(source, target)

### Requirement: Workbench Core SHALL 不复制 DSH-better-sidebar 源码
实现 SHALL 不 import `DSH-better-sidebar`、不复制其 CSS/DOM/测试/构建产物，不读取私有 `ctx.betterSidebar` API。仅允许在文档中作为交互研究来源引用。

#### Scenario: 源码独立性检查
- **WHEN** 扫描 `@yeisme/dsh-workbench-core` 的 source、manifest 与 build output
- **THEN** SHALL 不包含 DSH-better-sidebar package/path/source marker
- **AND** 新公共合同 SHALL 标记 experimental
