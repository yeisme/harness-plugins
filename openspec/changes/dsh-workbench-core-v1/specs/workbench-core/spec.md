## ADDED Requirements

### Requirement: Workbench Core SHALL 提供模块/标签/命令合同
`WorkbenchModuleDefinitionV1` SHALL 包含 id、version、title、requiredCapabilities、tabs 与 commands。`WorkbenchTabV1` SHALL 包含 id、moduleId、title、order、closable 与 scope。`WorkbenchCommandV1` SHALL 包含 id、moduleId、title 与可选 shortcutHint。所有描述符 MUST NOT 携带 raw path、凭据、任意 module URL 或脚本。

#### Scenario: 注册媒体模块
- **WHEN** `@yeisme/dsh-rich-media` 注册一个包含媒体库 Tab 与打开媒体命令的 Workbench module
- **THEN** Registry SHALL 接受并排序该模块
- **AND** Shell SHALL 只通过本地已注册视图渲染该 Tab

### Requirement: Registry SHALL effect-scoped 且可排序
`WorkbenchRegistry` SHALL 按 module id 去重，按 tab order 排序，并返回精确 disposer。重复 module id MUST 拒绝；dispose SHALL 移除该模块的 tabs/commands，不残留引用。

#### Scenario: 热更新模块
- **WHEN** 开发时模块热更新并重新注册同一 id
- **THEN** 旧 disposer SHALL 先移除旧贡献
- **AND** 新注册 SHALL 成为唯一有效贡献

### Requirement: Shell SHALL 使用可访问 tablist 语义
`WorkbenchShell` SHALL 使用 role=tablist/tab/tabpanel，支持 aria-selected、键盘切换、Delete 关闭 closable tab，以及 role=status 的状态栏。颜色不得是唯一状态信号。

#### Scenario: 键盘切换工作台 Tab
- **WHEN** 用户聚焦 tablist 并使用方向键/点击
- **THEN** 激活 tab SHALL 更新 aria-selected
- **AND** tabpanel SHALL 显示对应模块视图

### Requirement: Workbench Core SHALL 不复制 DSH-better-sidebar 源码
实现 SHALL 不 import `DSH-better-sidebar`、不复制其 CSS/DOM/测试/构建产物，不读取私有 `ctx.betterSidebar` API。仅允许在文档中作为交互研究来源引用。

#### Scenario: 源码独立性检查
- **WHEN** 扫描 `@yeisme/dsh-workbench-core` 的 source、manifest 与 build output
- **THEN** SHALL 不包含 DSH-better-sidebar package/path/source marker
- **AND** 新公共合同 SHALL 标记 experimental
