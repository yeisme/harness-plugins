## ADDED Requirements

### Requirement: 组合 Workbench SHALL 复用 Workbench Core
`@yeisme/dsh-workbench-compose` SHALL 使用 `WorkbenchRegistry` 与 `WorkbenchShell` 组合 Rich Media 与 File/Document 模块。组合包 MUST NOT 创建第二 registry、第二 state 或领域 canonical store。

#### Scenario: 打开组合工作台
- **WHEN** 用户点击组合工作台侧栏入口
- **THEN** Shell SHALL 同时展示媒体库、文件、文档、终端 Tab
- **AND** 每个 Tab SHALL 渲染对应模块视图

### Requirement: 组合注册 SHALL 避免 Tab 冲突
组合 Registry SHALL 只注册具有唯一 tab id 的模块。若未来模块产生重复 tab id，注册层 SHALL 拒绝或要求重命名。

#### Scenario: 模块 tab id 冲突
- **WHEN** 两个模块注册相同 tab id
- **THEN** 组合包 SHALL 暴露冲突
- **AND** 不得静默覆盖

### Requirement: 组合包 SHALL 通过 Host 投影消费数据
组合工作台 SHALL 通过 `WorkbenchHostProjection` 获取媒体/文件条目与预览 URL，不直接接收 raw path/凭据/无界正文。Host 投影缺失时 SHALL 显示空状态。

#### Scenario: 注入 Host 投影
- **WHEN** Host 提供一个包含媒体与文件条目的 projection（可通过 `createStaticHostProjection` 构造）
- **THEN** 组合工作台 SHALL 渲染对应媒体/文件内容
- **AND** 未提供 resolver 的媒体 SHALL 显示加载失败/降级

### Requirement: 组合包 SHALL 提供命令面板入口
组合工作台 SHALL 集成 `CommandPalette`，聚合 Workbench Registry 中的命令，并支持键盘导航与执行回调。

#### Scenario: 打开命令面板
- **WHEN** 用户点击“命令”按钮
- **THEN** 面板 SHALL 列出当前模块命令
- **AND** Enter 执行、Escape 关闭、方向键导航

### Requirement: 组合包 SHALL 为官方宿主预留注册 seam
组合包 SHALL 提供 `WorkbenchHostSlotRegistrar`，在官方 Workbench/Pane 宿主 slot 可用时用于注册正式宿主。未获得官方 slot 前，注册器 SHALL 只作为内存预备 seam，不占用任何非官方宿主。

#### Scenario: 官方宿主可用
- **WHEN** 官方 Workbench/Pane 宿主 slot 出现并允许注册
- **THEN** `registerWhenHostSlotAvailable` SHALL 通过 registrar 注册组合工作台
- **AND** dispose SHALL 释放宿主注册

#### Scenario: 官方宿主不可用
- **WHEN** 官方 Workbench/Pane 宿主 slot 尚不存在
- **THEN** `registerWhenHostSlotAvailable` SHALL 返回 null
- **AND** registrar SHALL 保持未注册状态

### Requirement: 组合包 SHALL 不复制参考 sidebar 项目
组合包 SHALL 不 import 参考 sidebar 项目、不复制其源码/CSS/构建产物，不读取其私有 API。

#### Scenario: 源码独立性检查
- **WHEN** 扫描 source/manifest/build output
- **THEN** SHALL 不包含参考项目 import/require/私有 API 调用
