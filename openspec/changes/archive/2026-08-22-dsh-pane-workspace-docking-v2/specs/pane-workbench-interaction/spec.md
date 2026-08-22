## ADDED Requirements

### Requirement: Pane Workbench SHALL use a bounded canonical layout

Pane Workbench SHALL 用版本化 `PaneWorkspaceV1` 表示 Right/Bottom region、split tree、pane group、Tab、active group 与 region visibility，并由两个 slot root 共享的外部 controller 拥有。Split 深度 MUST NOT 超过 2，可见 pane 硬上限 MUST 为 4，每个 Pane SHALL 满足 280×180px 最小尺寸。投影到 rail、dock、sheet 或 maximize MUST NOT 改写 canonical tree。

#### Scenario: User attempts a fifth visible pane
- **WHEN** canonical layout 已有四个可见 group，Tab 被放到 edge zone
- **THEN** edge 目标 SHALL 禁用，center merge 仍可用
- **AND** MUST NOT 创建第五个 group 或更深 split

#### Scenario: Both slot roots render
- **WHEN** Right 与 Bottom host 订阅同一 controller
- **THEN** 每个 host SHALL 只渲染属于自己 region 的 group
- **AND** group、Tab 或 view instance MUST NOT 在 host 之间被克隆

### Requirement: Persistence SHALL store only safe V2 presentation state

Pane Workbench SHALL 持久化 `pane.workspace.persisted.v2`，只含 region visibility/size、split ratio、group role/lock、view kind、safe resource ref、preview/pinned、active ids 与 provider 批准的 metadata。MUST NOT 存储临时 maximize、overlay visibility、正文、terminal output、凭据、raw prompt、provider payload、private arguments 或绝对路径。V1 snapshot SHALL 迁移安全的 region、group、Tab 与 split，并丢弃瞬时字段。

#### Scenario: V1 snapshot contains maximized group
- **WHEN** 载入含合法 group 与 `maximizedGroupId` 的 V1 snapshot
- **THEN** 合法 layout 与 Tab 状态 SHALL 经 V2 normalizer 恢复
- **AND** 任何 group MUST NOT 以 maximized 起步

#### Scenario: Current client lacks a stored view kind
- **WHEN** V2 layout 引用未注册 provider
- **THEN** 该 Tab SHALL 恢复为 orphaned 或安全丢弃不可解析 metadata
- **AND** 其余 region、group、Tab 与 ratio SHALL 继续恢复

### Requirement: Cross-region drag SHALL be coordinated across slot roots

Right 与 Bottom region chrome SHALL 每个 controller generation 共用一个 drag coordinator。Tab reorder、跨 group move、跨 region move 与 edge split SHALL 在合法 drop 时提交一个已有 reducer intent。Pointer cancel、Escape、window blur、source unmount 与 HMR SHALL 取消且不删除 source 状态。

#### Scenario: Right Tab moves to Bottom
- **WHEN** Right Tab 被拖到合法 Bottom group center
- **THEN** coordinator SHALL 向共享 controller 提交一个 `move_view` intent
- **AND** 两个 host SHALL 观察到原子更新后的 snapshot

#### Scenario: Drop target becomes invalid
- **WHEN** provider unload 或尺寸约束在 pointerup 前使目标失效
- **THEN** coordinator SHALL 清除 preview 并宣布取消
- **AND** source Tab SHALL 留在原 group

### Requirement: Navigation SHALL be contextual rather than a fixed module bar

Region chrome SHALL 只显示已打开 Tab/view 与紧凑 `+` view selector。MUST NOT 永久渲染七个固定模块 tab。`openView()` SHALL 揭示解析后的目标 region；文件、文档与媒体默认 Right，终端默认 Bottom，除非请求显式选择另一合法目标。

#### Scenario: Fresh installation
- **WHEN** Pane bundle 在无已存 layout 时启动
- **THEN** 两个 region SHALL 规范关闭，Right 只作为 44px activity rail
- **AND** MUST NOT 合成固定模块 tab

#### Scenario: External terminal open
- **WHEN** provider 以 preferred Bottom 调用兼容 `openView()` 打开终端
- **THEN** Bottom SHALL 自动展开并激活该 Tab
- **AND** 调用方 MUST NOT 读取 workspace layout 内部
