# terminal Specification

## Purpose
TBD - created by archiving change dsh-terminal-v1. Update Purpose after archive.
## Requirements
### Requirement: Terminal 模块 SHALL 可注册进 Workbench Core
`terminalModule` SHALL 声明 terminal Tab 与 terminal.open/reconnect 命令，并可通过 `WorkbenchRegistry` 注册/卸载。

#### Scenario: 注册 Terminal 模块
- **WHEN** Workbench Core 注册 `dsh-terminal`
- **THEN** Registry SHALL 接受其 tab 与 commands
- **AND** dispose SHALL 移除贡献

### Requirement: Terminal 面板 SHALL 不拥有 PTY 状态
`TerminalPanel` SHALL 不创建 PTY、不复制终端 canonical state；PTY 进程与生命周期永远由官方 terminal backend 持有。渲染 SHALL 走诚实降级梯：无附着 seam → 占位/禁用态并说明原因；owner 提供的 V2 附着 seam 存在 → xterm 附着（输入转发 + 序列化输出 + 对称 detach）。

#### Scenario: 无附着 seam 时打开 Terminal Tab
- **WHEN** 用户打开 Terminal Tab 且宿主未提供 interactive terminal V2 seam
- **THEN** 面板 SHALL 显示占位/禁用说明与原因
- **AND** 不得伪造终端运行状态或输出

#### Scenario: 宿主提供 V2 附着 seam
- **WHEN** owner 暴露 `attachTerminal` 且面板附着某终端
- **THEN** 面板 SHALL 以 xterm 渲染 owner 授权的输出流并转发输入
- **AND** detach（含组件卸载与重连按钮）SHALL 不终止 PTY

#### Scenario: 终端已退出
- **WHEN** active 终端状态为 exited
- **THEN** 面板 SHALL 显示退出状态（exit code 或 signal）
- **AND** SHALL 禁用输入与前台信号入口，不把已退出终端当可用

### Requirement: terminal.reconnect SHALL 只同步投影
`terminal.reconnect` 命令与重连路径 SHALL 重新探测能力并重放列表/滚回；SHALL NOT 关闭、重启或以任何方式触碰 PTY 进程。

#### Scenario: 断连后重连
- **WHEN** 能力短暂缺席后恢复且用户触发重连
- **THEN** 客户端 SHALL 恢复能力态并重放 owner 名下终端列表与 active 终端滚回
- **AND** 原终端仍存在时 SHALL 保留选择；已消失时 SHALL 清空选择

#### Scenario: 关闭面板后重开
- **WHEN** 用户关闭 terminal 视图后重新打开
- **THEN** PTY SHALL 仍在官方 backend 运行（无 close/kill 调用）
- **AND** 重开视图 SHALL 经滚回读取恢复可见输出

### Requirement: 实现 SHALL 不复制参考 sidebar 项目
`@yeisme/dsh-terminal` SHALL 不 import 参考 sidebar 项目、不复制其源码/CSS/构建产物，不读取其私有 API。

#### Scenario: 源码独立性检查
- **WHEN** 扫描 source/manifest/build output
- **THEN** SHALL 不包含参考项目 import/require/私有 API 调用
