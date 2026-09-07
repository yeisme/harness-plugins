## ADDED Requirements

### Requirement: Plugin content matches native panes
插件内容 SHALL 在统一宿主和旧 overlay 中使用一致的紧凑 token、行、工具区和焦点反馈，不依赖已卸载的 chrome 注入样式。
#### Scenario: Explorer opens in unified workspace
- **WHEN** 用户打开 Explorer
- **THEN** 树与操作呈现紧凑 pane 风格，列表拥有真实滚动窗口，元信息不覆盖其他内容

### Requirement: Explorer navigation completes its action
鼠标和键盘 SHALL 共用目录加载与文件打开路径，异步结果不得还原用户后续选择。
#### Scenario: Expand and scroll
- **WHEN** 用户按右方向键展开未加载目录并滚动超过初始窗口
- **THEN** 子项实际加载，后续行可见且可选择
#### Scenario: Open file
- **WHEN** 用户单击、双击或按 Enter 打开文件
- **THEN** 通过原 owner 打开预览或固定 Pane，失败给出原因而非无响应

### Requirement: Client pane commands use client capabilities
浏览器 pane 命令 SHALL 查询当前客户端服务并打开实际注册的面板，不以 Host 缺少浏览器服务误报未安装。
#### Scenario: MCP pane installed
- **WHEN** 用户在浏览器选择 `/mcp`
- **THEN** 可进入真实 MCP/Tools pane，不发送模型消息，也不返回 Pane Workbench is not installed

### Requirement: Keyboard layout commands preserve editing
侧栏和布局快捷键 SHALL 只操作宿主展示状态，并保留原 Pane 绑定、草稿和编辑快捷键。
#### Scenario: Toggle navigation
- **WHEN** 非编辑区域按 Ctrl/Cmd+B
- **THEN** 导航侧栏切换，其他 Pane 内容保持不变
#### Scenario: Editable control
- **WHEN** 输入法正在组合或焦点位于编辑器、输入框或终端
- **THEN** 布局快捷键不抢占该控件的输入
