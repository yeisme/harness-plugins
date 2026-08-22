## ADDED Requirements

### Requirement: Terminal 模块 SHALL 可注册进 Workbench Core
`terminalModule` SHALL 声明 terminal Tab 与 terminal.open/reconnect 命令，并可通过 `WorkbenchRegistry` 注册/卸载。

#### Scenario: 注册 Terminal 模块
- **WHEN** Workbench Core 注册 `dsh-terminal`
- **THEN** Registry SHALL 接受其 tab 与 commands
- **AND** dispose SHALL 移除贡献

### Requirement: Terminal 面板 SHALL 不拥有 PTY 状态
`TerminalPanel` SHALL 只显示占位，不创建 PTY、不发起连接、不复制终端 canonical state。

#### Scenario: 打开 Terminal Tab
- **WHEN** 用户打开 Terminal Tab
- **THEN** 面板 SHALL 显示占位说明
- **AND** 不得伪造终端运行状态

### Requirement: 实现 SHALL 不复制参考 sidebar 项目
`@yeisme/dsh-terminal` SHALL 不 import 参考 sidebar 项目、不复制其源码/CSS/构建产物，不读取其私有 API。

#### Scenario: 源码独立性检查
- **WHEN** 扫描 source/manifest/build output
- **THEN** SHALL 不包含参考项目 import/require/私有 API 调用
